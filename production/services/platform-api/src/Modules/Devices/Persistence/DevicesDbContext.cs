using INNO.One.Modules.Devices.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Persistence;

public sealed class DevicesDbContext(DbContextOptions<DevicesDbContext> options) : DbContext(options)
{
    public const string Schema = "devices";

    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceExternalMapping> DeviceExternalMappings => Set<DeviceExternalMapping>();
    public DbSet<DeviceGroup> DeviceGroups => Set<DeviceGroup>();
    public DbSet<DeviceGroupMember> DeviceGroupMembers => Set<DeviceGroupMember>();
    public DbSet<DiscoveryScan> DiscoveryScans => Set<DiscoveryScan>();
    public DbSet<DiscoveryResult> DiscoveryResults => Set<DiscoveryResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<Device>(entity =>
        {
            entity.ToTable("devices");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Hostname).IsUnique();
            entity.HasIndex(x => new { x.ConnectivityState, x.OrganizationUnitId, x.LastSeenAt });
            entity.HasIndex(x => x.OwnerUserId);
            entity.HasIndex(x => x.LocationId);
            entity.Property(x => x.Hostname).HasMaxLength(128);
            entity.Property(x => x.DeviceType).HasMaxLength(32);
            entity.Property(x => x.ConnectivityState).HasMaxLength(32);
            entity.Property(x => x.SerialNumber).HasMaxLength(128);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.MacAddress).HasMaxLength(64);
            entity.Property(x => x.OperatingSystem).HasMaxLength(200);
            entity.Property(x => x.Manufacturer).HasMaxLength(120);
            entity.Property(x => x.Model).HasMaxLength(200);
            entity.Property(x => x.MemoryUsedGb).HasPrecision(12, 2);
            entity.Property(x => x.MemoryTotalGb).HasPrecision(12, 2);
            entity.Property(x => x.DiskUsedGb).HasPrecision(12, 2);
            entity.Property(x => x.DiskTotalGb).HasPrecision(12, 2);
        });

        modelBuilder.Entity<DeviceExternalMapping>(entity =>
        {
            entity.ToTable("device_external_mappings");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.Provider, x.ExternalId }).IsUnique();
            entity.HasIndex(x => x.DeviceId);
            entity.Property(x => x.Provider).HasMaxLength(64);
            entity.Property(x => x.ExternalId).HasMaxLength(512);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeviceGroup>(entity =>
        {
            entity.ToTable("device_groups");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.ExternalProvider, x.ExternalGroupId }).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.GroupType).HasMaxLength(32);
            entity.Property(x => x.ExternalProvider).HasMaxLength(64);
            entity.Property(x => x.ExternalGroupId).HasMaxLength(512);
            entity.Property(x => x.SyncStatus).HasMaxLength(32).HasDefaultValue("local");
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<DeviceGroupMember>(entity =>
        {
            entity.ToTable("device_group_members");
            entity.HasKey(x => new { x.GroupId, x.DeviceId });
            entity.HasOne<DeviceGroup>().WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.DeviceId);
        });

        modelBuilder.Entity<DiscoveryScan>(entity =>
        {
            entity.ToTable("discovery_scans");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OperationId).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.Property(x => x.RangesJson).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.ErrorCode).HasMaxLength(128);
        });

        modelBuilder.Entity<DiscoveryResult>(entity =>
        {
            entity.ToTable("discovery_results");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.ScanId, x.IpAddress }).IsUnique();
            entity.HasIndex(x => x.MatchedDeviceId);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.Hostname).HasMaxLength(255);
            entity.Property(x => x.DetectedOperatingSystem).HasMaxLength(200);
            entity.Property(x => x.Vendor).HasMaxLength(200);
            entity.Property(x => x.DiscoveryMethod).HasMaxLength(64);
            entity.Property(x => x.ManagementStatus).HasMaxLength(32);
            entity.HasOne<DiscoveryScan>().WithMany().HasForeignKey(x => x.ScanId).OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}
