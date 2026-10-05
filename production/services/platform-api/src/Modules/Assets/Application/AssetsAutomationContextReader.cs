using INNO.One.Contracts.Assets;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Application;

public sealed class AssetsAutomationContextReader(
    AssetsDbContext db,
    IDeviceDirectoryReader deviceDirectory) : IAssetsAutomationContextReader
{
    public async Task<AssetAutomationAssetContext?> ReadAssetAsync(
        Guid assetId,
        CancellationToken cancellationToken = default)
    {
        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == assetId, cancellationToken);
        return asset is null
            ? null
            : new AssetAutomationAssetContext(
                asset.Id,
                asset.AssetTag,
                asset.Name,
                asset.Category,
                asset.LifecycleStatus,
                asset.OwnerUserId,
                asset.OrganizationUnitId,
                asset.LocationId,
                asset.LinkedDeviceId,
                asset.WarrantyEndAt);
    }

    public async Task<bool> CanAccessAssetAsync(
        Guid assetId,
        EffectiveAccess access,
        CancellationToken cancellationToken = default)
    {
        if (access.AllResources)
        {
            return await db.Assets.AsNoTracking()
                .AnyAsync(x => x.Id == assetId, cancellationToken);
        }

        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == assetId, cancellationToken);
        if (asset is null)
        {
            return false;
        }

        if (asset.OrganizationUnitId is Guid orgId
            && access.OrganizationIds.Contains(orgId))
        {
            return true;
        }

        if (asset.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        {
            return true;
        }

        if (asset.LinkedDeviceId is not Guid deviceId
            || access.DeviceGroupIds.Count == 0)
        {
            return false;
        }

        var devices = await deviceDirectory.ReadAsync(
            [deviceId],
            cancellationToken);
        return devices.TryGetValue(deviceId, out var device)
            && device.GroupIds.Any(access.DeviceGroupIds.Contains);
    }

    public async Task<AssetAutomationLicenseContext?> ReadLicenseAsync(
        Guid licenseId,
        CancellationToken cancellationToken = default)
    {
        var license = await db.SoftwareLicenses.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == licenseId && x.Status == "active",
                cancellationToken);
        if (license is null)
        {
            return null;
        }

        var usedSeats = await db.LicenseAllocations.AsNoTracking()
            .Where(x => x.SoftwareLicenseId == license.Id)
            .SumAsync(x => (int?)x.SeatCount, cancellationToken) ?? 0;

        return new AssetAutomationLicenseContext(
            license.Id,
            license.ProductName,
            license.Vendor,
            license.LicenseModel,
            license.EntitledSeats,
            usedSeats,
            license.RenewalAt,
            license.Status);
    }

    public async Task<AssetAutomationBaselineContext?> ReadLatestBaselineResultAsync(
        Guid assetId,
        Guid baselineId,
        CancellationToken cancellationToken = default)
    {
        var row = await db.SoftwareBaselineResults.AsNoTracking()
            .Where(x => x.AssetId == assetId && x.BaselineId == baselineId)
            .OrderByDescending(x => x.EvaluatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return row is null
            ? null
            : new AssetAutomationBaselineContext(
                row.BaselineId,
                row.AssetId,
                row.ResultStatus,
                row.ReasonCode,
                row.EvaluatedAt);
    }
}
