namespace INNO.One.Contracts.Directory;

public sealed record PlatformDirectorySnapshot(
    IReadOnlyDictionary<Guid, string> Users,
    IReadOnlyDictionary<Guid, string> Organizations,
    IReadOnlyDictionary<Guid, string> Locations);

public interface IPlatformDirectoryReader
{
    Task<PlatformDirectorySnapshot> ReadAsync(
        IReadOnlyCollection<Guid> userIds,
        IReadOnlyCollection<Guid> organizationIds,
        IReadOnlyCollection<Guid> locationIds,
        CancellationToken cancellationToken = default);
}
