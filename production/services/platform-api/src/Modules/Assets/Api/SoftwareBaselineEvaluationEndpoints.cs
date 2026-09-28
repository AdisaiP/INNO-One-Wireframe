using System.Text.Json;
using System.Text.RegularExpressions;
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

public static partial class SoftwareBaselineEvaluationEndpoints
{
    private static readonly TimeSpan FreshnessWindow = TimeSpan.FromHours(24);

    public static RouteGroupBuilder MapSoftwareBaselineEvaluationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/assets/software-baselines/{baselineId}/results", ListResultsAsync)
            .WithName("assets.baseline_results.list");
        api.MapPost("/assets/software-baselines/{baselineId}/evaluate", EvaluateAsync)
            .WithName("assets.baselines.evaluate");
        return api;
    }

    private static async Task<IResult> ListResultsAsync(
        string baselineId,
        HttpContext http,
        AssetsDbContext db,
        IAccessEvaluator evaluator,
        IDeviceDirectoryReader deviceDirectory,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(baselineId, "baseline", out var id))
        {
            return NotFound();
        }

        var access = await evaluator.EvaluateAsync(http.User, "assets.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var baseline = await db.SoftwareBaselines.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (baseline is null)
        {
            return NotFound();
        }

        var allAssets = await db.Assets.AsNoTracking()
            .Where(x => baseline.TargetCategory == null || x.Category == baseline.TargetCategory)
            .ToListAsync(cancellationToken);
        var assets = await ApplyScopeAsync(allAssets, access, deviceDirectory, cancellationToken);
        var assetIds = assets.Select(x => x.Id).ToArray();
        var results = await db.SoftwareBaselineResults.AsNoTracking()
            .Where(x => x.BaselineId == id && assetIds.Contains(x.AssetId))
            .OrderBy(x => x.ResultStatus)
            .ThenBy(x => x.AssetId)
            .ToListAsync(cancellationToken);

        return Results.Ok(ToResponse(baseline, assets, results));
    }

    private static async Task<IResult> EvaluateAsync(
        string baselineId,
        HttpContext http,
        AssetsDbContext db,
        IAccessEvaluator evaluator,
        IDeviceDirectoryReader deviceDirectory,
        IDeviceSoftwareInventoryReader inventoryReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(baselineId, "baseline", out var id))
        {
            return NotFound();
        }

        var access = await evaluator.EvaluateAsync(
            http.User, "assets.baseline.manage", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var baseline = await db.SoftwareBaselines
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (baseline is null)
        {
            return NotFound();
        }
        if (baseline.Status != "active")
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Baseline is not active",
                detail: "Only active software baselines can be evaluated.");
        }

        var allAssets = await db.Assets
            .Where(x => baseline.TargetCategory == null || x.Category == baseline.TargetCategory)
            .ToListAsync(cancellationToken);
        var assets = await ApplyScopeAsync(allAssets, access, deviceDirectory, cancellationToken);
        var deviceIds = assets.Where(x => x.LinkedDeviceId.HasValue)
            .Select(x => x.LinkedDeviceId!.Value).Distinct().ToArray();
        var inventories = await inventoryReader.ReadLatestAsync(deviceIds, cancellationToken);
        var required = JsonSerializer.Deserialize<string[]>(baseline.RequiredPackagesJson) ?? [];
        var existing = await db.SoftwareBaselineResults
            .Where(x => x.BaselineId == id)
            .ToDictionaryAsync(x => x.AssetId, cancellationToken);
        var evaluatedAt = DateTimeOffset.UtcNow;
        var currentAssetIds = assets.Select(x => x.Id).ToHashSet();
        var emitted = 0;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        foreach (var asset in assets)
        {
            var evaluation = EvaluateAsset(asset, inventories, required, evaluatedAt);
            var hadPrevious = existing.TryGetValue(asset.Id, out var result);
            var previousStatus = result?.ResultStatus;
            if (!hadPrevious)
            {
                result = new SoftwareBaselineResult
                {
                    Id = Guid.NewGuid(),
                    BaselineId = baseline.Id,
                    AssetId = asset.Id,
                    ResultStatus = evaluation.Status,
                    ReasonCode = evaluation.Reason,
                    MissingPackagesJson = JsonSerializer.Serialize(evaluation.Missing),
                    InventorySnapshotReference = evaluation.SnapshotReference,
                    InventoryObservedAt = evaluation.ObservedAt,
                    BaselineVersion = baseline.Version,
                    EvaluatedAt = evaluatedAt,
                    Version = 1
                };
                db.SoftwareBaselineResults.Add(result);
            }
            else
            {
                result!.ResultStatus = evaluation.Status;
                result.ReasonCode = evaluation.Reason;
                result.MissingPackagesJson = JsonSerializer.Serialize(evaluation.Missing);
                result.InventorySnapshotReference = evaluation.SnapshotReference;
                result.InventoryObservedAt = evaluation.ObservedAt;
                result.BaselineVersion = baseline.Version;
                result.EvaluatedAt = evaluatedAt;
                result.Version++;
            }

            if (hadPrevious
                && IsEvidenceBacked(previousStatus)
                && IsEvidenceBacked(evaluation.Status)
                && previousStatus != evaluation.Status)
            {
                emitted++;
                await ledger.AppendOutboxAsync(
                    "baseline.drift",
                    "asset",
                    OpaqueId.Format("asset", asset.Id),
                    new
                    {
                        assetId = OpaqueId.Format("asset", asset.Id),
                        baselineId,
                        driftType = evaluation.Status,
                        detectedAt = evaluatedAt
                    },
                    CorrelationId(http),
                    null,
                    http.TraceIdentifier,
                    cancellationToken);
            }
        }

        if (access.AllResources)
        {
            var obsolete = existing.Values.Where(x => !currentAssetIds.Contains(x.AssetId)).ToArray();
            if (obsolete.Length > 0)
            {
                db.SoftwareBaselineResults.RemoveRange(obsolete);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "assets.baseline.evaluated",
            "software_baseline",
            baselineId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(http),
            http.TraceIdentifier,
            new
            {
                assetCount = assets.Count,
                baselineVersion = baseline.Version,
                driftEvents = emitted,
                freshnessHours = (int)FreshnessWindow.TotalHours
            },
            cancellationToken,
            classification: "internal");
        await transaction.CommitAsync(cancellationToken);

        var persisted = await db.SoftwareBaselineResults.AsNoTracking()
            .Where(x => x.BaselineId == id && currentAssetIds.Contains(x.AssetId))
            .OrderBy(x => x.ResultStatus)
            .ThenBy(x => x.AssetId)
            .ToListAsync(cancellationToken);
        return Results.Ok(ToResponse(baseline, assets, persisted));
    }

    private static Evaluation EvaluateAsset(
        Asset asset,
        IReadOnlyDictionary<Guid, DeviceSoftwareInventoryEntry> inventories,
        IReadOnlyCollection<string> required,
        DateTimeOffset evaluatedAt)
    {
        if (asset.LinkedDeviceId is not Guid deviceId)
        {
            return new("unknown", "no_linked_device", [], null, null);
        }
        if (!inventories.TryGetValue(deviceId, out var inventory))
        {
            return new("unknown", "no_inventory", [], null, null);
        }

        var snapshotReference = OpaqueId.Format("swi", inventory.SnapshotId);
        if (evaluatedAt - inventory.ObservedAt > FreshnessWindow)
        {
            return new("unknown", "stale_inventory", [], snapshotReference, inventory.ObservedAt);
        }
        if (inventory.Completeness != "complete")
        {
            return new("unknown", "partial_inventory", [], snapshotReference, inventory.ObservedAt);
        }

        var installed = inventory.Packages.SelectMany(x => new[]
            {
                NormalizeIdentity(x.ProductKey),
                NormalizeIdentity(x.DisplayName)
            })
            .Where(x => x.Length > 0)
            .ToHashSet(StringComparer.Ordinal);
        var missing = required.Where(x => !installed.Contains(NormalizeIdentity(x))).ToArray();
        return missing.Length == 0
            ? new("compliant", "fresh_complete_inventory", [], snapshotReference, inventory.ObservedAt)
            : new("missing", "fresh_complete_inventory", missing, snapshotReference, inventory.ObservedAt);
    }

    private static async Task<List<Asset>> ApplyScopeAsync(
        IReadOnlyCollection<Asset> assets,
        EffectiveAccess access,
        IDeviceDirectoryReader deviceDirectory,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
        {
            return assets.ToList();
        }

        var result = assets.Where(x =>
            (x.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            || (x.LocationId is Guid locationId && access.LocationIds.Contains(locationId)))
            .ToDictionary(x => x.Id);
        var remaining = assets.Where(x => !result.ContainsKey(x.Id) && x.LinkedDeviceId.HasValue).ToArray();
        if (remaining.Length > 0 && access.DeviceGroupIds.Count > 0)
        {
            var devices = await deviceDirectory.ReadAsync(
                remaining.Select(x => x.LinkedDeviceId!.Value).Distinct().ToArray(),
                cancellationToken);
            foreach (var asset in remaining)
            {
                if (devices.TryGetValue(asset.LinkedDeviceId!.Value, out var device)
                    && device.GroupIds.Any(access.DeviceGroupIds.Contains))
                {
                    result[asset.Id] = asset;
                }
            }
        }
        return result.Values.ToList();
    }

    private static BaselineResultsResponse ToResponse(
        SoftwareBaseline baseline,
        IReadOnlyCollection<Asset> assets,
        IReadOnlyCollection<SoftwareBaselineResult> results)
    {
        var assetMap = assets.ToDictionary(x => x.Id);
        var rows = results.Where(x => assetMap.ContainsKey(x.AssetId)).Select(x =>
        {
            var asset = assetMap[x.AssetId];
            return new BaselineResultResponse(
                OpaqueId.Format("baseline_result", x.Id),
                OpaqueId.Format("asset", asset.Id),
                asset.AssetTag,
                asset.Name,
                asset.Category,
                x.ResultStatus,
                x.ReasonCode,
                JsonSerializer.Deserialize<string[]>(x.MissingPackagesJson) ?? [],
                x.InventorySnapshotReference,
                x.InventoryObservedAt,
                x.EvaluatedAt);
        }).ToArray();

        return new(
            OpaqueId.Format("baseline", baseline.Id),
            baseline.Name,
            baseline.Version,
            rows.Count(x => x.Status == "compliant"),
            rows.Count(x => x.Status == "missing"),
            rows.Count(x => x.Status == "unknown"),
            rows.Select(x => (DateTimeOffset?)x.EvaluatedAt).Max(),
            rows);
    }

    private static bool IsEvidenceBacked(string? value) => value is "compliant" or "missing";

    private static string NormalizeIdentity(string value) =>
        IdentityPattern().Replace(value.Trim().ToLowerInvariant(), string.Empty);

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Software baseline not found");

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex IdentityPattern();

    private sealed record Evaluation(
        string Status,
        string Reason,
        string[] Missing,
        string? SnapshotReference,
        DateTimeOffset? ObservedAt);

    private sealed record BaselineResultsResponse(
        string BaselineId,
        string BaselineName,
        int BaselineVersion,
        int CompliantCount,
        int MissingCount,
        int UnknownCount,
        DateTimeOffset? EvaluatedAt,
        IReadOnlyList<BaselineResultResponse> Items);

    private sealed record BaselineResultResponse(
        string Id,
        string AssetId,
        string AssetTag,
        string AssetName,
        string Category,
        string Status,
        string ReasonCode,
        string[] MissingPackages,
        string? InventorySnapshotId,
        DateTimeOffset? InventoryObservedAt,
        DateTimeOffset EvaluatedAt);
}
