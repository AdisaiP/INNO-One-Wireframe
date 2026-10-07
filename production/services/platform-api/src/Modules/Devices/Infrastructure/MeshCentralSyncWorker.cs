using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Integrations;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class MeshCentralSyncWorker(
    IServiceScopeFactory scopeFactory,
    IRemoteDeviceEngine remoteEngine,
    IConfiguration configuration,
    ILogger<MeshCentralSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!remoteEngine.IsEnabled)
        {
            logger.LogInformation("MeshCentral sync worker is disabled.");
            return;
        }

        var intervalSeconds = Math.Clamp(
            configuration.GetValue("MeshCentral:SyncIntervalSeconds", 15),
            3,
            300);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "MeshCentral synchronization failed.");
                await MarkGroupsErrorAsync(stoppingToken);
            }

            await Task.Delay(TimeSpan.FromSeconds(intervalSeconds), stoppingToken);
        }
    }

    public async Task SyncOnceAsync(CancellationToken cancellationToken = default)
    {
        var nodes = (await remoteEngine.ListNodesAsync(cancellationToken))
            .GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Select(group => group
                .OrderByDescending(x => x.IsOnline)
                .First())
            .ToList();

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<DeviceLedgerWriter>();

        var mappedGroups = await db.DeviceGroups
            .Where(x => x.ExternalProvider == "meshcentral"
                && x.ExternalGroupId != null
                && x.Status == "active")
            .ToListAsync(cancellationToken);

        if (mappedGroups.Count == 0)
        {
            return;
        }

        var groupsByExternal = mappedGroups.ToDictionary(
            x => x.ExternalGroupId!,
            StringComparer.Ordinal);

        var mappings = await db.DeviceExternalMappings
            .Where(x => x.Provider == "meshcentral")
            .ToListAsync(cancellationToken);
        var mappingByExternal = mappings.ToDictionary(
            x => x.ExternalId,
            StringComparer.Ordinal);

        var mappedGroupIds = mappedGroups.Select(x => x.Id).ToArray();
        var memberships = await db.DeviceGroupMembers
            .Where(x => mappedGroupIds.Contains(x.GroupId))
            .ToListAsync(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;

        foreach (var node in nodes)
        {
            if (!groupsByExternal.TryGetValue(node.ExternalGroupId, out var group))
            {
                continue;
            }

            Device device;
            string previousState;

            if (!mappingByExternal.TryGetValue(node.ExternalId, out var mapping))
            {
                var existingDevice = await db.Devices
                    .SingleOrDefaultAsync(
                        x => x.Hostname.ToLower() == node.Name.ToLower(),
                        cancellationToken);

                if (existingDevice is null)
                {
                    device = new Device
                    {
                        Id = Guid.NewGuid(),
                        Hostname = node.Name,
                        DeviceType = DeviceTypeFromIcon(node.Icon),
                        ConnectivityState = node.IsOnline ? "online" : "offline",
                        OrganizationUnitId = group.OrganizationUnitId,
                        LocationId = group.LocationId,
                        IpAddress = node.IpAddress,
                        OperatingSystem = node.OperatingSystem,
                        AgentVersion = node.AgentVersion,
                        LastSeenAt = node.IsOnline ? now : null,
                        Version = 1,
                        CreatedAt = now,
                        UpdatedAt = now
                    };
                    db.Devices.Add(device);

                    mapping = new DeviceExternalMapping
                    {
                        Id = Guid.NewGuid(),
                        DeviceId = device.Id,
                        Provider = "meshcentral",
                        ExternalId = node.ExternalId,
                        UpdatedAt = now
                    };
                    db.DeviceExternalMappings.Add(mapping);
                    mappings.Add(mapping);
                    mappingByExternal[node.ExternalId] = mapping;
                    previousState = "unknown";
                }
                else
                {
                    device = existingDevice;
                    previousState = device.ConnectivityState;

                    mapping = mappings.FirstOrDefault(x =>
                        x.DeviceId == device.Id
                        && x.Provider == "meshcentral");

                    if (mapping is null)
                    {
                        mapping = new DeviceExternalMapping
                        {
                            Id = Guid.NewGuid(),
                            DeviceId = device.Id,
                            Provider = "meshcentral",
                            ExternalId = node.ExternalId,
                            UpdatedAt = now
                        };
                        db.DeviceExternalMappings.Add(mapping);
                        mappings.Add(mapping);
                    }
                    else
                    {
                        mappingByExternal.Remove(mapping.ExternalId);
                        mapping.ExternalId = node.ExternalId;
                        mapping.UpdatedAt = now;
                    }

                    mappingByExternal[node.ExternalId] = mapping;

                    device.Hostname = node.Name;
                    device.DeviceType = DeviceTypeFromIcon(node.Icon);
                    device.ConnectivityState = node.IsOnline ? "online" : "offline";
                    device.OrganizationUnitId = group.OrganizationUnitId;
                    device.LocationId = group.LocationId;
                    device.IpAddress = node.IpAddress ?? device.IpAddress;
                    device.OperatingSystem = node.OperatingSystem ?? device.OperatingSystem;
                    device.AgentVersion = node.AgentVersion ?? device.AgentVersion;
                    if (node.IsOnline)
                    {
                        device.LastSeenAt = now;
                    }
                    device.Version++;
                    device.UpdatedAt = now;
                }
            }
            else
            {
                device = await db.Devices
                    .SingleAsync(x => x.Id == mapping.DeviceId, cancellationToken);
                previousState = device.ConnectivityState;

                device.Hostname = node.Name;
                device.DeviceType = DeviceTypeFromIcon(node.Icon);
                device.ConnectivityState = node.IsOnline ? "online" : "offline";
                device.OrganizationUnitId = group.OrganizationUnitId;
                device.LocationId = group.LocationId;
                device.IpAddress = node.IpAddress ?? device.IpAddress;
                device.OperatingSystem = node.OperatingSystem ?? device.OperatingSystem;
                device.AgentVersion = node.AgentVersion ?? device.AgentVersion;
                if (node.IsOnline)
                {
                    device.LastSeenAt = now;
                }
                device.Version++;
                device.UpdatedAt = now;
                mapping.UpdatedAt = now;
            }

            var oldProviderMemberships = memberships
                .Where(x => x.DeviceId == device.Id && x.GroupId != group.Id)
                .ToArray();
            if (oldProviderMemberships.Length > 0)
            {
                db.DeviceGroupMembers.RemoveRange(oldProviderMemberships);
                foreach (var old in oldProviderMemberships)
                {
                    memberships.Remove(old);
                }
            }

            if (!memberships.Any(x => x.DeviceId == device.Id && x.GroupId == group.Id))
            {
                var member = new DeviceGroupMember
                {
                    GroupId = group.Id,
                    DeviceId = device.Id,
                    ResolvedAt = now
                };
                db.DeviceGroupMembers.Add(member);
                memberships.Add(member);
            }

            var currentState = node.IsOnline ? "online" : "offline";
            if (previousState != "unknown"
                && !string.Equals(previousState, currentState, StringComparison.Ordinal))
            {
                var publicDeviceId = OpaqueId.Format("dev", device.Id);
                if (node.IsOnline)
                {
                    await ledger.AppendOutboxAsync(
                        "device.online",
                        "device",
                        publicDeviceId,
                        new
                        {
                            deviceId = publicDeviceId,
                            onlineAt = now,
                            source = "meshcentral"
                        },
                        null,
                        null,
                        null,
                        cancellationToken);
                }
                else
                {
                    await ledger.AppendOutboxAsync(
                        "device.offline",
                        "device",
                        publicDeviceId,
                        new
                        {
                            deviceId = publicDeviceId,
                            offlineAt = now,
                            lastSeenAt = device.LastSeenAt,
                            source = "meshcentral"
                        },
                        null,
                        null,
                        null,
                        cancellationToken);
                }
            }
        }

        foreach (var group in mappedGroups)
        {
            group.SyncStatus = "synced";
            group.LastSyncedAt = now;
            group.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task MarkGroupsErrorAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var groups = await db.DeviceGroups
            .Where(x => x.ExternalProvider == "meshcentral"
                && x.ExternalGroupId != null
                && x.Status == "active")
            .ToListAsync(cancellationToken);

        foreach (var group in groups)
        {
            group.SyncStatus = "error";
            group.UpdatedAt = DateTimeOffset.UtcNow;
        }

        if (groups.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static string DeviceTypeFromIcon(int? icon) =>
        icon switch
        {
            2 => "notebook",
            3 => "server",
            4 => "mobile",
            _ => "desktop"
        };
}
