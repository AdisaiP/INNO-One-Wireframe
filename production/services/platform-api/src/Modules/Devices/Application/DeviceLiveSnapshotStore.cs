using System.Collections.Concurrent;
using INNO.One.Contracts.Integrations;

namespace INNO.One.Modules.Devices.Application;

public sealed class DeviceLiveSnapshotStore
{
    private static readonly TimeSpan SnapshotLifetime = TimeSpan.FromSeconds(60);

    private readonly ConcurrentDictionary<Guid, DeviceProcessSnapshot> _processes = new();
    private readonly ConcurrentDictionary<Guid, DeviceServiceSnapshot> _services = new();

    public DeviceProcessSnapshot AddProcesses(
        Guid deviceId,
        IReadOnlyList<RemoteProcessInfo> items,
        string source)
    {
        CleanupExpired();
        var now = DateTimeOffset.UtcNow;
        var snapshot = new DeviceProcessSnapshot(
            Guid.NewGuid(),
            deviceId,
            now,
            now.Add(SnapshotLifetime),
            source,
            items.ToArray());
        _processes[snapshot.Id] = snapshot;
        return snapshot;
    }

    public DeviceServiceSnapshot AddServices(
        Guid deviceId,
        IReadOnlyList<RemoteServiceInfo> items,
        string source)
    {
        CleanupExpired();
        var now = DateTimeOffset.UtcNow;
        var snapshot = new DeviceServiceSnapshot(
            Guid.NewGuid(),
            deviceId,
            now,
            now.Add(SnapshotLifetime),
            source,
            items.ToArray());
        _services[snapshot.Id] = snapshot;
        return snapshot;
    }

    public DeviceProcessSnapshot? GetProcesses(Guid deviceId, Guid snapshotId)
    {
        CleanupExpired();
        return _processes.TryGetValue(snapshotId, out var snapshot)
            && snapshot.DeviceId == deviceId
            && snapshot.ExpiresAt > DateTimeOffset.UtcNow
                ? snapshot
                : null;
    }

    public DeviceServiceSnapshot? GetServices(Guid deviceId, Guid snapshotId)
    {
        CleanupExpired();
        return _services.TryGetValue(snapshotId, out var snapshot)
            && snapshot.DeviceId == deviceId
            && snapshot.ExpiresAt > DateTimeOffset.UtcNow
                ? snapshot
                : null;
    }

    private void CleanupExpired()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var item in _processes)
        {
            if (item.Value.ExpiresAt <= now)
            {
                _processes.TryRemove(item.Key, out _);
            }
        }

        foreach (var item in _services)
        {
            if (item.Value.ExpiresAt <= now)
            {
                _services.TryRemove(item.Key, out _);
            }
        }
    }
}

public sealed record DeviceProcessSnapshot(
    Guid Id,
    Guid DeviceId,
    DateTimeOffset ObservedAt,
    DateTimeOffset ExpiresAt,
    string Source,
    IReadOnlyList<RemoteProcessInfo> Items);

public sealed record DeviceServiceSnapshot(
    Guid Id,
    Guid DeviceId,
    DateTimeOffset ObservedAt,
    DateTimeOffset ExpiresAt,
    string Source,
    IReadOnlyList<RemoteServiceInfo> Items);
