using System.Text.Json;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Infrastructure;

public sealed class WorkflowLedgerWriter(WorkflowsDbContext db)
{
    public Task AppendAuditAsync(
        string action,
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
                ({auditId}, {action}, 'workflows', 'workflow_definition', {targetId},
                 'user', {actorId}, {occurredAt}, {correlationId}, {traceId},
                 'restricted', CAST({metadataJson} AS jsonb))
            """, cancellationToken);
    }
}
