using Microsoft.EntityFrameworkCore;

namespace INNO.One.Infrastructure.Persistence;

/// <summary>
/// Owns shared integration/audit/read-model infrastructure persistence.
/// Business-domain entities never belong in this context.
/// </summary>
public sealed class InfrastructureDbContext(DbContextOptions<InfrastructureDbContext> options) : DbContext(options)
{
    public const string MigrationsSchema = "integration";

    public DbSet<OperationRecord> Operations => Set<OperationRecord>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(MigrationsSchema);

        modelBuilder.Entity<OperationRecord>(entity =>
        {
            entity.ToTable("operations", "integration");
            entity.HasKey(x => x.OperationId);
            entity.Property(x => x.OperationType).HasMaxLength(128);
            entity.Property(x => x.OriginModule).HasMaxLength(64);
            entity.Property(x => x.SubjectType).HasMaxLength(64);
            entity.Property(x => x.RequestedByActorType).HasMaxLength(32);
            entity.Property(x => x.RequestedByActorId).HasMaxLength(128);
            entity.Property(x => x.PermissionContext).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.ResultRef).HasMaxLength(256);
            entity.Property(x => x.ErrorCode).HasMaxLength(128);
            entity.HasIndex(x => new { x.Status, x.UpdatedAt });
            entity.HasIndex(x => new { x.OriginModule, x.CreatedAt });
        });

        modelBuilder.Entity<OutboxMessage>(entity =>
        {
            entity.ToTable("outbox_messages", "integration");
            entity.HasKey(x => x.EventId);
            entity.Property(x => x.EventType).HasMaxLength(128);
            entity.Property(x => x.OriginModule).HasMaxLength(64);
            entity.Property(x => x.SubjectType).HasMaxLength(64);
            entity.Property(x => x.SubjectId).HasMaxLength(128);
            entity.Property(x => x.CorrelationId).HasMaxLength(128);
            entity.Property(x => x.CausationId).HasMaxLength(128);
            entity.Property(x => x.TraceId).HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasIndex(x => new { x.Status, x.NextAttemptAt, x.OccurredAt });
            entity.HasIndex(x => x.EventId).IsUnique();
        });

        modelBuilder.Entity<AuditRecord>(entity =>
        {
            entity.ToTable("audit_records", "audit");
            entity.HasKey(x => x.AuditId);
            entity.Property(x => x.Action).HasMaxLength(128);
            entity.Property(x => x.Module).HasMaxLength(64);
            entity.Property(x => x.TargetType).HasMaxLength(64);
            entity.Property(x => x.TargetId).HasMaxLength(128);
            entity.Property(x => x.ActorType).HasMaxLength(32);
            entity.Property(x => x.ActorId).HasMaxLength(128);
            entity.Property(x => x.CorrelationId).HasMaxLength(128);
            entity.Property(x => x.TraceId).HasMaxLength(128);
            entity.Property(x => x.Classification).HasMaxLength(64);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasIndex(x => x.OccurredAt);
            entity.HasIndex(x => new { x.ActorType, x.ActorId, x.OccurredAt });
        });

        base.OnModelCreating(modelBuilder);
    }
}
