using Microsoft.EntityFrameworkCore;

namespace INNO.One.Infrastructure.Persistence;

/// <summary>
/// Owns integration, audit and readmodel infrastructure mappings.
/// Individual entities are added by later vertical slices; no domain entities belong here.
/// </summary>
public sealed class InfrastructureDbContext(DbContextOptions<InfrastructureDbContext> options) : DbContext(options)
{
    public const string MigrationsSchema = "integration";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(MigrationsSchema);
        base.OnModelCreating(modelBuilder);
    }
}
