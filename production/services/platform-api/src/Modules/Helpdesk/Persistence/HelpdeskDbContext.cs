using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Helpdesk.Persistence;

public sealed class HelpdeskDbContext(DbContextOptions<HelpdeskDbContext> options) : DbContext(options)
{
    public const string Schema = "helpdesk";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
