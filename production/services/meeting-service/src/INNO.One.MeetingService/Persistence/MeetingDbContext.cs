using Microsoft.EntityFrameworkCore;

namespace INNO.One.MeetingService.Persistence;

public sealed class MeetingDbContext(DbContextOptions<MeetingDbContext> options) : DbContext(options)
{
    public const string Schema = "meeting";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
