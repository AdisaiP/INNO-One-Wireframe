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
    public DbSet<DeviceSoftwareInventorySnapshot> SoftwareInventorySnapshots => Set<DeviceSoftwareInventorySnapshot>();
    public DbSet<DeviceInstalledSoftware> InstalledSoftware => Set<DeviceInstalledSoftware>();
    public DbSet<InventoryQuery> InventoryQueries => Set<InventoryQuery>();
    public DbSet<InventoryQueryRun> InventoryQueryRuns => Set<InventoryQueryRun>();
    public DbSet<InventoryQueryResult> InventoryQueryResults => Set<InventoryQueryResult>();

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

        modelBuilder.Entity<DeviceSoftwareInventorySnapshot>(entity =>
        {
            entity.ToTable("software_inventory_snapshots");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt });
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt, x.Source }).IsUnique();
            entity.Property(x => x.Completeness).HasMaxLength(16);
            entity.Property(x => x.Source).HasMaxLength(64);
            entity.Property(x => x.SourceInstance).HasMaxLength(160);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeviceInstalledSoftware>(entity =>
        {
            entity.ToTable("installed_software");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.SnapshotId, x.ProductKey }).IsUnique();
            entity.Property(x => x.ProductKey).HasMaxLength(240);
            entity.Property(x => x.DisplayName).HasMaxLength(300);
            entity.Property(x => x.Version).HasMaxLength(120);
            entity.Property(x => x.Publisher).HasMaxLength(200);
            entity.Property(x => x.Architecture).HasMaxLength(32);
            entity.HasOne<DeviceSoftwareInventorySnapshot>().WithMany().HasForeignKey(x => x.SnapshotId).OnDelete(DeleteBehavior.Cascade);
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

        modelBuilder.Entity<InventoryQuery>(entity =>
        {
            entity.ToTable("inventory_queries");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.CreatedByUserId, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.Status, x.UpdatedAt });
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.FactType).HasMaxLength(32);
            entity.Property(x => x.Field).HasMaxLength(64);
            entity.Property(x => x.Operator).HasMaxLength(64);
            entity.Property(x => x.Value).HasMaxLength(500);
            entity.Property(x => x.ScopeType).HasMaxLength(32);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<InventoryQueryRun>(entity =>
        {
            entity.ToTable("inventory_query_runs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OperationId).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.Property(x => x.DefinitionJson).HasColumnType("jsonb");
            entity.Property(x => x.AccessScopeJson).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.ErrorCode).HasMaxLength(128);
            entity.HasOne<InventoryQuery>().WithMany().HasForeignKey(x => x.SavedQueryId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<InventoryQueryResult>(entity =>
        {
            entity.ToTable("inventory_query_results");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.RunId, x.DeviceId });
            entity.Property(x => x.FactType).HasMaxLength(32);
            entity.Property(x => x.FactName).HasMaxLength(300);
            entity.Property(x => x.FactVersion).HasMaxLength(120);
            entity.Property(x => x.FactPublisher).HasMaxLength(200);
            entity.Property(x => x.MatchedValue).HasMaxLength(600);
            entity.HasOne<InventoryQueryRun>().WithMany().HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}
