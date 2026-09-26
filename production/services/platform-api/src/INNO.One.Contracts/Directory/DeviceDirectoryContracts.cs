namespace INNO.One.Contracts.Directory;

public sealed record DeviceDirectoryEntry(
    Guid Id,
    string Name,
    string Type,
    string Status,
    string? OperatingSystem,
    string? IpAddress,
    Guid? OwnerUserId,
    Guid? OrganizationUnitId,
    Guid? LocationId,
    IReadOnlySet<Guid> GroupIds);

public interface IDeviceDirectoryReader
{
    Task<IReadOnlyDictionary<Guid, DeviceDirectoryEntry>> ReadAsync(
        IReadOnlyCollection<Guid> deviceIds,
        CancellationToken cancellationToken = default);
}
