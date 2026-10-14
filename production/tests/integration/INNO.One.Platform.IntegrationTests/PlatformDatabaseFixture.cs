using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Platform.IntegrationTests;

[CollectionDefinition(CollectionName)]
public sealed class PlatformDatabaseCollection : ICollectionFixture<PlatformDatabaseFixture>
{
    public const string CollectionName = "platform-database";
}

public sealed class PlatformDatabaseFixture : IAsyncLifetime
{
    private const string EnvironmentVariable = "INNO_TEST_DATABASE";

    public string ConnectionString { get; } =
        Environment.GetEnvironmentVariable(EnvironmentVariable)
        ?? throw new InvalidOperationException(
            $"{EnvironmentVariable} is required for integration tests and must point to a disposable PostgreSQL database.");

    public PlatformDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<PlatformDbContext>()
            .UseNpgsql(
                ConnectionString,
                npgsql => npgsql.MigrationsHistoryTable(
                    "__ef_migrations_history",
                    PlatformDbContext.Schema))
            .UseSnakeCaseNamingConvention()
            .Options;

        return new PlatformDbContext(options);
    }

    public async Task InitializeAsync()
    {
        await ResetAsync();
    }

    public async Task DisposeAsync()
    {
        await using var db = CreateDbContext();
        await db.Database.EnsureDeletedAsync();
    }

    public async Task ResetAsync()
    {
        await using var db = CreateDbContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
    }
}
