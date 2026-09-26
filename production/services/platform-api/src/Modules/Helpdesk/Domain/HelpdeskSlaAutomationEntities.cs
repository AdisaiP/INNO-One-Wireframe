namespace INNO.One.Modules.Helpdesk.Domain;

public sealed class BusinessCalendar
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string TimeZoneId { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class BusinessCalendarEntry
{
    public Guid Id { get; set; }
    public Guid CalendarId { get; set; }
    public required string EntryType { get; set; }
    public int? DayOfWeek { get; set; }
    public DateOnly? CalendarDate { get; set; }
    public int? StartMinute { get; set; }
    public int? EndMinute { get; set; }
    public string? Name { get; set; }
    public bool IsWorking { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AutomationRule
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string RuleType { get; set; }
    public required string Trigger { get; set; }
    public required string ScopeType { get; set; }
    public string? ScopeValue { get; set; }
    public required string ConditionField { get; set; }
    public required string ConditionOperator { get; set; }
    public required string ConditionValue { get; set; }
    public required string ActionType { get; set; }
    public required string ActionValue { get; set; }
    public required string Status { get; set; }
    public int SortOrder { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AutomationExecution
{
    public Guid Id { get; set; }
    public Guid RuleId { get; set; }
    public Guid TicketId { get; set; }
    public required string Trigger { get; set; }
    public required string Result { get; set; }
    public string? DetailJson { get; set; }
    public DateTimeOffset ExecutedAt { get; set; }
}
