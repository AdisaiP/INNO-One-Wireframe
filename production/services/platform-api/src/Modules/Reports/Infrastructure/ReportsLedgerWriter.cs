using System.Text.Json;
using INNO.One.Modules.Reports.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Reports.Infrastructure;

public sealed class ReportsLedgerWriter(ReportsDbContext db)
{
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

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO audit.audit_records
                (audit_id, action, module, target_type, target_id,
                 actor_type, actor_id, occurred_at, correlation_id, trace_id,
                 classification, metadata_json)
            VALUES
                ({auditId}, {action}, 'reports', {targetType}, {targetId},
                 'user', {actorId}, {occurredAt}, {correlationId}, {traceId},
                 {classification}, CAST({metadataJson} AS jsonb))
            """, cancellationToken);
    }
}
