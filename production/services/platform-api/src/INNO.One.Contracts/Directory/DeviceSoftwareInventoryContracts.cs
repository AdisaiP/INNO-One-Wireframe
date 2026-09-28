namespace INNO.One.Contracts.Directory;

public sealed record DeviceSoftwarePackage(
    string ProductKey,
    string DisplayName,
    string? Version,
    string? Publisher,
    string? Architecture);

public sealed record DeviceSoftwareInventoryEntry(
    Guid SnapshotId,
    Guid DeviceId,
    DateTimeOffset ObservedAt,
    DateTimeOffset ReceivedAt,
    string Completeness,
    string Source,
    string? SourceInstance,
    IReadOnlyList<DeviceSoftwarePackage> Packages);

public interface IDeviceSoftwareInventoryReader
{
    Task<IReadOnlyDictionary<Guid, DeviceSoftwareInventoryEntry>> ReadLatestAsync(
        IReadOnlyCollection<Guid> deviceIds,
        CancellationToken cancellationToken = default);
}
