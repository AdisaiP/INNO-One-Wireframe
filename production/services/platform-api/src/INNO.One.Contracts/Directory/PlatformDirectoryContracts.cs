namespace INNO.One.Contracts.Directory;

public sealed record PlatformDirectorySnapshot(
    IReadOnlyDictionary<Guid, string> Users,
    IReadOnlyDictionary<Guid, string> Organizations,
    IReadOnlyDictionary<Guid, string> Locations);

public sealed record DirectoryUserEntry(
    Guid Id,
    string EmployeeId,
    string FullName,
    string Email,
    Guid? OrganizationUnitId,
    Guid? LocationId,
    string Status);

public interface IPlatformDirectoryReader
{
    Task<PlatformDirectorySnapshot> ReadAsync(
        IReadOnlyCollection<Guid> userIds,
        IReadOnlyCollection<Guid> organizationIds,
        IReadOnlyCollection<Guid> locationIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, DirectoryUserEntry>> ReadUsersAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DirectoryUserEntry>> SearchUsersAsync(
        string? search,
        IReadOnlyCollection<Guid>? organizationIds,
        int limit = 25,
        CancellationToken cancellationToken = default);
}
