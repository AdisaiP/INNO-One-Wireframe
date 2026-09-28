using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Application;

public sealed class AssetsWorkspaceAttentionProvider(
    AssetsDbContext db,
    IAccessEvaluator accessEvaluator,
    IDeviceDirectoryReader deviceReader) : IWorkspaceAttentionProvider, IWorkspaceResourceVisibilityProvider
{
    public string ProviderId => "assets";

    public async Task<IReadOnlyList<WorkspaceAttentionItem>> GetAttentionAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }
        var now = DateTimeOffset.UtcNow;
        var contractQuery = db.Contracts.AsNoTracking()
            .Where(contract =>
                contract.RecordStatus == "active"
                && contract.EndAt > now
                && contract.EndAt <= now.AddDays(90));

        int count;
        if (access.AllResources)
        {
            count = await contractQuery.CountAsync(cancellationToken);
        }
        else
        {
            var assets = await db.Assets.AsNoTracking()
                .ToListAsync(cancellationToken);
            var visibleIds = await VisibleAssetIdsAsync(
                assets,
                access,
                cancellationToken);
            var contractIds = await db.AssetContractLinks.AsNoTracking()
                .Where(link => visibleIds.Contains(link.AssetId))
                .Select(link => link.ContractId)
                .Distinct()
                .ToArrayAsync(cancellationToken);
            count = await contractQuery
                .CountAsync(contract => contractIds.Contains(contract.Id), cancellationToken);
        }

        if (count == 0)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }

        return
        [
            new WorkspaceAttentionItem(
                "assets.contracts.expiring",
                "assets",
                count == 1 ? "1 contract expires soon" : $"{count} contracts expire soon",
                "Within the next 90 days",
                count,
                "info",
                "/assets/contracts")
        ];
    }

    public async Task<bool> CanAccessAsync(
        ClaimsPrincipal principal,
        string resourceType,
        string resourceId,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(resourceType, "asset", StringComparison.Ordinal)
            || !OpaqueId.TryParse(resourceId, "asset", out var id))
        {
            return false;
        }

        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return false;
        }

        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (asset is null || access.AllResources)
        {
            return asset is not null;
        }

        var visible = await VisibleAssetIdsAsync(
            new[] { asset },
            access,
            cancellationToken);
        return visible.Contains(id);
    }

    private async Task<HashSet<Guid>> VisibleAssetIdsAsync(
        IReadOnlyCollection<Asset> assets,
        EffectiveAccess access,
        CancellationToken cancellationToken)
    {
        var visible = assets
            .Where(asset =>
                (asset.OrganizationUnitId.HasValue
                    && access.OrganizationIds.Contains(asset.OrganizationUnitId.Value))
                || (asset.LocationId.HasValue
                    && access.LocationIds.Contains(asset.LocationId.Value)))
            .Select(asset => asset.Id)
            .ToHashSet();

        var linked = assets
            .Where(asset => !visible.Contains(asset.Id) && asset.LinkedDeviceId.HasValue)
            .ToArray();
        if (linked.Length == 0 || access.DeviceGroupIds.Count == 0)
        {
            return visible;
        }
        var deviceIds = linked
            .Select(asset => asset.LinkedDeviceId!.Value)
            .Distinct()
            .ToArray();
        var devices = await deviceReader.ReadAsync(deviceIds, cancellationToken);
        foreach (var asset in linked)
        {
            if (asset.LinkedDeviceId is Guid deviceId
                && devices.TryGetValue(deviceId, out var device)
                && device.GroupIds.Any(access.DeviceGroupIds.Contains))
            {
                visible.Add(asset.Id);
            }
        }

        return visible;
    }
}
