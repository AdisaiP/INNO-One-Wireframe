using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Infrastructure;

public static class DevicesDevelopmentSeed
{
    private static readonly Guid UserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid DigitalTechnologyId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static readonly Guid HumanResourcesId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    private static readonly Guid FinanceId = Guid.Parse("20000000-0000-0000-0000-000000000004");
    private static readonly Guid BangkokLocationId = Guid.Parse("30000000-0000-0000-0000-000000000001");

    public static async Task SeedAsync(DevicesDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.Devices.AnyAsync(cancellationToken))
        {
            var groups = await db.DeviceGroups.ToListAsync(cancellationToken);
            foreach (var group in groups)
            {
                if (group.Id == Guid.Parse("81000000-0000-0000-0000-000000000001"))
                {
                    group.OrganizationUnitId ??= HumanResourcesId;
                    group.LocationId ??= BangkokLocationId;
                }
                else if (group.Id == Guid.Parse("81000000-0000-0000-0000-000000000002"))
                {
                    group.OrganizationUnitId ??= DigitalTechnologyId;
                    group.LocationId ??= BangkokLocationId;
                }
                else if (group.Id == Guid.Parse("81000000-0000-0000-0000-000000000003"))
                {
                    group.OrganizationUnitId ??= FinanceId;
                    group.LocationId ??= BangkokLocationId;
                }

                if (string.IsNullOrWhiteSpace(group.SyncStatus))
                {
                    group.SyncStatus = "local";
                }
            }

            if (groups.Count > 0)
            {
                await db.SaveChangesAsync(cancellationToken);
            }

            await SeedHardwareInventoryAsync(db, cancellationToken);
            await SeedSoftwareInventoryAsync(db, cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var hrGroup = Guid.Parse("81000000-0000-0000-0000-000000000001");
        var itGroup = Guid.Parse("81000000-0000-0000-0000-000000000002");
        var financeGroup = Guid.Parse("81000000-0000-0000-0000-000000000003");

        db.DeviceGroups.AddRange(
            new DeviceGroup
            {
                Id = hrGroup, Code = "HR-BKK", Name = "HR / Bangkok", GroupType = "static",
                OrganizationUnitId = HumanResourcesId, LocationId = BangkokLocationId,
                SyncStatus = "local", Status = "active", CreatedAt = now, UpdatedAt = now
            },
            new DeviceGroup
            {
                Id = itGroup, Code = "IT-OPS", Name = "IT Operations", GroupType = "static",
                OrganizationUnitId = DigitalTechnologyId, LocationId = BangkokLocationId,
                SyncStatus = "local", Status = "active", CreatedAt = now, UpdatedAt = now
            },
            new DeviceGroup
            {
                Id = financeGroup, Code = "FIN", Name = "Finance", GroupType = "static",
                OrganizationUnitId = FinanceId, LocationId = BangkokLocationId,
                SyncStatus = "local", Status = "active", CreatedAt = now, UpdatedAt = now
            });

        var devices = new[]
        {
            new Device
            {
                Id = Guid.Parse("80000000-0000-0000-0000-000000000001"),
                Hostname = "DESKTOP-HR-014", DeviceType = "desktop", ConnectivityState = "online",
                OrganizationUnitId = HumanResourcesId,
                LocationId = BangkokLocationId,
                SerialNumber = "DL7K-88421", IpAddress = "10.20.3.14", MacAddress = "48:2A:E3:10:89:3C",
                OperatingSystem = "Windows 11 Pro 23H2", Manufacturer = "Dell", Model = "OptiPlex 7010",
                Processor = "Intel Core i7-13700", BiosVersion = "1.14.0", LoggedOnUser = "CORP\\somchai.p",
                AssetReference = "AST-PC-000142", AgentVersion = "1.8.4", LastSeenAt = now,
                CpuPercent = 32, MemoryUsedGb = 19.5m, MemoryTotalGb = 32m, DiskUsedGb = 378m, DiskTotalGb = 512m,
                CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                Id = Guid.Parse("80000000-0000-0000-0000-000000000002"),
                Hostname = "NOTEBOOK-IT-003", DeviceType = "notebook", ConnectivityState = "online",
                OwnerUserId = UserId,
                OrganizationUnitId = DigitalTechnologyId,
                LocationId = BangkokLocationId,
                SerialNumber = "LNV-23314", IpAddress = "10.20.1.33", MacAddress = "A4:91:B1:20:44:18",
                OperatingSystem = "Windows 11 Pro 24H2", Manufacturer = "Lenovo", Model = "ThinkPad T14",
                Processor = "Intel Core Ultra 7", BiosVersion = "1.22", LoggedOnUser = "CORP\\adisai",
                AssetReference = "AST-NB-000003", AgentVersion = "1.8.4", LastSeenAt = now.AddMinutes(-2),
                CpuPercent = 19, MemoryUsedGb = 11.2m, MemoryTotalGb = 32m, DiskUsedGb = 220m, DiskTotalGb = 512m,
                CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                Id = Guid.Parse("80000000-0000-0000-0000-000000000003"),
                Hostname = "SRV-APP-01", DeviceType = "server", ConnectivityState = "online",
                OrganizationUnitId = DigitalTechnologyId,
                LocationId = BangkokLocationId,
                SerialNumber = "HPE-77801", IpAddress = "10.20.10.5", MacAddress = "30:9C:23:11:42:99",
                OperatingSystem = "Windows Server 2025", Manufacturer = "HPE", Model = "ProLiant DL360",
                Processor = "Intel Xeon Gold", BiosVersion = "U46 v2.10", LoggedOnUser = null,
                AgentVersion = "1.8.4", LastSeenAt = now,
                CpuPercent = 21, MemoryUsedGb = 48m, MemoryTotalGb = 128m, DiskUsedGb = 720m, DiskTotalGb = 2048m,
                CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                Id = Guid.Parse("80000000-0000-0000-0000-000000000004"),
                Hostname = "VM-FIN-02", DeviceType = "virtual", ConnectivityState = "offline",
                OrganizationUnitId = FinanceId,
                LocationId = BangkokLocationId,
                SerialNumber = "VM-90212", IpAddress = "10.20.6.22", MacAddress = "00:50:56:A1:02:22",
                OperatingSystem = "Windows 10 Enterprise", Manufacturer = "VMware", Model = "Virtual Platform",
                Processor = "4 vCPU", BiosVersion = "VMW71.00V", LoggedOnUser = "CORP\\finance",
                AgentVersion = "1.8.3", LastSeenAt = now.AddHours(-3),
                CpuPercent = 0, MemoryUsedGb = 0, MemoryTotalGb = 16m, DiskUsedGb = 90m, DiskTotalGb = 160m,
                CreatedAt = now, UpdatedAt = now
            }
        };

        db.Devices.AddRange(devices);
        db.DeviceGroupMembers.AddRange(
            new DeviceGroupMember { GroupId = hrGroup, DeviceId = devices[0].Id, ResolvedAt = now },
            new DeviceGroupMember { GroupId = itGroup, DeviceId = devices[1].Id, ResolvedAt = now },
            new DeviceGroupMember { GroupId = itGroup, DeviceId = devices[2].Id, ResolvedAt = now },
            new DeviceGroupMember { GroupId = financeGroup, DeviceId = devices[3].Id, ResolvedAt = now });

        db.DeviceExternalMappings.AddRange(devices.Select((device, index) => new DeviceExternalMapping
        {
            Id = Guid.Parse($"82000000-0000-0000-0000-{(index + 1).ToString().PadLeft(12, '0')}"),
            DeviceId = device.Id,
            Provider = "meshcentral",
            ExternalId = $"node/mesh-step15-{index + 1}",
            UpdatedAt = now
        }));

        await db.SaveChangesAsync(cancellationToken);
        await SeedHardwareInventoryAsync(db, cancellationToken);
        await SeedSoftwareInventoryAsync(db, cancellationToken);
    }

    private static async Task SeedHardwareInventoryAsync(
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.DeviceInventorySnapshots.AnyAsync(cancellationToken))
        {
            return;
        }

        var devices = await db.Devices.AsNoTracking().OrderBy(x => x.Hostname).ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        foreach (var device in devices)
        {
            var observedAt = device.LastSeenAt ?? device.UpdatedAt;
            db.DeviceInventorySnapshots.Add(new DeviceInventorySnapshot
            {
                Id = Guid.NewGuid(),
                DeviceId = device.Id,
                ObservedAt = observedAt,
                ReceivedAt = now,
                Completeness = "partial",
                Source = "development_seed",
                SourceInstance = "seed",
                Manufacturer = device.Manufacturer,
                Model = device.Model,
                SerialNumber = device.SerialNumber,
                Processor = device.Processor,
                BiosVersion = device.BiosVersion,
                OperatingSystem = device.OperatingSystem,
                MemoryTotalGb = device.MemoryTotalGb,
                MemorySlotsUsed = device.MemoryTotalGb is null ? null : device.DeviceType == "server" ? 4 : 2,
                MemorySlotsTotal = device.MemoryTotalGb is null ? null : device.DeviceType == "server" ? 8 : 4,
                IpAddress = device.IpAddress,
                MacAddress = device.MacAddress
            });
        }

        if (devices.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task SeedSoftwareInventoryAsync(
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.SoftwareInventorySnapshots.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var snapshots = new[]
        {
            Snapshot("83000000-0000-0000-0000-000000000001", "80000000-0000-0000-0000-000000000001", now.AddMinutes(-8), "complete", 4),
            Snapshot("83000000-0000-0000-0000-000000000002", "80000000-0000-0000-0000-000000000002", now.AddMinutes(-12), "complete", 4),
            Snapshot("83000000-0000-0000-0000-000000000003", "80000000-0000-0000-0000-000000000003", now.AddHours(-2), "partial", 2)
        };
        db.SoftwareInventorySnapshots.AddRange(snapshots);
        db.InstalledSoftware.AddRange(
            Package("83100000-0000-0000-0000-000000000001", snapshots[0].Id, "microsoft:365-apps", "Microsoft 365 Apps", "2408", "Microsoft Corporation", "x64"),
            Package("83100000-0000-0000-0000-000000000002", snapshots[0].Id, "google:chrome", "Google Chrome", "129.0.6668.71", "Google LLC", "x64"),
            Package("83100000-0000-0000-0000-000000000003", snapshots[0].Id, "7zip:7-zip", "7-Zip", "24.08", "Igor Pavlov", "x64"),
            Package("83100000-0000-0000-0000-000000000004", snapshots[0].Id, "inno:endpoint-agent", "INNO.One Endpoint Agent", "1.8.4", "Innovations Solutions and Service", "x64"),
            Package("83100000-0000-0000-0000-000000000005", snapshots[1].Id, "microsoft:visual-studio-code", "Visual Studio Code", "1.94.0", "Microsoft Corporation", "universal"),
            Package("83100000-0000-0000-0000-000000000006", snapshots[1].Id, "docker:desktop", "Docker Desktop", "4.34.3", "Docker Inc.", "x64"),
            Package("83100000-0000-0000-0000-000000000007", snapshots[1].Id, "git:git", "Git", "2.46.2", "Git Project", "x64"),
            Package("83100000-0000-0000-0000-000000000008", snapshots[1].Id, "inno:endpoint-agent", "INNO.One Endpoint Agent", "1.8.4", "Innovations Solutions and Service", "x64"),
            Package("83100000-0000-0000-0000-000000000009", snapshots[2].Id, "microsoft:dotnet-runtime", ".NET Runtime", "10.0.0", "Microsoft Corporation", "x64"),
            Package("83100000-0000-0000-0000-000000000010", snapshots[2].Id, "inno:endpoint-agent", "INNO.One Endpoint Agent", "1.8.4", "Innovations Solutions and Service", "x64"));
        await db.SaveChangesAsync(cancellationToken);

        static DeviceSoftwareInventorySnapshot Snapshot(
            string id, string deviceId, DateTimeOffset observedAt, string completeness, int packageCount) =>
            new()
            {
                Id = Guid.Parse(id),
                DeviceId = Guid.Parse(deviceId),
                ObservedAt = observedAt,
                ReceivedAt = observedAt.AddSeconds(4),
                Completeness = completeness,
                Source = "endpoint_agent",
                SourceInstance = "development-seed",
                PackageCount = packageCount
            };

        static DeviceInstalledSoftware Package(
            string id, Guid snapshotId, string key, string name, string version,
            string publisher, string architecture) =>
            new()
            {
                Id = Guid.Parse(id),
                SnapshotId = snapshotId,
                ProductKey = key,
                DisplayName = name,
                Version = version,
                Publisher = publisher,
                Architecture = architecture
            };
    }
}
