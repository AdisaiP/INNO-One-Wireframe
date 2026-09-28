using INNO.One.Contracts.Directory;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class DeviceSoftwareInventoryReader(DevicesDbContext db) : IDeviceSoftwareInventoryReader
{
    public async Task<IReadOnlyDictionary<Guid, DeviceSoftwareInventoryEntry>> ReadLatestAsync(
        IReadOnlyCollection<Guid> deviceIds,
        CancellationToken cancellationToken = default)
    {
        if (deviceIds.Count == 0)
        {
            return new Dictionary<Guid, DeviceSoftwareInventoryEntry>();
        }

        var ids = deviceIds.Distinct().ToArray();
        var snapshots = await db.SoftwareInventorySnapshots.AsNoTracking()
            .Where(x => ids.Contains(x.DeviceId))
            .OrderByDescending(x => x.ObservedAt)
            .ThenByDescending(x => x.ReceivedAt)
            .ToListAsync(cancellationToken);

        var latest = snapshots.GroupBy(x => x.DeviceId).Select(x => x.First()).ToArray();
        var snapshotIds = latest.Select(x => x.Id).ToArray();
        var packages = await db.InstalledSoftware.AsNoTracking()
            .Where(x => snapshotIds.Contains(x.SnapshotId))
            .OrderBy(x => x.DisplayName)
            .ToListAsync(cancellationToken);

        return latest.ToDictionary(
            x => x.DeviceId,
            x => new DeviceSoftwareInventoryEntry(
                x.Id,
                x.DeviceId,
                x.ObservedAt,
                x.ReceivedAt,
                x.Completeness,
                x.Source,
                x.SourceInstance,
                packages.Where(p => p.SnapshotId == x.Id)
                    .Select(p => new DeviceSoftwarePackage(
                        p.ProductKey, p.DisplayName, p.Version, p.Publisher, p.Architecture))
                    .ToArray()));
    }
}
