using INNO.One.Infrastructure.Persistence;
using INNO.One.Modules.Devices.Persistence;
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

    public PlatformDbContext CreateDbContext() => CreatePlatformDbContext();

    public PlatformDbContext CreatePlatformDbContext()
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

    public InfrastructureDbContext CreateInfrastructureDbContext()
    {
        var options = new DbContextOptionsBuilder<InfrastructureDbContext>()
            .UseNpgsql(
                ConnectionString,
                npgsql => npgsql.MigrationsHistoryTable(
                    "__ef_migrations_history",
                    InfrastructureDbContext.MigrationsSchema))
            .UseSnakeCaseNamingConvention()
            .Options;

        return new InfrastructureDbContext(options);
    }

    public DevicesDbContext CreateDevicesDbContext()
    {
        var options = new DbContextOptionsBuilder<DevicesDbContext>()
            .UseNpgsql(
                ConnectionString,
                npgsql => npgsql.MigrationsHistoryTable(
                    "__ef_migrations_history",
                    DevicesDbContext.Schema))
            .UseSnakeCaseNamingConvention()
            .Options;

        return new DevicesDbContext(options);
    }

    public Task InitializeAsync() => ResetAsync();

    public async Task DisposeAsync()
    {
        await DropSchemasAsync();
    }

    public async Task ResetAsync()
    {
        await DropSchemasAsync();

        await using (var platform = CreatePlatformDbContext())
        {
            await platform.Database.MigrateAsync();
        }

        await using (var infrastructure = CreateInfrastructureDbContext())
        {
            await infrastructure.Database.MigrateAsync();
        }

        await using (var devices = CreateDevicesDbContext())
        {
            await devices.Database.MigrateAsync();
        }
    }

    private async Task DropSchemasAsync()
    {
        await using var db = CreatePlatformDbContext();
        await db.Database.ExecuteSqlRawAsync(
            """
            DROP SCHEMA IF EXISTS audit CASCADE;
            DROP SCHEMA IF EXISTS integration CASCADE;
            DROP SCHEMA IF EXISTS devices CASCADE;
            DROP SCHEMA IF EXISTS platform CASCADE;
            """);
    }
}
