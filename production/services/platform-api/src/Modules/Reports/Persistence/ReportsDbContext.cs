using INNO.One.Modules.Reports.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Reports.Persistence;

public sealed class ReportsDbContext(DbContextOptions<ReportsDbContext> options) : DbContext(options)
{
    public const string Schema = "reports";

    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();
    public DbSet<ReportRun> ReportRuns => Set<ReportRun>();
    public DbSet<ReportSchedule> ReportSchedules => Set<ReportSchedule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<ReportDefinition>(entity =>
        {
            entity.ToTable("report_definitions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.Status, x.UpdatedAt });
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1200);
            entity.Property(x => x.SourceKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ColumnsJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.FiltersJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.OutputFormat).HasMaxLength(16).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.Property(x => x.CreatedBySubject).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Version).IsConcurrencyToken();
        });

        modelBuilder.Entity<ReportRun>(entity =>
        {
            entity.ToTable("report_runs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.ReportId, x.CreatedAt });
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.Property(x => x.ReportName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.DefinitionSnapshotJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.Trigger).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(32).IsRequired();
            entity.Property(x => x.OutputFileName).HasMaxLength(240);
            entity.Property(x => x.OutputMimeType).HasMaxLength(120);
            entity.Property(x => x.OutputText).HasColumnType("text");
            entity.Property(x => x.ErrorCode).HasMaxLength(120);
            entity.Property(x => x.ErrorDetail).HasMaxLength(1200);
            entity.Property(x => x.RequestedBySubject).HasMaxLength(180).IsRequired();
            entity.Property(x => x.CorrelationId).HasMaxLength(160).IsRequired();
            entity.Property(x => x.TraceId).HasMaxLength(160);
            entity.HasOne<ReportDefinition>()
                .WithMany()
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ReportSchedule>(entity =>
        {
            entity.ToTable("report_schedules");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.IsEnabled, x.NextRunAt });
            entity.HasIndex(x => new { x.ReportId, x.Name }).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Cadence).HasMaxLength(24).IsRequired();
            entity.Property(x => x.TimeZoneId).HasMaxLength(128).IsRequired();
            entity.Property(x => x.CreatedBySubject).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasOne<ReportDefinition>()
                .WithMany()
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}
