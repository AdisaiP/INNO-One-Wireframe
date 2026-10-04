using INNO.One.Modules.Workflows.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Persistence;

public sealed class WorkflowsDbContext(DbContextOptions<WorkflowsDbContext> options) : DbContext(options)
{
    public const string Schema = "workflows";
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<WorkflowDefinitionVersion> WorkflowDefinitionVersions => Set<WorkflowDefinitionVersion>();
    public DbSet<WorkflowRun> WorkflowRuns => Set<WorkflowRun>();
    public DbSet<WorkflowRunStep> WorkflowRunSteps => Set<WorkflowRunStep>();

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

        modelBuilder.Entity<WorkflowRun>(entity =>
        {
            entity.ToTable("workflow_runs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OwnerModule).HasMaxLength(64).IsRequired();
            entity.Property(x => x.WorkflowName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.DefinitionSnapshotJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.InputJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.Property(x => x.ActiveNodeIdsJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.CompletedNodeIdsJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.FailedNodeId).HasMaxLength(120);
            entity.Property(x => x.RequestedBySubject).HasMaxLength(180).IsRequired();
            entity.Property(x => x.CorrelationId).HasMaxLength(160).IsRequired();
            entity.Property(x => x.TraceId).HasMaxLength(160);
            entity.Property(x => x.ErrorCode).HasMaxLength(96);
            entity.Property(x => x.ErrorDetail).HasMaxLength(1000);
            entity.HasIndex(x => new { x.OwnerModule, x.WorkflowId, x.CreatedAt });
            entity.HasIndex(x => new { x.Status, x.NextAttemptAt, x.CreatedAt });
        });

        modelBuilder.Entity<WorkflowRunStep>(entity =>
        {
            entity.ToTable("workflow_run_steps");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.NodeId).HasMaxLength(120).IsRequired();
            entity.Property(x => x.NodeKind).HasMaxLength(32).IsRequired();
            entity.Property(x => x.CatalogKey).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.Property(x => x.OutputJson).HasColumnType("jsonb");
            entity.Property(x => x.ErrorCode).HasMaxLength(96);
            entity.Property(x => x.ErrorDetail).HasMaxLength(1000);
            entity.HasIndex(x => new { x.RunId, x.CreatedAt });
            entity.HasIndex(x => new { x.RunId, x.NodeId, x.Attempt }).IsUnique();
            entity.HasOne<WorkflowRun>()
                .WithMany()
                .HasForeignKey(x => x.RunId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
