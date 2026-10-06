using INNO.One.Modules.Devices.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Persistence;

public sealed class DevicesDbContext(DbContextOptions<DevicesDbContext> options) : DbContext(options)
{
    public const string Schema = "devices";

    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceExternalMapping> DeviceExternalMappings => Set<DeviceExternalMapping>();
    public DbSet<DeviceInventorySnapshot> DeviceInventorySnapshots => Set<DeviceInventorySnapshot>();
    public DbSet<DevicePerformanceSample> DevicePerformanceSamples => Set<DevicePerformanceSample>();
    public DbSet<RemoteConsentRequest> RemoteConsentRequests => Set<RemoteConsentRequest>();
    public DbSet<RemoteSession> RemoteSessions => Set<RemoteSession>();
    public DbSet<AgentPrompt> AgentPrompts => Set<AgentPrompt>();
    public DbSet<DeviceGroup> DeviceGroups => Set<DeviceGroup>();
    public DbSet<DeviceGroupMember> DeviceGroupMembers => Set<DeviceGroupMember>();
    public DbSet<DiscoveryScan> DiscoveryScans => Set<DiscoveryScan>();
    public DbSet<DiscoveryResult> DiscoveryResults => Set<DiscoveryResult>();
    public DbSet<DeviceSoftwareInventorySnapshot> SoftwareInventorySnapshots => Set<DeviceSoftwareInventorySnapshot>();
    public DbSet<DeviceInstalledSoftware> InstalledSoftware => Set<DeviceInstalledSoftware>();
    public DbSet<InventoryQuery> InventoryQueries => Set<InventoryQuery>();
    public DbSet<InventoryQueryRun> InventoryQueryRuns => Set<InventoryQueryRun>();
    public DbSet<InventoryQueryResult> InventoryQueryResults => Set<InventoryQueryResult>();
    public DbSet<DeploymentJob> DeploymentJobs => Set<DeploymentJob>();
    public DbSet<AgentRollout> AgentRollouts => Set<AgentRollout>();
    public DbSet<MaintenanceJob> MaintenanceJobs => Set<MaintenanceJob>();

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

