using System.Diagnostics;
using INNO.One.Contracts.Integrations;
using INNO.One.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Infrastructure.IntegrationHealth;

public sealed record PostgreSqlIntegrationDescriptor(string Endpoint);

public sealed class PostgreSqlIntegrationHealthProvider(
    InfrastructureDbContext db,
    PostgreSqlIntegrationDescriptor descriptor) : IIntegrationHealthProvider
{
    public string Id => "core-database";

    public async Task<IntegrationHealthSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;

        try
        {
            var connected = await db.Database.CanConnectAsync(cancellationToken);
            return new IntegrationHealthSnapshot(
                Id,
                "Core Database",
                "Data",
                "PostgreSQL",
                "platform",
                descriptor.Endpoint,
                connected ? "connected" : "degraded",
                true,
                true,
                true,
                checkedAt,
                (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                connected
                    ? "Core PostgreSQL database is reachable."
                    : "Core PostgreSQL database is unavailable.",
                ["persistence", "transactional-outbox", "health-check"]);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Degraded(
                checkedAt,
                started,
                "Core PostgreSQL health check timed out.");
        }
        catch
        {
            return Degraded(
                checkedAt,
                started,
                "Core PostgreSQL database is unavailable.");
        }
    }

    private IntegrationHealthSnapshot Degraded(
        DateTimeOffset checkedAt,
        long started,
        string message) =>
        new(
            Id,
            "Core Database",
            "Data",
            "PostgreSQL",
            "platform",
            descriptor.Endpoint,
            "degraded",
            true,
            true,
            true,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            message,
            ["persistence", "transactional-outbox", "health-check"]);
}
