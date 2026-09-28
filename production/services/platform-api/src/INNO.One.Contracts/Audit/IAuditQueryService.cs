namespace INNO.One.Contracts.Audit;

public interface IAuditQueryService
{
    Task<AuditPageResult> QueryAsync(
        AuditQuery query,
        CancellationToken cancellationToken = default);

    Task<AuditRecordSnapshot?> GetAsync(
        Guid auditId,
        CancellationToken cancellationToken = default);

    Task<AuditFacets> GetFacetsAsync(
        CancellationToken cancellationToken = default);
}

public sealed record AuditQuery(
    string? Search,
    string? Module,
    string? Action,
    string? Actor,
    string? TargetType,
    string? Classification,
    DateTimeOffset? From,
    DateTimeOffset? To,
    int Page,
    int PageSize);

public sealed record AuditPageResult(
    IReadOnlyList<AuditRecordSnapshot> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);

public sealed record AuditRecordSnapshot(
    Guid AuditId,
    DateTimeOffset OccurredAt,
    string Action,
    string Module,
    string TargetType,
    string TargetId,
    string ActorType,
    string ActorId,
    string? CorrelationId,
    string? TraceId,
    string Classification,
    string MetadataJson);

public sealed record AuditFacets(
    IReadOnlyList<string> Modules,
    IReadOnlyList<string> Actions,
    IReadOnlyList<string> TargetTypes,
    IReadOnlyList<string> Classifications);
