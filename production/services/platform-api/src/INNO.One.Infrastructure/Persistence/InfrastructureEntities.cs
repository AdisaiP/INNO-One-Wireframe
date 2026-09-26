namespace INNO.One.Infrastructure.Persistence;

public sealed class OperationRecord
{
    public Guid OperationId { get; set; }
    public required string OperationType { get; set; }
    public required string OriginModule { get; set; }
    public required string SubjectType { get; set; }
    public Guid? SubjectId { get; set; }
    public required string RequestedByActorType { get; set; }
    public required string RequestedByActorId { get; set; }
    public required string PermissionContext { get; set; }
    public required string Status { get; set; }
    public int Progress { get; set; }
    public string? ResultRef { get; set; }
    public string? ErrorCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
}

public sealed class OutboxMessage
{
    public Guid EventId { get; set; }
    public required string EventType { get; set; }
    public int EventVersion { get; set; }
    public required string OriginModule { get; set; }
    public required string SubjectType { get; set; }
    public required string SubjectId { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? CorrelationId { get; set; }
    public string? CausationId { get; set; }
    public string? TraceId { get; set; }
    public required string PayloadJson { get; set; }
    public required string Status { get; set; }
    public int AttemptCount { get; set; }
    public DateTimeOffset? NextAttemptAt { get; set; }
}

public sealed class AuditRecord
{
    public Guid AuditId { get; set; }
    public required string Action { get; set; }
    public required string Module { get; set; }
    public required string TargetType { get; set; }
    public required string TargetId { get; set; }
    public required string ActorType { get; set; }
    public required string ActorId { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public required string Classification { get; set; }
    public required string MetadataJson { get; set; }
}
