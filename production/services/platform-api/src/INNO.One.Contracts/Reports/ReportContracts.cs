using System.Security.Claims;

namespace INNO.One.Contracts.Reports;

public sealed record ReportSourceColumn(
    string Key,
    string Label,
    string DataType);

public sealed record ReportSourceDescriptor(
    string Key,
    string Name,
    string RequiredPermission,
    IReadOnlyList<ReportSourceColumn> Columns,
    IReadOnlyList<string> FilterFields);

public sealed record ReportFilter(
    string Field,
    string Operator,
    string Value);

public sealed record ReportTabularResult(
    IReadOnlyList<string> Columns,
    IReadOnlyList<IReadOnlyDictionary<string, string?>> Rows);

public sealed class ReportSourceAccessException(
    string errorCode,
    string errorDetail) : Exception(errorDetail)
{
    public string ErrorCode { get; } = errorCode;
    public string ErrorDetail { get; } = errorDetail;
}

public interface IReportSourceReader
{
    ReportSourceDescriptor Descriptor { get; }

    Task<ReportTabularResult> ReadAsync(
        ClaimsPrincipal principal,
        IReadOnlyList<string> columns,
        IReadOnlyList<ReportFilter> filters,
        CancellationToken cancellationToken = default);
}

public sealed record ReportGenerationRequest(
    Guid ReportId,
    Guid RequestedByUserId,
    string RequestedBySubject,
    string CorrelationId,
    string? TraceId,
    string Trigger);

public sealed record ReportGenerationResult(
    bool Succeeded,
    Guid? RunId,
    string? ErrorCode,
    string? ErrorDetail);

public interface IReportGenerationService
{
    Task<ReportGenerationResult> GenerateAsync(
        ReportGenerationRequest request,
        CancellationToken cancellationToken = default);
}
