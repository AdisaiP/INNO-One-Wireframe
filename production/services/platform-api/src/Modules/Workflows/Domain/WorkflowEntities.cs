namespace INNO.One.Modules.Workflows.Domain;

public sealed class WorkflowDefinition
{
    public Guid Id { get; set; }
    public string OwnerModule { get; set; } = "";
    public string Name { get; set; } = "";
    public string NodesJson { get; set; } = "[]";
    public string EdgesJson { get; set; } = "[]";
    public string Orientation { get; set; } = "horizontal";
    public string Status { get; set; } = "draft";
    public long Version { get; set; } = 1;
    public Guid CreatedByUserId { get; set; }
    public Guid UpdatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class WorkflowDefinitionVersion
{
    public Guid Id { get; set; }
    public Guid WorkflowId { get; set; }
    public long Version { get; set; }
    public string OwnerModule { get; set; } = "";
    public string Name { get; set; } = "";
    public string NodesJson { get; set; } = "[]";
    public string EdgesJson { get; set; } = "[]";
    public string Orientation { get; set; } = "horizontal";
    public string Status { get; set; } = "draft";
    public Guid ChangedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class WorkflowRun
{
    public Guid Id { get; set; }
    public Guid WorkflowId { get; set; }
    public long WorkflowVersion { get; set; }
    public string OwnerModule { get; set; } = "";
    public string WorkflowName { get; set; } = "";
    public string DefinitionSnapshotJson { get; set; } = "{}";
    public string InputJson { get; set; } = "{}";
    public string Status { get; set; } = "queued";
    public string ActiveNodeIdsJson { get; set; } = "[]";
    public string CompletedNodeIdsJson { get; set; } = "[]";
    public string? FailedNodeId { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; } = 3;
    public DateTimeOffset? NextAttemptAt { get; set; }
    public Guid RequestedByUserId { get; set; }
    public string RequestedBySubject { get; set; } = "";
    public string CorrelationId { get; set; } = "";
    public string? TraceId { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorDetail { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public sealed class WorkflowRunStep
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public string NodeId { get; set; } = "";
    public string NodeKind { get; set; } = "";
    public string CatalogKey { get; set; } = "";
    public string Status { get; set; } = "queued";
    public int Attempt { get; set; }
    public string? OutputJson { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorDetail { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
