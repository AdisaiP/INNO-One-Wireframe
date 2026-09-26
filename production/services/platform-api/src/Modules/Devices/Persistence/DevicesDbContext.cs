using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Persistence;

public sealed class DevicesDbContext(DbContextOptions<DevicesDbContext> options) : DbContext(options)
{
    public const string Schema = "devices";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
