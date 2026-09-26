using INNO.One.Contracts.Directory;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class DeviceDirectoryReader(DevicesDbContext db) : IDeviceDirectoryReader
{
    public async Task<IReadOnlyDictionary<Guid, DeviceDirectoryEntry>> ReadAsync(
        IReadOnlyCollection<Guid> deviceIds,
        CancellationToken cancellationToken = default)
    {
        if (deviceIds.Count == 0)
        {
            return new Dictionary<Guid, DeviceDirectoryEntry>();
        }

        var ids = deviceIds.Distinct().ToArray();
        var devices = await db.Devices.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .ToListAsync(cancellationToken);

        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => ids.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);

        var groupsByDevice = memberships
            .GroupBy(x => x.DeviceId)
            .ToDictionary(
                x => x.Key,
                x => (IReadOnlySet<Guid>)x.Select(y => y.GroupId).ToHashSet());

        return devices.ToDictionary(
            x => x.Id,
            x => new DeviceDirectoryEntry(
                x.Id,
                x.Hostname,
                x.DeviceType,
                x.ConnectivityState,
                x.OperatingSystem,
                x.IpAddress,
                x.OwnerUserId,
                x.OrganizationUnitId,
                x.LocationId,
                groupsByDevice.GetValueOrDefault(x.Id) ?? new HashSet<Guid>()));
    }
}
