using INNO.One.Contracts.Authorization;

namespace INNO.One.Contracts.Assets;

public sealed record AssetAutomationAssetContext(
    Guid Id,
    string AssetTag,
    string Name,
    string Category,
    string LifecycleStatus,
    Guid? OwnerUserId,
    Guid? OrganizationUnitId,
    Guid? LocationId,
    Guid? LinkedDeviceId,
    DateTimeOffset? WarrantyEndAt);

public sealed record AssetAutomationLicenseContext(
    Guid Id,
    string ProductName,
    string Vendor,
    string LicenseModel,
    int EntitledSeats,
    int UsedSeats,
    DateTimeOffset? RenewalAt,
    string Status);

public sealed record AssetAutomationBaselineContext(
    Guid BaselineId,
    Guid AssetId,
    string ResultStatus,
    string ReasonCode,
    DateTimeOffset EvaluatedAt);

public interface IAssetsAutomationContextReader
{
    Task<AssetAutomationAssetContext?> ReadAssetAsync(
        Guid assetId,
        CancellationToken cancellationToken = default);

    Task<bool> CanAccessAssetAsync(
        Guid assetId,
        EffectiveAccess access,
        CancellationToken cancellationToken = default);

    Task<AssetAutomationLicenseContext?> ReadLicenseAsync(
        Guid licenseId,
        CancellationToken cancellationToken = default);

    Task<AssetAutomationBaselineContext?> ReadLatestBaselineResultAsync(
        Guid assetId,
        Guid baselineId,
        CancellationToken cancellationToken = default);
}
