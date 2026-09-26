using Microsoft.EntityFrameworkCore;

namespace INNO.One.MeetingService.Persistence;

public sealed class MeetingIntegrationDbContext(DbContextOptions<MeetingIntegrationDbContext> options) : DbContext(options)
{
    public const string Schema = "integration";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
