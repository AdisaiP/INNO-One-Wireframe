using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class RemoteSessionExpiryWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<RemoteSessionExpiryWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    private const int BatchSize = 50;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcileExpiredSharesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Remote session expiry reconciliation failed.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task ReconcileExpiredSharesAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
        var ledger = scope.ServiceProvider.GetRequiredService<DeviceLedgerWriter>();
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var expired = await db.RemoteSessions
            .FromSqlInterpolated($"""
                SELECT *
                  FROM devices.remote_sessions
                 WHERE status = 'active'
                   AND expires_at IS NOT NULL
                   AND expires_at <= {now}
                 ORDER BY expires_at
                 FOR UPDATE SKIP LOCKED
                 LIMIT {BatchSize}
                """)
            .ToListAsync(cancellationToken);

        if (expired.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        foreach (var session in expired)
        {
            session.Status = "ended";
            session.EndedAt = now;
            session.EndReason = "share_expired";
            session.LaunchUrl = null;
            session.ExternalShareId = null;
            session.FailureCode = null;
            session.Version++;
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var session in expired)
        {
            var sessionId = OpaqueId.Format("rses", session.Id);
            var deviceId = OpaqueId.Format("dev", session.DeviceId);
            var operatorUserId = OpaqueId.Format("user", session.OperatorUserId);
            var correlationId = $"remote-expiry:{sessionId}";

            await ledger.AppendAuditAsync(
                "devices.remote.session_ended",
                "remote_session",
                sessionId,
                "remote-session-expiry-worker",
                correlationId,
                null,
                new
                {
                    deviceId,
                    operatorUserId,
                    reason = session.EndReason,
                    executionEngine = "meshcentral",
                    automated = true
                },
                cancellationToken,
                "restricted",
                "service");

            await ledger.AppendOutboxAsync(
                "remote.ended",
                "remote_session",
                sessionId,
                new
                {
                    sessionId,
                    deviceId,
                    operatorUserId,
                    endedAt = session.EndedAt,
                    reason = session.EndReason,
                    automated = true
                },
                correlationId,
                null,
                null,
                cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation("Reconciled {Count} expired remote sessions.", expired.Count);
    }
}
