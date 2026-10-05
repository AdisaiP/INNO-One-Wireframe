using INNO.One.Modules.Platform.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Persistence;

public sealed class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public const string Schema = "platform";

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<OrganizationUnit> OrganizationUnits => Set<OrganizationUnit>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AccessAssignment> AccessAssignments => Set<AccessAssignment>();
    public DbSet<AccessAssignmentResource> AccessAssignmentResources => Set<AccessAssignmentResource>();
    public DbSet<AccessAssignmentAction> AccessAssignmentActions => Set<AccessAssignmentAction>();
    public DbSet<AppModule> AppModules => Set<AppModule>();
    public DbSet<PlatformLocalizationSettings> LocalizationSettings => Set<PlatformLocalizationSettings>();
    public DbSet<PlatformNotification> Notifications => Set<PlatformNotification>();
    public DbSet<PlatformActivityItem> ActivityItems => Set<PlatformActivityItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.ToTable("user_profiles");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.KeycloakSubject).IsUnique();
            entity.HasIndex(x => x.EmployeeId).IsUnique();
            entity.Property(x => x.KeycloakSubject).HasMaxLength(128);
            entity.Property(x => x.EmployeeId).HasMaxLength(64);
            entity.Property(x => x.FullName).HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.PreferredLocale).HasMaxLength(16);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<OrganizationUnit>().WithMany().HasForeignKey(x => x.OrganizationUnitId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Position>().WithMany().HasForeignKey(x => x.PositionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Location>().WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrganizationUnit>(entity =>
        {
            entity.ToTable("organization_units");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<OrganizationUnit>().WithMany().HasForeignKey(x => x.ParentUnitId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => new { x.ParentUnitId, x.Status });
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("locations");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<Location>().WithMany().HasForeignKey(x => x.ParentLocationId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Position>(entity =>
        {
            entity.ToTable("positions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("permissions");
            entity.HasKey(x => x.PermissionId);
            entity.Property(x => x.PermissionId).HasMaxLength(128);
            entity.Property(x => x.Module).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("role_permissions");
            entity.HasKey(x => new { x.RoleId, x.PermissionId });
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Permission>().WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AccessAssignment>(entity =>
        {
            entity.ToTable("access_assignments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SubjectType).HasMaxLength(32);
            entity.Property(x => x.ScopeType).HasMaxLength(32);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => new { x.SubjectType, x.SubjectId, x.Status });
        });

        modelBuilder.Entity<AccessAssignmentResource>(entity =>
        {
            entity.ToTable("access_assignment_resources");
            entity.HasKey(x => new { x.AssignmentId, x.ResourceType, x.ResourceId });
            entity.Property(x => x.ResourceType).HasMaxLength(32);
            entity.HasOne<AccessAssignment>().WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AccessAssignmentAction>(entity =>
        {
            entity.ToTable("access_assignment_actions");
            entity.HasKey(x => new { x.AssignmentId, x.PermissionId });
            entity.HasOne<AccessAssignment>().WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Permission>().WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AppModule>(entity =>
        {
            entity.ToTable("app_modules");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.AppId).IsUnique();
            entity.Property(x => x.AppId).HasMaxLength(64);
        });

        modelBuilder.Entity<PlatformLocalizationSettings>(entity =>
        {
            entity.ToTable("localization_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DefaultLocale).HasMaxLength(16);
            entity.Property(x => x.Version).IsConcurrencyToken();
        });

        modelBuilder.Entity<PlatformNotification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SourceModule).HasMaxLength(64);
            entity.Property(x => x.NotificationType).HasMaxLength(64);
            entity.Property(x => x.TitleEn).HasMaxLength(240);
            entity.Property(x => x.TitleTh).HasMaxLength(240);
            entity.Property(x => x.MessageEn).HasMaxLength(1000);
            entity.Property(x => x.MessageTh).HasMaxLength(1000);
            entity.Property(x => x.DestinationPath).HasMaxLength(500);
            entity.HasIndex(x => new { x.UserId, x.ReadAt, x.CreatedAt });
            entity.HasIndex(x => new { x.UserId, x.IsImportant, x.CreatedAt });
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlatformActivityItem>(entity =>
        {
            entity.ToTable("activity_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SourceModule).HasMaxLength(64);
            entity.Property(x => x.ResourceType).HasMaxLength(64);
            entity.Property(x => x.ResourceId).HasMaxLength(128);
            entity.Property(x => x.Title).HasMaxLength(240);
            entity.Property(x => x.Activity).HasMaxLength(500);
            entity.Property(x => x.DestinationPath).HasMaxLength(500);
            entity.HasIndex(x => new { x.UserId, x.OccurredAt });
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}
