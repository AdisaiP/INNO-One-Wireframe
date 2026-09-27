using System.Text.Json;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Infrastructure;

public sealed record AssetCustomFieldSnapshot(
    string FieldKey,
    string Label,
    string FieldType,
    bool IsRequired,
    bool ShowInAgent,
    IReadOnlyList<string> Options,
    JsonElement? Value);

public sealed record AssetCustomFieldApplyResult(
    IReadOnlyDictionary<string, string[]> Errors,
    IReadOnlyList<string> ChangedKeys)
{
    public bool IsValid => Errors.Count == 0;
}

public sealed class AssetCustomFieldValueService(AssetsDbContext db)
{
    public async Task<IReadOnlyList<AssetCustomFieldSnapshot>> ReadForAssetAsync(
        Guid assetId,
        CancellationToken cancellationToken = default)
    {
        var definitions = await db.CustomFieldDefinitions.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.FieldKey)
            .ToListAsync(cancellationToken);

        var values = await db.CustomFieldValues.AsNoTracking()
            .Where(x => x.AssetId == assetId)
            .ToDictionaryAsync(x => x.FieldId, cancellationToken);

        return definitions.Select(definition =>
        {
            JsonElement? value = null;
            if (values.TryGetValue(definition.Id, out var stored))
            {
                value = ParseValue(stored.ValueJson);
            }

            return new AssetCustomFieldSnapshot(
                definition.FieldKey,
                definition.Label,
                definition.FieldType,
                definition.IsRequired,
                definition.ShowInAgent,
                ParseOptions(definition.OptionsJson),
                value);
        }).ToArray();
    }

    public async Task<AssetCustomFieldApplyResult> ApplyAsync(
        Guid assetId,
        IReadOnlyDictionary<string, JsonElement> input,
        CancellationToken cancellationToken = default)
    {
        var definitions = await db.CustomFieldDefinitions.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.DisplayOrder)
            .ToListAsync(cancellationToken);
        var byKey = definitions.ToDictionary(x => x.FieldKey, StringComparer.Ordinal);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var key in input.Keys)
        {
            if (!byKey.ContainsKey(key))
            {
                errors[$"customFields.{key}"] = ["This custom field is not active."];
            }
        }

        var currentValues = await db.CustomFieldValues
            .Where(x => x.AssetId == assetId)
            .ToListAsync(cancellationToken);
        var byFieldId = currentValues.ToDictionary(x => x.FieldId);

        foreach (var definition in definitions)
        {
            var hasIncoming = input.TryGetValue(definition.FieldKey, out var incoming);
            var hasStored = byFieldId.TryGetValue(definition.Id, out var stored);
            var effective = hasIncoming
                ? incoming
                : hasStored
                    ? ParseValue(stored!.ValueJson) ?? NullElement()
                    : NullElement();

            var error = ValidateValue(definition, effective);
            if (error is not null)
            {
                errors[$"customFields.{definition.FieldKey}"] = [error];
            }
        }

        if (errors.Count > 0)
        {
            return new AssetCustomFieldApplyResult(errors, Array.Empty<string>());
        }

        var changedKeys = new List<string>();
        var now = DateTimeOffset.UtcNow;

        foreach (var pair in input)
        {
            var definition = byKey[pair.Key];
            var incoming = pair.Value;
            var empty = IsEmpty(incoming);
            byFieldId.TryGetValue(definition.Id, out var stored);

            if (empty)
            {
                if (stored is not null)
                {
                    db.CustomFieldValues.Remove(stored);
                    changedKeys.Add(definition.FieldKey);
                }
                continue;
            }

            var canonical = JsonSerializer.Serialize(incoming);
            if (stored is null)
            {
                db.CustomFieldValues.Add(new AssetCustomFieldValue
                {
                    AssetId = assetId,
                    FieldId = definition.Id,
                    ValueJson = canonical,
                    UpdatedAt = now
                });
                changedKeys.Add(definition.FieldKey);
                continue;
            }

            if (JsonEquivalent(stored.ValueJson, canonical))
            {
                continue;
            }

            stored.ValueJson = canonical;
            stored.UpdatedAt = now;
            changedKeys.Add(definition.FieldKey);
        }

        return new AssetCustomFieldApplyResult(errors, changedKeys);
    }

    private static string? ValidateValue(
        AssetCustomFieldDefinition definition,
        JsonElement value)
    {
        if (IsEmpty(value))
        {
            return definition.IsRequired ? "This field is required." : null;
        }

        return definition.FieldType switch
        {
            "text" when value.ValueKind != JsonValueKind.String =>
                "Enter a text value.",
            "text" when (value.GetString()?.Length ?? 0) > 500 =>
                "Text values must be 500 characters or fewer.",
            "number" when value.ValueKind != JsonValueKind.Number =>
                "Enter a number.",
            "boolean" when value.ValueKind is not (
                JsonValueKind.True or JsonValueKind.False) =>
                "Choose true or false.",
            "date" when value.ValueKind != JsonValueKind.String
                || !DateOnly.TryParse(value.GetString(), out _) =>
                "Enter a valid date.",
            "select" when value.ValueKind != JsonValueKind.String =>
                "Select one of the configured options.",
            "select" when !ParseOptions(definition.OptionsJson)
                .Contains(value.GetString() ?? string.Empty, StringComparer.Ordinal) =>
                "Select one of the configured options.",
            _ => null
        };
    }

    private static bool IsEmpty(JsonElement value) =>
        value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined
        || (value.ValueKind == JsonValueKind.String
            && string.IsNullOrWhiteSpace(value.GetString()));

    private static string[] ParseOptions(string json)
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

    private static JsonElement? ParseValue(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static JsonElement NullElement()
    {
        using var document = JsonDocument.Parse("null");
        return document.RootElement.Clone();
    }

    private static bool JsonEquivalent(string left, string right)
    {
        try
        {
            using var leftDocument = JsonDocument.Parse(left);
            using var rightDocument = JsonDocument.Parse(right);
            return JsonSerializer.Serialize(leftDocument.RootElement)
                == JsonSerializer.Serialize(rightDocument.RootElement);
        }
        catch (JsonException)
        {
            return left == right;
        }
    }
}
