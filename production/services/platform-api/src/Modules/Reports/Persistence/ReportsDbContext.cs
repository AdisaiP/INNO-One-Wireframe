using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Reports.Persistence;

public sealed class ReportsDbContext(DbContextOptions<ReportsDbContext> options) : DbContext(options)
{
    public const string Schema = "reports";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
