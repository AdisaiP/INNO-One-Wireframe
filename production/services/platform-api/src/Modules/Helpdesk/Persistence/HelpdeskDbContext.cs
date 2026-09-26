using INNO.One.Modules.Helpdesk.Domain;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Persistence;

public sealed class HelpdeskDbContext(DbContextOptions<HelpdeskDbContext> options) : DbContext(options)
{
    public const string Schema = "helpdesk";

    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketReply> TicketReplies => Set<TicketReply>();
    public DbSet<TicketAssignment> TicketAssignments => Set<TicketAssignment>();
    public DbSet<TicketStatusHistory> TicketStatusHistory => Set<TicketStatusHistory>();
    public DbSet<SlaPolicy> SlaPolicies => Set<SlaPolicy>();
    public DbSet<TicketSla> TicketSla => Set<TicketSla>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<TicketStatus> Statuses => Set<TicketStatus>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.ToTable("tickets");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TicketNumber).IsUnique();
            entity.HasIndex(x => new { x.StatusId, x.Priority, x.CreatedAt });
            entity.HasIndex(x => new { x.AssigneeUserId, x.StatusId, x.UpdatedAt });
            entity.HasIndex(x => x.RequesterUserId);
            entity.HasIndex(x => x.RequesterOrganizationUnitId);
            entity.HasIndex(x => x.RelatedDeviceId);
            entity.Property(x => x.TicketNumber).HasMaxLength(40);
            entity.Property(x => x.Subject).HasMaxLength(240);
            entity.Property(x => x.Description).HasMaxLength(12000);
            entity.Property(x => x.AssigneeTeam).HasMaxLength(120);
            entity.Property(x => x.Priority).HasMaxLength(16);
            entity.Property(x => x.Impact).HasMaxLength(32);
            entity.Property(x => x.Urgency).HasMaxLength(32);
            entity.Property(x => x.ResolutionCode).HasMaxLength(64);
            entity.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<TicketStatus>().WithMany().HasForeignKey(x => x.StatusId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TicketReply>(entity =>
        {
            entity.ToTable("ticket_replies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TicketId, x.CreatedAt });
            entity.Property(x => x.Body).HasMaxLength(12000);
            entity.Property(x => x.Visibility).HasMaxLength(32);
            entity.HasOne<Ticket>().WithMany().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketAssignment>(entity =>
        {
            entity.ToTable("ticket_assignments");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TicketId, x.AssignedAt });
            entity.Property(x => x.Team).HasMaxLength(120);
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.HasOne<Ticket>().WithMany().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketStatusHistory>(entity =>
        {
            entity.ToTable("ticket_status_history");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TicketId, x.ChangedAt });
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.HasOne<Ticket>().WithMany().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SlaPolicy>(entity =>
        {
            entity.ToTable("sla_policies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.Priority, x.IsActive });
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.Priority).HasMaxLength(16);
        });

        modelBuilder.Entity<TicketSla>(entity =>
        {
            entity.ToTable("ticket_sla");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TicketId).IsUnique();
            entity.HasIndex(x => new { x.State, x.ResolutionDueAt });
            entity.Property(x => x.State).HasMaxLength(32);
            entity.HasOne<Ticket>().WithMany().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<SlaPolicy>().WithMany().HasForeignKey(x => x.PolicyId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.ParentCategoryId, x.Status, x.SortOrder });
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.HasOne<Category>().WithMany().HasForeignKey(x => x.ParentCategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TicketStatus>(entity =>
        {
            entity.ToTable("statuses");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.Status).HasMaxLength(32);
        });

        base.OnModelCreating(modelBuilder);
    }
}