        modelBuilder.Entity<DevicePerformanceSample>(entity =>
        {
            entity.ToTable("device_performance_samples");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt });
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt, x.Source }).IsUnique();
            entity.Property(x => x.Source).HasMaxLength(64);
            entity.Property(x => x.SourceInstance).HasMaxLength(160);
            entity.Property(x => x.MemoryUsedGb).HasPrecision(12, 2);
            entity.Property(x => x.MemoryTotalGb).HasPrecision(12, 2);
            entity.Property(x => x.DiskUsedGb).HasPrecision(12, 2);
            entity.Property(x => x.DiskTotalGb).HasPrecision(12, 2);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeviceInventorySnapshot>(entity =>
        {
            entity.ToTable("device_inventory_snapshots");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt });
            entity.HasIndex(x => new { x.DeviceId, x.ObservedAt, x.Source }).IsUnique();
            entity.Property(x => x.Completeness).HasMaxLength(16);
            entity.Property(x => x.Source).HasMaxLength(64);
            entity.Property(x => x.SourceInstance).HasMaxLength(160);
            entity.Property(x => x.Manufacturer).HasMaxLength(120);
            entity.Property(x => x.Model).HasMaxLength(200);
            entity.Property(x => x.SerialNumber).HasMaxLength(128);
            entity.Property(x => x.Processor).HasMaxLength(240);
            entity.Property(x => x.BiosVersion).HasMaxLength(120);
            entity.Property(x => x.OperatingSystem).HasMaxLength(200);
            entity.Property(x => x.MemoryTotalGb).HasPrecision(12, 2);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.MacAddress).HasMaxLength(64);
            entity.Property(x => x.NetworkSource).HasMaxLength(64);
            entity.Property(x => x.NetworkSourceInstance).HasMaxLength(160);
            entity.Property(x => x.SubnetMask).HasMaxLength(64);
            entity.Property(x => x.Gateway).HasMaxLength(64);
            entity.Property(x => x.DnsServers).HasMaxLength(512);
            entity.Property(x => x.NetworkAdapterName).HasMaxLength(240);
            entity.Property(x => x.PacketLossPercent).HasPrecision(7, 3);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AgentPrompt>(entity =>
        {
            entity.ToTable("agent_prompts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.Status, x.ExpiresAt });
            entity.HasIndex(x => new { x.SourceModule, x.SourceReference });
            entity.Property(x => x.SourceModule).HasMaxLength(64);
            entity.Property(x => x.SourceReference).HasMaxLength(160);
            entity.Property(x => x.PromptType).HasMaxLength(32);
            entity.Property(x => x.TitleTh).HasMaxLength(240);
            entity.Property(x => x.TitleEn).HasMaxLength(240);
            entity.Property(x => x.MessageTh).HasMaxLength(2000);
            entity.Property(x => x.MessageEn).HasMaxLength(2000);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.ResponseKey).HasMaxLength(32);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RemoteConsentRequest>(entity =>
        {
            entity.ToTable("remote_consent_requests");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.Status, x.ExpiresAt });
            entity.HasIndex(x => x.RemoteSessionId).IsUnique();
            entity.HasIndex(x => x.RequestedByUserId);
            entity.HasIndex(x => x.DecidedByUserId);
            entity.Property(x => x.OperatorName).HasMaxLength(160);
            entity.Property(x => x.OperatorRole).HasMaxLength(160);
            entity.Property(x => x.Mode).HasMaxLength(64);
            entity.Property(x => x.MessageTh).HasMaxLength(2000);
            entity.Property(x => x.MessageEn).HasMaxLength(2000);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RemoteSession>(entity =>
        {
            entity.ToTable("remote_sessions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.DeviceId, x.Status, x.RequestedAt });
            entity.HasIndex(x => new { x.OperatorUserId, x.RequestedAt });
            entity.HasIndex(x => x.ConsentRequestId).IsUnique();
            entity.Property(x => x.Mode).HasMaxLength(32);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.ExternalShareId).HasMaxLength(512);
            entity.Property(x => x.LaunchUrl).HasMaxLength(4000);
            entity.Property(x => x.EndReason).HasMaxLength(64);
            entity.Property(x => x.FailureCode).HasMaxLength(64);
            entity.HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
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

        modelBuilder.Entity<DeploymentJob>(entity =>
        {
            entity.ToTable("deployment_jobs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OperationId).IsUnique();
            entity.HasIndex(x => x.JobNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TargetScopeType, x.TargetScopeId });
            entity.Property(x => x.JobNumber).HasMaxLength(64);
            entity.Property(x => x.DeploymentType).HasMaxLength(32);
            entity.Property(x => x.TargetScopeType).HasMaxLength(32);
            entity.Property(x => x.TargetDefinitionJson).HasColumnType("jsonb");
            entity.Property(x => x.TargetLabel).HasMaxLength(240);
            entity.Property(x => x.PayloadName).HasMaxLength(300);
            entity.Property(x => x.ProfileOrDestination).HasMaxLength(300);
            entity.Property(x => x.ScheduleMode).HasMaxLength(32);
            entity.Property(x => x.MaintenanceWindow).HasMaxLength(120);
            entity.Property(x => x.RestartPolicy).HasMaxLength(64);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<AgentRollout>(entity =>
        {
            entity.ToTable("agent_rollouts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OperationId).IsUnique();
            entity.HasIndex(x => x.RolloutNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TargetScopeType, x.TargetScopeId });
            entity.Property(x => x.RolloutNumber).HasMaxLength(64);
            entity.Property(x => x.ReleaseVersion).HasMaxLength(120);
            entity.Property(x => x.TargetScopeType).HasMaxLength(32);
            entity.Property(x => x.TargetDefinitionJson).HasColumnType("jsonb");
            entity.Property(x => x.TargetLabel).HasMaxLength(240);
            entity.Property(x => x.MaintenanceWindow).HasMaxLength(120);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<MaintenanceJob>(entity =>
        {
            entity.ToTable("maintenance_jobs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.OperationId).IsUnique();
            entity.HasIndex(x => x.JobNumber).IsUnique();
            entity.HasIndex(x => new { x.MaintenanceType, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TargetScopeType, x.TargetScopeId });
            entity.Property(x => x.JobNumber).HasMaxLength(64);
            entity.Property(x => x.MaintenanceType).HasMaxLength(32);
            entity.Property(x => x.Action).HasMaxLength(64);
            entity.Property(x => x.PackageName).HasMaxLength(300);
            entity.Property(x => x.TargetScopeType).HasMaxLength(32);
            entity.Property(x => x.TargetDefinitionJson).HasColumnType("jsonb");
            entity.Property(x => x.TargetLabel).HasMaxLength(240);
            entity.Property(x => x.ScheduleMode).HasMaxLength(32);
            entity.Property(x => x.MaintenanceWindow).HasMaxLength(120);
            entity.Property(x => x.RestartPolicy).HasMaxLength(64);
            entity.Property(x => x.UserMessage).HasMaxLength(2000);
            entity.Property(x => x.OfflinePolicy).HasMaxLength(64);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        base.OnModelCreating(modelBuilder);
    }
}
