using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Persistence;

public sealed class AssetsDbContext(DbContextOptions<AssetsDbContext> options) : DbContext(options)
{
    public const string Schema = "assets";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        base.OnModelCreating(modelBuilder);
    }
}
