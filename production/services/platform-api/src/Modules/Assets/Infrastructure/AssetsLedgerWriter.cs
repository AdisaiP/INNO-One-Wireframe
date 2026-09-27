using System.Text.Json;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Infrastructure;

public sealed class AssetsLedgerWriter(AssetsDbContext db)
{
    public Task AppendAuditAsync(
        string action,
        string targetType,
        string targetId,
        string actorId,
        string correlationId,
        string? traceId,
        object metadata,
        CancellationToken cancellationToken = default)
    {
        var auditId = Guid.NewGuid();
        var occurredAt = DateTimeOffset.UtcNow;
        var metadataJson = JsonSerializer.Serialize(metadata);

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO audit.audit_records
                (audit_id, action, module, target_type, target_id,
                 actor_type, actor_id, occurred_at, correlation_id, trace_id,
                 classification, metadata_json)
            VALUES
                ({auditId}, {action}, 'assets', {targetType}, {targetId},
                 'user', {actorId}, {occurredAt}, {correlationId}, {traceId},
                 'restricted', CAST({metadataJson} AS jsonb))
            """, cancellationToken);
    }

    public Task AppendOutboxAsync(
        string eventType,
        string subjectType,
        string subjectId,
        object payload,
        string? correlationId,
        string? causationId,
        string? traceId,
        CancellationToken cancellationToken = default)
    {
        var eventId = Guid.NewGuid();
        var occurredAt = DateTimeOffset.UtcNow;
        var payloadJson = JsonSerializer.Serialize(payload);

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO integration.outbox_messages
                (event_id, event_type, event_version, origin_module,
                 subject_type, subject_id, occurred_at, correlation_id,
                 causation_id, trace_id, payload_json, status, attempt_count)
            VALUES
                ({eventId}, {eventType}, 1, 'assets',
                 {subjectType}, {subjectId}, {occurredAt}, {correlationId},
                 {causationId}, {traceId}, CAST({payloadJson} AS jsonb), 'pending', 0)
            """, cancellationToken);
    }
}
