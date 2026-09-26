namespace INNO.One.Modules.Helpdesk.Domain;

public sealed class Ticket
{
    public Guid Id { get; set; }
    public required string TicketNumber { get; set; }
    public required string Subject { get; set; }
    public required string Description { get; set; }
    public Guid RequesterUserId { get; set; }
    public Guid? RequesterOrganizationUnitId { get; set; }
    public Guid? AssigneeUserId { get; set; }
    public string? AssigneeTeam { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid StatusId { get; set; }
    public required string Priority { get; set; }
    public required string Impact { get; set; }
    public required string Urgency { get; set; }
    public Guid? RelatedDeviceId { get; set; }
    public Guid? RelatedAssetId { get; set; }
    public string? ResolutionCode { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class TicketReply
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid AuthorUserId { get; set; }
    public required string Body { get; set; }
    public required string Visibility { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class TicketAssignment
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid? PreviousAssigneeUserId { get; set; }
    public Guid? AssigneeUserId { get; set; }
    public string? Team { get; set; }
    public Guid AssignedByUserId { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
}

public sealed class TicketStatusHistory
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid? FromStatusId { get; set; }
    public Guid ToStatusId { get; set; }
    public Guid ChangedByUserId { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset ChangedAt { get; set; }
}

public sealed class SlaPolicy
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Priority { get; set; }
    public int ResponseMinutes { get; set; }
    public int ResolutionMinutes { get; set; }
    public Guid? BusinessCalendarId { get; set; }
    public string? AppliesTo { get; set; }
    public bool PauseOnRequesterWait { get; set; }
    public bool NotifyRequesterOnStatusChange { get; set; }
    public bool ReassignOnBreach { get; set; }
    public string EscalationLevelsJson { get; set; } = "[]";
    public bool IsActive { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class TicketSla
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid PolicyId { get; set; }
    public DateTimeOffset ResponseDueAt { get; set; }
    public DateTimeOffset ResolutionDueAt { get; set; }
    public DateTimeOffset? ResponseMetAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? PausedAt { get; set; }
    public long AccumulatedPausedSeconds { get; set; }
    public DateTimeOffset? RiskEmittedAt { get; set; }
    public int EscalationLevel { get; set; }
    public DateTimeOffset? LastEvaluatedAt { get; set; }
    public required string State { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Category
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public Guid? ParentCategoryId { get; set; }
    public required string Status { get; set; }
    public int SortOrder { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class TicketStatus
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public bool IsClosed { get; set; }
    public int SortOrder { get; set; }
    public required string Status { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
