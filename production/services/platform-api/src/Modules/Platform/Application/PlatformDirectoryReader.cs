using INNO.One.Contracts.Directory;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Application;

public sealed class PlatformDirectoryReader(PlatformDbContext db) : IPlatformDirectoryReader
{
    public async Task<PlatformDirectorySnapshot> ReadAsync(
        IReadOnlyCollection<Guid> userIds,
        IReadOnlyCollection<Guid> organizationIds,
        IReadOnlyCollection<Guid> locationIds,
        CancellationToken cancellationToken = default)
    {
        var users = await db.UserProfiles.AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);

        var organizations = await db.OrganizationUnits.AsNoTracking()
            .Where(x => organizationIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var locations = await db.Locations.AsNoTracking()
            .Where(x => locationIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return new PlatformDirectorySnapshot(users, organizations, locations);
    }

    public async Task<IReadOnlyDictionary<Guid, DirectoryUserEntry>> ReadUsersAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0)
        {
            return new Dictionary<Guid, DirectoryUserEntry>();
        }

        var users = await db.UserProfiles.AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        return users.ToDictionary(
            x => x.Id,
            x => new DirectoryUserEntry(
                x.Id,
                x.EmployeeId,
                x.FullName,
                x.Email,
                x.OrganizationUnitId,
                x.LocationId,
                x.Status));
    }

    public async Task<IReadOnlyList<DirectoryUserEntry>> SearchUsersAsync(
        string? search,
        IReadOnlyCollection<Guid>? organizationIds,
        int limit = 25,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var query = db.UserProfiles.AsNoTracking()
            .Where(x => x.Status == "active");

        if (organizationIds is { Count: > 0 })
        {
            var ids = organizationIds.ToArray();
            query = query.Where(x =>
                x.OrganizationUnitId.HasValue
                && ids.Contains(x.OrganizationUnitId.Value));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.FullName.ToLower().Contains(term)
                || x.Email.ToLower().Contains(term)
                || x.EmployeeId.ToLower().Contains(term));
        }

        return await query
            .OrderBy(x => x.FullName)
            .Take(limit)
            .Select(x => new DirectoryUserEntry(
                x.Id,
                x.EmployeeId,
                x.FullName,
                x.Email,
                x.OrganizationUnitId,
                x.LocationId,
                x.Status))
            .ToListAsync(cancellationToken);
    }
}
