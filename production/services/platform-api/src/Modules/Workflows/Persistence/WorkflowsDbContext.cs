using INNO.One.Modules.Workflows.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Persistence;

public sealed class WorkflowsDbContext(DbContextOptions<WorkflowsDbContext> options) : DbContext(options)
{
    public const string Schema = "workflows";
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<WorkflowDefinitionVersion> WorkflowDefinitionVersions => Set<WorkflowDefinitionVersion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<WorkflowDefinition>(entity =>
        {
            entity.ToTable("workflow_definitions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OwnerModule).HasMaxLength(64).HasDefaultValue("legacy_unassigned").IsRequired();
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.NodesJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.EdgesJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.Orientation).HasMaxLength(16).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.OwnerModule, x.UpdatedAt });
        });

        modelBuilder.Entity<WorkflowDefinitionVersion>(entity =>
        {
            entity.ToTable("workflow_definition_versions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OwnerModule).HasMaxLength(64).HasDefaultValue("legacy_unassigned").IsRequired();
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.NodesJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.EdgesJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.Orientation).HasMaxLength(16).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.HasIndex(x => new { x.WorkflowId, x.Version }).IsUnique();
        });
    }
}
