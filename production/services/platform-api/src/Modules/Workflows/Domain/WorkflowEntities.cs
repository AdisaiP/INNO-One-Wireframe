namespace INNO.One.Modules.Workflows.Domain;

public sealed class WorkflowDefinition
{
    public Guid Id { get; set; }
    public string OwnerModule { get; set; } = "legacy_unassigned";
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
    public string OwnerModule { get; set; } = "legacy_unassigned";
    public string Name { get; set; } = "";
    public string NodesJson { get; set; } = "[]";
    public string EdgesJson { get; set; } = "[]";
    public string Orientation { get; set; } = "horizontal";
    public string Status { get; set; } = "draft";
    public Guid ChangedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
