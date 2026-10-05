namespace INNO.One.Modules.Reports.Domain;

public sealed class ReportDefinition
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string SourceKey { get; set; }
    public required string ColumnsJson { get; set; }
    public required string FiltersJson { get; set; }
    public required string OutputFormat { get; set; }
    public required string Status { get; set; }
    public Guid CreatedByUserId { get; set; }
    public required string CreatedBySubject { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ReportRun
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public long ReportVersion { get; set; }
    public required string ReportName { get; set; }
    public required string DefinitionSnapshotJson { get; set; }
    public required string Trigger { get; set; }
    public required string Status { get; set; }
    public int RowCount { get; set; }
    public string? OutputFileName { get; set; }
    public string? OutputMimeType { get; set; }
    public string? OutputText { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorDetail { get; set; }
    public Guid RequestedByUserId { get; set; }
    public required string RequestedBySubject { get; set; }
    public required string CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public sealed class ReportSchedule
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public required string Name { get; set; }
    public required string Cadence { get; set; }
    public required string TimeZoneId { get; set; }
    public int Hour { get; set; }
    public int Minute { get; set; }
    public int? DayOfWeek { get; set; }
    public int? DayOfMonth { get; set; }
    public bool IsEnabled { get; set; }
    public DateTimeOffset? NextRunAt { get; set; }
    public DateTimeOffset? LastRunAt { get; set; }
    public Guid? LastRunId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public required string CreatedBySubject { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
