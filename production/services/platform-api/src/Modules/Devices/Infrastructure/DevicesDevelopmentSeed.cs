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
    }
}
