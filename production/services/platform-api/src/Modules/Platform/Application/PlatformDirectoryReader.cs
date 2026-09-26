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
}
