using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Search;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Application;

public sealed class AssetsGlobalSearchProvider(
    AssetsDbContext db,
    IAccessEvaluator accessEvaluator,
    IDeviceDirectoryReader deviceReader) : IGlobalSearchProvider
{
    public string ProviderId => "assets";

    public async Task<IReadOnlyList<GlobalSearchResult>> SearchAsync(
        ClaimsPrincipal principal,
        string query,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "assets.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Array.Empty<GlobalSearchResult>();
        }

        var term = query.Trim().ToLowerInvariant();
        var matches = await db.Assets.AsNoTracking()
            .Where(asset =>
                asset.AssetTag.ToLower().Contains(term)
                || asset.Name.ToLower().Contains(term)
                || (asset.SerialNumber != null
                    && asset.SerialNumber.ToLower().Contains(term))
                || (asset.Brand != null
                    && asset.Brand.ToLower().Contains(term))
                || (asset.Model != null
                    && asset.Model.ToLower().Contains(term)))
            .OrderBy(asset => asset.AssetTag)
            .ToListAsync(cancellationToken);

        var visible = access.AllResources
            ? matches
            : await FilterVisibleAsync(matches, access, cancellationToken);

        return visible
            .Take(limit)
            .Select(asset => new GlobalSearchResult(
                "asset",
                OpaqueId.Format("asset", asset.Id),
                asset.AssetTag + " · " + asset.Name,
                string.Join(
                    " · ",
                    new[] { "Assets", asset.Category, asset.LifecycleStatus }
                        .Where(value => !string.IsNullOrWhiteSpace(value))),
                "/assets/" + OpaqueId.Format("asset", asset.Id)))
            .ToArray();
    }

    private async Task<List<Asset>> FilterVisibleAsync(
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
            .ToDictionary(asset => asset.Id);

        var linked = assets
            .Where(asset =>
                !visible.ContainsKey(asset.Id)
                && asset.LinkedDeviceId.HasValue)
            .ToArray();

        if (linked.Length == 0 || access.DeviceGroupIds.Count == 0)
        {
            return visible.Values.OrderBy(asset => asset.AssetTag).ToList();
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
                visible[asset.Id] = asset;
            }
        }

        return visible.Values.OrderBy(asset => asset.AssetTag).ToList();
    }
}
