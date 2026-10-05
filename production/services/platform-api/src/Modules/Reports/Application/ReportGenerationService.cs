using System.Security.Claims;
using System.Text;
using System.Text.Json;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Reports;
using INNO.One.Modules.Reports.Domain;
using INNO.One.Modules.Reports.Infrastructure;
using INNO.One.Modules.Reports.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Reports.Application;

public sealed class ReportGenerationService(
    ReportsDbContext db,
    IEnumerable<IReportSourceReader> sourceReaders,
    IAccessEvaluator accessEvaluator,
    ReportsLedgerWriter ledger) : IReportGenerationService
{
    public async Task<ReportGenerationResult> GenerateAsync(
        ReportGenerationRequest request,
        CancellationToken cancellationToken = default)
    {
        var report = await db.ReportDefinitions
            .SingleOrDefaultAsync(x => x.Id == request.ReportId, cancellationToken);
        if (report is null || !string.Equals(report.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return Fail("REPORT_NOT_FOUND", "The report is not available.");
        }

        var principal = Principal(request.RequestedBySubject);
        var reportAccess = await accessEvaluator.EvaluateAsync(
            principal,
            "reports.create",
            cancellationToken);
        if (!reportAccess.Allowed || reportAccess.UserId != request.RequestedByUserId)
        {
            return Fail(
                "REPORT_GENERATE_PERMISSION_DENIED",
                reportAccess.Reason);
        }

        var source = sourceReaders.FirstOrDefault(
            x => string.Equals(
                x.Descriptor.Key,
                report.SourceKey,
                StringComparison.OrdinalIgnoreCase));
        if (source is null)
        {
            return Fail(
                "REPORT_SOURCE_NOT_AVAILABLE",
                "The configured report source is not registered.");
        }

        var columns = DeserializeColumns(report.ColumnsJson);
        var filters = DeserializeFilters(report.FiltersJson);

        var now = DateTimeOffset.UtcNow;
        var run = new ReportRun
        {
            Id = Guid.NewGuid(),
            ReportId = report.Id,
            ReportVersion = report.Version,
            ReportName = report.Name,
            DefinitionSnapshotJson = JsonSerializer.Serialize(new
            {
                report.Id,
                report.Name,
                report.Description,
                report.SourceKey,
                columns,
                filters,
                report.OutputFormat,
                report.Version
            }),
            Trigger = NormalizeTrigger(request.Trigger),
            Status = "running",
            RowCount = 0,
            RequestedByUserId = request.RequestedByUserId,
            RequestedBySubject = request.RequestedBySubject,
            CorrelationId = request.CorrelationId,
            TraceId = request.TraceId,
            CreatedAt = now,
            StartedAt = now
        };

        db.ReportRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            if (!string.Equals(report.OutputFormat, "csv", StringComparison.OrdinalIgnoreCase))
            {
                return await CompleteFailureAsync(
                    run,
                    "REPORT_FORMAT_NOT_SUPPORTED",
                    "Step45K currently supports CSV output.",
                    cancellationToken);
            }

            var result = await source.ReadAsync(
                principal,
                columns,
                filters,
                cancellationToken);

            run.RowCount = result.Rows.Count;
            run.OutputMimeType = "text/csv; charset=utf-8";
            run.OutputFileName = FileName(report.Name, run.Id);
            run.OutputText = BuildCsv(result);
            run.Status = "completed";
            run.CompletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            await ledger.AppendAuditAsync(
                "reports.run.completed",
                "report_run",
                OpaqueId.Format("rpt_run", run.Id),
                OpaqueId.Format("user", request.RequestedByUserId),
                request.CorrelationId,
                request.TraceId,
                new
                {
                    reportId = OpaqueId.Format("rpt", report.Id),
                    reportVersion = report.Version,
                    report.SourceKey,
                    rowCount = run.RowCount,
                    trigger = run.Trigger
                },
                cancellationToken);

            return new ReportGenerationResult(
                true,
                run.Id,
                null,
                null);
        }
        catch (ReportSourceAccessException ex)
        {
            return await CompleteFailureAsync(
                run,
                ex.ErrorCode,
                ex.ErrorDetail,
                cancellationToken);
        }
        catch (Exception ex)
        {
            return await CompleteFailureAsync(
                run,
                "REPORT_GENERATION_FAILED",
                ex.Message,
                cancellationToken);
        }
    }

    private async Task<ReportGenerationResult> CompleteFailureAsync(
        ReportRun run,
        string code,
        string detail,
        CancellationToken cancellationToken)
    {
        run.Status = "failed";
        run.ErrorCode = code;
        run.ErrorDetail = detail.Length > 1200 ? detail[..1200] : detail;
        run.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return new ReportGenerationResult(
            false,
            run.Id,
            code,
            run.ErrorDetail);
    }

    private static ClaimsPrincipal Principal(string subject) =>
        new(new ClaimsIdentity(
            [new Claim("sub", subject)],
            "reports"));

    private static string[] DeserializeColumns(string json) =>
        JsonSerializer.Deserialize<string[]>(json)
        ?? [];

    private static ReportFilter[] DeserializeFilters(string json) =>
        JsonSerializer.Deserialize<ReportFilter[]>(json)
        ?? [];

    private static string NormalizeTrigger(string? trigger) =>
        trigger?.Trim().ToLowerInvariant() switch
        {
            "schedule" => "schedule",
            "automation" => "automation",
            _ => "manual"
        };

    private static string FileName(string name, Guid runId)
    {
        var safe = string.Concat(name.Select(ch =>
            char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-'))
            .Trim('-');
        if (safe.Length == 0)
        {
            safe = "report";
        }
        return $"{safe}-{runId:N}.csv";
    }

    private static string BuildCsv(ReportTabularResult result)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(",", result.Columns.Select(Escape)));
        foreach (var row in result.Rows)
        {
            builder.AppendLine(string.Join(
                ",",
                result.Columns.Select(column =>
                    Escape(row.GetValueOrDefault(column)))));
        }
        return builder.ToString();
    }

    private static string Escape(string? value)
    {
        var text = value ?? "";
        if (text.Contains('"'))
        {
            text = text.Replace("\"", "\"\"");
        }
        return text.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? $"\"{text}\""
            : text;
    }

    private static ReportGenerationResult Fail(
        string code,
        string detail) =>
        new(false, null, code, detail);
}
