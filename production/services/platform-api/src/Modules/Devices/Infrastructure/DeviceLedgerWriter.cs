using System.Text.Json;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Infrastructure;

/// <summary>
/// Writes the shared integration/audit ledgers through the current Devices database
/// connection so a device mutation and its durable record can share one PostgreSQL transaction.
/// Table ownership remains with INNO.One.Infrastructure migrations.
/// </summary>
public sealed class DeviceLedgerWriter(DevicesDbContext db)
{
    public Task CreateOperationAsync(
        Guid operationId,
        string operationType,
        string subjectType,
        Guid? subjectId,
        string actorId,
        string permission,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var permissionJson = JsonSerializer.Serialize(new { permission });

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO integration.operations
                (operation_id, operation_type, origin_module, subject_type, subject_id,
                 requested_by_actor_type, requested_by_actor_id, permission_context,
                 status, progress, created_at, updated_at)
            VALUES
                ({operationId}, {operationType}, 'devices', {subjectType}, {subjectId},
                 'user', {actorId}, CAST({permissionJson} AS jsonb),
                 'queued', 0, {now}, {now})
            """, cancellationToken);
    }

    public Task UpdateOperationAsync(
        Guid operationId,
        string status,
        int progress,
        string? resultRef,
        string? errorCode,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE integration.operations
               SET status = {status},
                   progress = {Math.Clamp(progress, 0, 100)},
                   result_ref = {resultRef},
                   error_code = {errorCode},
                   updated_at = {now}
             WHERE operation_id = {operationId}
            """, cancellationToken);
    }

    public Task AppendAuditAsync(
        string action,
        string targetType,
        string targetId,
        string actorId,
        string correlationId,
        string? traceId,
        object metadata,
        CancellationToken cancellationToken = default,
        string classification = "internal")
    {
        var auditId = Guid.NewGuid();
        var occurredAt = DateTimeOffset.UtcNow;
        var metadataJson = JsonSerializer.Serialize(metadata);
        var normalizedClassification = classification is "restricted" or "confidential"
            ? classification
            : "internal";

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO audit.audit_records
                (audit_id, action, module, target_type, target_id,
                 actor_type, actor_id, occurred_at, correlation_id, trace_id,
                 classification, metadata_json)
            VALUES
                ({auditId}, {action}, 'devices', {targetType}, {targetId},
                 'user', {actorId}, {occurredAt}, {correlationId}, {traceId},
                 {normalizedClassification}, CAST({metadataJson} AS jsonb))
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
                ({eventId}, {eventType}, 1, 'devices',
                 {subjectType}, {subjectId}, {occurredAt}, {correlationId},
                 {causationId}, {traceId}, CAST({payloadJson} AS jsonb), 'pending', 0)
            """, cancellationToken);
    }
}
