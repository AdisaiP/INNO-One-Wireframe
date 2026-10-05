using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Api;

public static class AgentAssetsEndpoints
{
    public static RouteGroupBuilder MapAgentAssetsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/agent/ownership/context", GetOwnershipContextAsync)
            .WithName("agent.ownership.context");
        api.MapPost("/agent/ownership-submissions", SubmitOwnershipAsync)
            .WithName("agent.ownership.submit");
        return api;
    }

    private static async Task<IResult> GetOwnershipContextAsync(
        string deviceId,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var parsedDeviceId))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var devices = await deviceReader.ReadAsync([parsedDeviceId], cancellationToken);
        if (!devices.TryGetValue(parsedDeviceId, out var device))
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.LinkedDeviceId == parsedDeviceId, cancellationToken);
        if (asset is null)
            return NotFound("No Asset is linked to this device.");

        var fields = await db.CustomFieldDefinitions.AsNoTracking()
            .Where(x => x.ShowInAgent && x.Status == "active")
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.FieldKey)
            .ToListAsync(cancellationToken);
        var fieldIds = fields.Select(x => x.Id).ToArray();
        var values = await db.CustomFieldValues.AsNoTracking()
            .Where(x => x.AssetId == asset.Id && fieldIds.Contains(x.FieldId))
            .ToDictionaryAsync(x => x.FieldId, x => x.ValueJson, cancellationToken);

        return Results.Ok(new ResourceResponse<AgentOwnershipContextResponse>(
            new(
                OpaqueId.Format("asset", asset.Id),
                asset.AssetTag,
                asset.Name,
                asset.Category,
                asset.Brand,
                asset.Model,
                asset.LifecycleStatus,
                OpaqueId.Format("dev", parsedDeviceId),
                device.Name,
                asset.OwnerUserId == access.UserId,
                fields.Select(field => new AgentCustomFieldResponse(
                    field.FieldKey,
                    field.Label,
                    field.FieldType,
                    field.IsRequired,
                    ParseOptions(field.OptionsJson),
                    values.TryGetValue(field.Id, out var rawValue)
                        ? ParseJsonValue(rawValue)
                        : null)).ToArray())));
    }

    private static async Task<IResult> SubmitOwnershipAsync(
        AgentOwnershipSubmissionRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(request.DeviceId, "dev", out var deviceId))
            return Validation("deviceId", "Invalid device.");
        if (!OpaqueId.TryParse(request.AssetId, "asset", out var assetId))
            return Validation("assetId", "Invalid asset.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var devices = await deviceReader.ReadAsync([deviceId], cancellationToken);
        if (!devices.TryGetValue(deviceId, out var device))
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == assetId && x.LinkedDeviceId == deviceId, cancellationToken);
        if (asset is null)
            return NotFound("Linked asset not found.");

        var possession = request.Possession?.Trim().ToLowerInvariant();
        if (possession is not ("owner" or "borrowed" or "returned"))
            return Validation("possession", "Possession must be owner, borrowed or returned.");

        // A new endpoint confirmation is append-only. Older pending confirmations stay
        // reviewable so the Agent never mutates or destroys previously submitted evidence.
        var now = DateTimeOffset.UtcNow;
        var changes = request.Changes ?? new Dictionary<string, string?>();
        var submission = new OwnershipSubmission
        {
            Id = Guid.NewGuid(),
            AssetId = asset.Id,
            UserId = access.UserId,
            DeviceName = device.Name,
            Possession = possession,
            SubmittedLocation = string.IsNullOrWhiteSpace(request.Location)
                ? null
                : request.Location.Trim(),
            ChangesJson = JsonSerializer.Serialize(changes),
            Status = "pending",
            SubmittedAt = now,
            Version = 1
        };

        db.OwnershipSubmissions.Add(submission);
        await db.SaveChangesAsync(cancellationToken);

        var submissionId = OpaqueId.Format("submission", submission.Id);
        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await ledger.AppendAuditAsync(
            "assets.ownership.submitted",
            "ownership_submission",
            submissionId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                assetId = request.AssetId,
                deviceId = request.DeviceId,
                possession,
                changedKeys = changes.Keys.OrderBy(x => x).ToArray()
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "asset.ownership.submitted",
            "ownership_submission",
            submissionId,
            new
            {
                submissionId,
                assetId = request.AssetId,
                userId = actorId,
                deviceId = request.DeviceId,
                possession
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        return Results.Created(
            $"/api/v1/assets/ownership-submissions/{submissionId}",
            new ResourceResponse<AgentOwnershipSubmissionResponse>(
                new(
                    submissionId,
                    request.AssetId,
                    request.DeviceId,
                    possession,
                    "pending",
                    now)));
    }

    private static IReadOnlyList<string> ParseOptions(string raw)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(raw) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string? ParseJsonValue(string raw)
    {
        try
        {
            using var document = JsonDocument.Parse(raw);
            return document.RootElement.ValueKind == JsonValueKind.String
                ? document.RootElement.GetString()
                : document.RootElement.ToString();
        }
        catch
        {
            return raw;
        }
    }

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers.TryGetValue("X-Correlation-ID", out var value)
            && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : context.TraceIdentifier;

    private static IResult Forbidden(string reason) =>
        Results.Problem(statusCode: 403, title: "Access denied", detail: reason);

    private static IResult NotFound(string detail) =>
        Results.Problem(statusCode: 404, title: "Not found", detail: detail);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record AgentOwnershipSubmissionRequest(
        string DeviceId,
        string AssetId,
        string? Possession,
        string? Location,
        Dictionary<string, string?>? Changes);

    public sealed record AgentOwnershipSubmissionResponse(
        string Id,
        string AssetId,
        string DeviceId,
        string Possession,
        string Status,
        DateTimeOffset SubmittedAt);

    public sealed record AgentOwnershipContextResponse(
        string AssetId,
        string AssetTag,
        string AssetName,
        string Category,
        string? Brand,
        string? Model,
        string LifecycleStatus,
        string DeviceId,
        string DeviceName,
        bool CurrentUserIsAssetOwner,
        IReadOnlyList<AgentCustomFieldResponse> Fields);

    public sealed record AgentCustomFieldResponse(
        string Key,
        string Label,
        string Type,
        bool Required,
        IReadOnlyList<string> Options,
        string? Value);
}
