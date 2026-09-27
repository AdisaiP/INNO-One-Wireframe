using System.Text.Json;
using System.Text.RegularExpressions;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Api;

public static partial class AssetsCustomFieldEndpoints
{
    private static readonly string[] SupportedTypes =
        ["text", "number", "date", "boolean", "select"];

    private static readonly Regex FieldKeyPattern = new(
        "^[a-z][a-z0-9_]{1,79}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static RouteGroupBuilder MapAssetsCustomFieldEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/assets/custom-fields", GetCustomFieldsAsync)
            .WithName("assets.custom_fields.list");
        api.MapPut("/assets/custom-fields", UpdateCustomFieldsAsync)
            .WithName("assets.custom_fields.update");
        return api;
    }

    private static async Task<IResult> GetCustomFieldsAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var definitions = await db.CustomFieldDefinitions.AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.FieldKey)
            .ToListAsync(cancellationToken);

        var version = SchemaVersion(definitions);
        httpContext.Response.Headers.ETag = Etag(version);

        return Results.Ok(new ResourceResponse<CustomFieldSchemaResponse>(
            new CustomFieldSchemaResponse(
                definitions.Select(ToResponse).ToArray(),
                Etag(version))));
    }
    private static async Task<IResult> UpdateCustomFieldsAsync(
        UpdateCustomFieldSchemaRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var incoming = request.Fields ?? Array.Empty<CustomFieldDefinitionRequest>();
        if (incoming.Count > 50)
        {
            return Validation("fields", "A maximum of 50 custom fields is supported.");
        }

        var validation = ValidateSchema(incoming);
        if (validation.Count > 0)
        {
            return Results.ValidationProblem(validation, title: "Validation failed");
        }

        var existing = await db.CustomFieldDefinitions
            .OrderBy(x => x.DisplayOrder)
            .ToListAsync(cancellationToken);
        var stale = ValidateIfMatch(httpContext, SchemaVersion(existing));
        if (stale is not null)
        {
            return stale;
        }

        var existingKeys = existing.Select(x => x.FieldKey).ToHashSet(StringComparer.Ordinal);
        var incomingKeys = incoming.Select(x => x.FieldKey.Trim()).ToHashSet(StringComparer.Ordinal);
        var omitted = existingKeys.Except(incomingKeys).ToArray();
        if (omitted.Length > 0)
        {
            return Validation(
                "fields",
                "Existing fields cannot be removed in this slice. Set the field status to draft instead.");
        }

        var fieldsWithValues = await db.CustomFieldValues.AsNoTracking()
            .Select(x => x.FieldId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var fieldsWithValuesSet = fieldsWithValues.ToHashSet();
        var now = DateTimeOffset.UtcNow;
        var changedKeys = new List<string>();

        for (var index = 0; index < incoming.Count; index++)
        {
            var item = incoming[index];
            var key = item.FieldKey.Trim();
            var type = item.FieldType.Trim().ToLowerInvariant();
            var label = item.Label.Trim();
            var status = item.Status.Trim().ToLowerInvariant();
            var options = NormalizeOptions(item.Options);
            var optionsJson = JsonSerializer.Serialize(options);

            var definition = existing.SingleOrDefault(x => x.FieldKey == key);
            if (definition is null)
            {
                definition = new AssetCustomFieldDefinition
                {
                    Id = Guid.NewGuid(),
                    FieldKey = key,
                    Label = label,
                    FieldType = type,
                    IsRequired = item.IsRequired,
                    ShowInAgent = item.ShowInAgent,
                    Status = status,
                    OptionsJson = optionsJson,
                    DisplayOrder = index,
                    Version = 1,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.CustomFieldDefinitions.Add(definition);
                changedKeys.Add(key);
                continue;
            }

            if (!string.Equals(definition.FieldType, type, StringComparison.Ordinal)
                && fieldsWithValuesSet.Contains(definition.Id))
            {
                return Validation(
                    "fields",
                    $"Field '{key}' already has values and its type cannot be changed.");
            }

            var changed =
                definition.Label != label
                || definition.FieldType != type
                || definition.IsRequired != item.IsRequired
                || definition.ShowInAgent != item.ShowInAgent
                || definition.Status != status
                || definition.OptionsJson != optionsJson
                || definition.DisplayOrder != index;

            if (!changed)
            {
                continue;
            }

            definition.Label = label;
            definition.FieldType = type;
            definition.IsRequired = item.IsRequired;
            definition.ShowInAgent = item.ShowInAgent;
            definition.Status = status;
            definition.OptionsJson = optionsJson;
            definition.DisplayOrder = index;
            definition.Version++;
            definition.UpdatedAt = now;
            changedKeys.Add(key);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        if (changedKeys.Count > 0)
        {
            await ledger.AppendAuditAsync(
                "assets.custom_fields.updated",
                "asset_custom_field",
                "schema",
                OpaqueId.Format("user", access.UserId),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                new
                {
                    fieldKeys = changedKeys,
                    fieldCount = incoming.Count
                },
                cancellationToken,
                classification: "internal");
        }

        await transaction.CommitAsync(cancellationToken);

        var updated = await db.CustomFieldDefinitions.AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.FieldKey)
            .ToListAsync(cancellationToken);
        var version = SchemaVersion(updated);
        httpContext.Response.Headers.ETag = Etag(version);

        return Results.Ok(new ResourceResponse<CustomFieldSchemaResponse>(
            new CustomFieldSchemaResponse(
                updated.Select(ToResponse).ToArray(),
                Etag(version))));
    }
    private static Dictionary<string, string[]> ValidateSchema(
        IReadOnlyList<CustomFieldDefinitionRequest> fields)
    {
        var errors = new Dictionary<string, string[]>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < fields.Count; index++)
        {
            var field = fields[index];
            var prefix = $"fields[{index}]";
            var key = field.FieldKey?.Trim() ?? string.Empty;
            var label = field.Label?.Trim() ?? string.Empty;
            var type = field.FieldType?.Trim().ToLowerInvariant() ?? string.Empty;
            var status = field.Status?.Trim().ToLowerInvariant() ?? string.Empty;
            var options = NormalizeOptions(field.Options);

            if (!FieldKeyPattern.IsMatch(key))
            {
                errors[$"{prefix}.fieldKey"] =
                    ["Use 2–80 lowercase letters, numbers or underscores, starting with a letter."];
            }
            else if (!seen.Add(key))
            {
                errors[$"{prefix}.fieldKey"] = ["Field keys must be unique."];
            }

            if (string.IsNullOrWhiteSpace(label) || label.Length > 160)
            {
                errors[$"{prefix}.label"] = ["Label is required and must be 160 characters or fewer."];
            }

            if (!SupportedTypes.Contains(type, StringComparer.Ordinal))
            {
                errors[$"{prefix}.fieldType"] = ["Select a supported field type."];
            }

            if (status is not ("active" or "draft"))
            {
                errors[$"{prefix}.status"] = ["Status must be active or draft."];
            }

            if (type == "select")
            {
                if (options.Length == 0)
                {
                    errors[$"{prefix}.options"] = ["Select fields require at least one option."];
                }
                else if (options.Length > 50)
                {
                    errors[$"{prefix}.options"] = ["A select field supports at most 50 options."];
                }
                else if (options.Distinct(StringComparer.OrdinalIgnoreCase).Count() != options.Length)
                {
                    errors[$"{prefix}.options"] = ["Select options must be unique."];
                }
            }
            else if (options.Length > 0)
            {
                errors[$"{prefix}.options"] = ["Only select fields can define options."];
            }
        }

        return errors;
    }

    private static string[] NormalizeOptions(IReadOnlyList<string>? values) =>
        values?
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray()
        ?? Array.Empty<string>();

    private static CustomFieldDefinitionResponse ToResponse(
        AssetCustomFieldDefinition definition) =>
        new(
            OpaqueId.Format("field", definition.Id),
            definition.FieldKey,
            definition.Label,
            definition.FieldType,
            definition.IsRequired,
            definition.ShowInAgent,
            definition.Status,
            ParseOptions(definition.OptionsJson),
            definition.DisplayOrder,
            definition.UpdatedAt);
    internal static string[] ParseOptions(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json)
                ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static long SchemaVersion(
        IReadOnlyCollection<AssetCustomFieldDefinition> fields) =>
        fields.Sum(x => x.Version);

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (!TryReadVersion(raw, out var expected)
            || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Custom-field schema changed",
                detail: "Refresh the schema and retry the save.");
        }

        return null;
    }

    private static bool TryReadVersion(string raw, out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }
        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult Validation(string field, string detail) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]>
            {
                [field] = new[] { detail }
            },
            title: "Validation failed");

    public sealed record UpdateCustomFieldSchemaRequest(
        IReadOnlyList<CustomFieldDefinitionRequest>? Fields);

    public sealed record CustomFieldDefinitionRequest(
        string FieldKey,
        string Label,
        string FieldType,
        bool IsRequired,
        bool ShowInAgent,
        string Status,
        IReadOnlyList<string>? Options);

    private sealed record CustomFieldSchemaResponse(
        IReadOnlyList<CustomFieldDefinitionResponse> Fields,
        string ETag);

    private sealed record CustomFieldDefinitionResponse(
        string Id,
        string FieldKey,
        string Label,
        string FieldType,
        bool IsRequired,
        bool ShowInAgent,
        string Status,
        IReadOnlyList<string> Options,
        int DisplayOrder,
        DateTimeOffset UpdatedAt);
}
