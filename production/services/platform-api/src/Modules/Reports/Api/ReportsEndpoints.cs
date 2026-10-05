using System.Text;
using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Reports;
using INNO.One.Modules.Reports.Application;
using INNO.One.Modules.Reports.Domain;
using INNO.One.Modules.Reports.Infrastructure;
using INNO.One.Modules.Reports.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Reports.Api;

public static class ReportsEndpoints
{
    private static readonly HashSet<string> Operators =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "equals",
            "not_equals",
            "contains"
        };

    private static readonly HashSet<string> Cadences =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "daily",
            "weekly",
            "monthly"
        };

    public static RouteGroupBuilder MapReportsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/reports/sources", ListSourcesAsync)
            .WithName("reports.sources.list");
        api.MapGet("/reports", ListReportsAsync)
            .WithName("reports.list");
        api.MapGet("/reports/{reportId}", GetReportAsync)
            .WithName("reports.get");
        api.MapPost("/reports", CreateReportAsync)
            .WithName("reports.create");
        api.MapPut("/reports/{reportId}", UpdateReportAsync)
            .WithName("reports.update");
        api.MapDelete("/reports/{reportId}", DeleteReportAsync)
            .WithName("reports.delete");

        api.MapPost("/reports/{reportId}/runs", StartRunAsync)
            .WithName("reports.runs.create");
        api.MapGet("/reports/{reportId}/runs", ListRunsAsync)
            .WithName("reports.runs.list");
        api.MapGet("/reports/{reportId}/runs/{runId}", GetRunAsync)
            .WithName("reports.runs.get");
        api.MapGet("/reports/{reportId}/runs/{runId}/download", DownloadRunAsync)
            .WithName("reports.runs.download");

        api.MapGet("/reports/schedules", ListSchedulesAsync)
            .WithName("reports.schedules.list");
        api.MapPost("/reports/schedules", CreateScheduleAsync)
            .WithName("reports.schedules.create");
        api.MapPut("/reports/schedules/{scheduleId}", UpdateScheduleAsync)
            .WithName("reports.schedules.update");
        api.MapDelete("/reports/schedules/{scheduleId}", DeleteScheduleAsync)
            .WithName("reports.schedules.delete");

        return api;
    }

    private static async Task<IResult> ListSourcesAsync(
        HttpContext httpContext,
        IEnumerable<IReportSourceReader> readers,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var reportsAccess = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!reportsAccess.Allowed)
        {
            return Forbidden(reportsAccess.Reason);
        }

        var visible = new List<ReportSourceDescriptor>();
        foreach (var descriptor in readers
            .Select(x => x.Descriptor)
            .OrderBy(x => x.Name))
        {
            var sourceAccess = await RequireAsync(
                httpContext,
                accessEvaluator,
                descriptor.RequiredPermission,
                cancellationToken);
            if (sourceAccess.Allowed)
            {
                visible.Add(descriptor);
            }
        }

        return Results.Ok(new { items = visible });
    }

    private static async Task<IResult> ListReportsAsync(
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        string? search,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.ReportDefinitions.AsNoTracking()
            .Where(x => x.Status != "deleted");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(term)
                || (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ReportListItemResponse(
                OpaqueId.Format("rpt", x.Id),
                x.Name,
                x.Description,
                x.SourceKey,
                x.OutputFormat,
                x.Status,
                x.Version,
                x.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        return Results.Ok(new PagedResponse<ReportListItemResponse>(
            items,
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static async Task<IResult> GetReportAsync(
        string reportId,
        HttpContext httpContext,
        ReportsDbContext db,
        IEnumerable<IReportSourceReader> readers,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var id))
        {
            return NotFound("Report not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var report = await db.ReportDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == id && x.Status != "deleted",
                cancellationToken);
        if (report is null)
        {
            return NotFound("Report not found.");
        }

        httpContext.Response.Headers.ETag = Etag(report.Version);
        return Results.Ok(new ResourceResponse<ReportDetailResponse>(
            ToDetail(report, readers)));
    }

    private static async Task<IResult> CreateReportAsync(
        ReportMutationRequest request,
        HttpContext httpContext,
        ReportsDbContext db,
        IEnumerable<IReportSourceReader> readers,
        IAccessEvaluator accessEvaluator,
        ReportsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.create",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var validation = await ValidateDefinitionAsync(
            request,
            httpContext,
            readers,
            accessEvaluator,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var now = DateTimeOffset.UtcNow;
        var report = new ReportDefinition
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = Clean(request.Description),
            SourceKey = validation.Source!.Descriptor.Key,
            ColumnsJson = JsonSerializer.Serialize(validation.Columns),
            FiltersJson = JsonSerializer.Serialize(validation.Filters),
            OutputFormat = "csv",
            Status = "active",
            CreatedByUserId = access.UserId,
            CreatedBySubject = Subject(httpContext),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.ReportDefinitions.Add(report);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("rpt", report.Id);
        await ledger.AppendAuditAsync(
            "reports.definition.created",
            "report",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                report.SourceKey,
                columns = validation.Columns,
                filterCount = validation.Filters.Length
            },
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(report.Version);
        return Results.Created(
            $"/api/v1/reports/{publicId}",
            new ResourceResponse<ReportDetailResponse>(
                ToDetail(report, readers)));
    }

    private static async Task<IResult> UpdateReportAsync(
        string reportId,
        ReportMutationRequest request,
        HttpContext httpContext,
        ReportsDbContext db,
        IEnumerable<IReportSourceReader> readers,
        IAccessEvaluator accessEvaluator,
        ReportsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var id))
        {
            return NotFound("Report not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var report = await db.ReportDefinitions.SingleOrDefaultAsync(
            x => x.Id == id && x.Status != "deleted",
            cancellationToken);
        if (report is null)
        {
            return NotFound("Report not found.");
        }

        var stale = ValidateIfMatch(httpContext, report.Version);
        if (stale is not null)
        {
            return stale;
        }

        var validation = await ValidateDefinitionAsync(
            request,
            httpContext,
            readers,
            accessEvaluator,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        report.Name = request.Name.Trim();
        report.Description = Clean(request.Description);
        report.SourceKey = validation.Source!.Descriptor.Key;
        report.ColumnsJson = JsonSerializer.Serialize(validation.Columns);
        report.FiltersJson = JsonSerializer.Serialize(validation.Filters);
        report.OutputFormat = "csv";
        report.Version++;
        report.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "reports.definition.updated",
            "report",
            reportId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { report.Version, report.SourceKey },
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(report.Version);
        return Results.Ok(new ResourceResponse<ReportDetailResponse>(
            ToDetail(report, readers)));
    }

    private static async Task<IResult> DeleteReportAsync(
        string reportId,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        ReportsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var id))
        {
            return NotFound("Report not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var report = await db.ReportDefinitions.SingleOrDefaultAsync(
            x => x.Id == id && x.Status != "deleted",
            cancellationToken);
        if (report is null)
        {
            return NotFound("Report not found.");
        }

        var stale = ValidateIfMatch(httpContext, report.Version);
        if (stale is not null)
        {
            return stale;
        }

        report.Status = "deleted";
        report.Version++;
        report.UpdatedAt = DateTimeOffset.UtcNow;
        var schedules = await db.ReportSchedules
            .Where(x => x.ReportId == report.Id && x.IsEnabled)
            .ToListAsync(cancellationToken);
        foreach (var schedule in schedules)
        {
            schedule.IsEnabled = false;
            schedule.NextRunAt = null;
            schedule.Version++;
            schedule.UpdatedAt = report.UpdatedAt;
        }
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "reports.definition.deleted",
            "report",
            reportId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { report.Version },
            cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> StartRunAsync(
        string reportId,
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IReportGenerationService generator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var id))
        {
            return NotFound("Report not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.create",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var result = await generator.GenerateAsync(
            new ReportGenerationRequest(
                id,
                access.UserId,
                Subject(httpContext),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                "manual"),
            cancellationToken);

        if (result.RunId is not Guid runId)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Report could not be generated",
                detail: result.ErrorDetail,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = result.ErrorCode
                });
        }

        return Results.Ok(new ResourceResponse<ReportRunStartResponse>(
            new(
                OpaqueId.Format("rpt_run", runId),
                result.Succeeded ? "completed" : "failed",
                result.ErrorCode,
                result.ErrorDetail)));
    }

    private static async Task<IResult> ListRunsAsync(
        string reportId,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var id))
        {
            return NotFound("Report not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.ReportRuns.AsNoTracking()
            .Where(x => x.ReportId == id);
        var total = await query.CountAsync(cancellationToken);
        var runEntities = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArrayAsync(cancellationToken);
        var items = runEntities
            .Select(ToRunListItem)
            .ToArray();

        return Results.Ok(new PagedResponse<ReportRunListItemResponse>(
            items,
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static async Task<IResult> GetRunAsync(
        string reportId,
        string runId,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var reportGuid)
            || !OpaqueId.TryParse(runId, "rpt_run", out var runGuid))
        {
            return NotFound("Report run not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var run = await db.ReportRuns.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == runGuid && x.ReportId == reportGuid,
                cancellationToken);
        if (run is null)
        {
            return NotFound("Report run not found.");
        }

        return Results.Ok(new ResourceResponse<ReportRunDetailResponse>(
            ToRunDetail(run)));
    }

    private static async Task<IResult> DownloadRunAsync(
        string reportId,
        string runId,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(reportId, "rpt", out var reportGuid)
            || !OpaqueId.TryParse(runId, "rpt_run", out var runGuid))
        {
            return NotFound("Report run not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var run = await db.ReportRuns.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == runGuid && x.ReportId == reportGuid,
                cancellationToken);
        if (run is null
            || run.Status != "completed"
            || string.IsNullOrEmpty(run.OutputText))
        {
            return NotFound("Generated report output is not available.");
        }
        if (run.RequestedByUserId != access.UserId)
        {
            return Forbidden("Generated report output is available only to the user whose current scope produced it.");
        }

        return Results.File(
            Encoding.UTF8.GetBytes("\uFEFF" + run.OutputText),
            run.OutputMimeType ?? "text/csv; charset=utf-8",
            run.OutputFileName ?? "report.csv");
    }

    private static async Task<IResult> ListSchedulesAsync(
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var reports = await db.ReportDefinitions.AsNoTracking()
            .Where(x => x.Status != "deleted")
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var schedules = await db.ReportSchedules.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            items = schedules.Select(x => ToSchedule(x, reports.GetValueOrDefault(x.ReportId)))
        });
    }

    private static async Task<IResult> CreateScheduleAsync(
        ReportScheduleMutationRequest request,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var validation = await ValidateScheduleAsync(
            request,
            db,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var now = DateTimeOffset.UtcNow;
        var schedule = new ReportSchedule
        {
            Id = Guid.NewGuid(),
            ReportId = validation.ReportId,
            Name = request.Name.Trim(),
            Cadence = validation.Cadence,
            TimeZoneId = validation.TimeZoneId,
            Hour = validation.Hour,
            Minute = validation.Minute,
            DayOfWeek = validation.DayOfWeek,
            DayOfMonth = validation.DayOfMonth,
            IsEnabled = request.IsEnabled,
            NextRunAt = request.IsEnabled
                ? ReportScheduleClock.NextOccurrence(
                    validation.Cadence,
                    validation.TimeZoneId,
                    validation.Hour,
                    validation.Minute,
                    validation.DayOfWeek,
                    validation.DayOfMonth,
                    now)
                : null,
            CreatedByUserId = access.UserId,
            CreatedBySubject = Subject(httpContext),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.ReportSchedules.Add(schedule);
        await db.SaveChangesAsync(cancellationToken);

        var reportName = await db.ReportDefinitions.AsNoTracking()
            .Where(x => x.Id == schedule.ReportId)
            .Select(x => x.Name)
            .SingleAsync(cancellationToken);
        httpContext.Response.Headers.ETag = Etag(schedule.Version);
        return Results.Created(
            $"/api/v1/reports/schedules/{OpaqueId.Format("rpt_sched", schedule.Id)}",
            new ResourceResponse<ReportScheduleResponse>(
                ToSchedule(schedule, reportName)));
    }

    private static async Task<IResult> UpdateScheduleAsync(
        string scheduleId,
        ReportScheduleMutationRequest request,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(scheduleId, "rpt_sched", out var id))
        {
            return NotFound("Report schedule not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var schedule = await db.ReportSchedules
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (schedule is null)
        {
            return NotFound("Report schedule not found.");
        }
        var stale = ValidateIfMatch(httpContext, schedule.Version);
        if (stale is not null)
        {
            return stale;
        }

        var validation = await ValidateScheduleAsync(
            request,
            db,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var now = DateTimeOffset.UtcNow;
        schedule.ReportId = validation.ReportId;
        schedule.Name = request.Name.Trim();
        schedule.Cadence = validation.Cadence;
        schedule.TimeZoneId = validation.TimeZoneId;
        schedule.Hour = validation.Hour;
        schedule.Minute = validation.Minute;
        schedule.DayOfWeek = validation.DayOfWeek;
        schedule.DayOfMonth = validation.DayOfMonth;
        schedule.IsEnabled = request.IsEnabled;
        schedule.NextRunAt = request.IsEnabled
            ? ReportScheduleClock.NextOccurrence(
                validation.Cadence,
                validation.TimeZoneId,
                validation.Hour,
                validation.Minute,
                validation.DayOfWeek,
                validation.DayOfMonth,
                now)
            : null;
        schedule.Version++;
        schedule.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        var reportName = await db.ReportDefinitions.AsNoTracking()
            .Where(x => x.Id == schedule.ReportId)
            .Select(x => x.Name)
            .SingleAsync(cancellationToken);
        httpContext.Response.Headers.ETag = Etag(schedule.Version);
        return Results.Ok(new ResourceResponse<ReportScheduleResponse>(
            ToSchedule(schedule, reportName)));
    }

    private static async Task<IResult> DeleteScheduleAsync(
        string scheduleId,
        HttpContext httpContext,
        ReportsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(scheduleId, "rpt_sched", out var id))
        {
            return NotFound("Report schedule not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "reports.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var schedule = await db.ReportSchedules
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (schedule is null)
        {
            return NotFound("Report schedule not found.");
        }
        var stale = ValidateIfMatch(httpContext, schedule.Version);
        if (stale is not null)
        {
            return stale;
        }

        db.ReportSchedules.Remove(schedule);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<DefinitionValidation> ValidateDefinitionAsync(
        ReportMutationRequest request,
        HttpContext httpContext,
        IEnumerable<IReportSourceReader> readers,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)
            || request.Name.Trim().Length > 180)
        {
            return DefinitionValidation.Invalid(
                Validation("name", "Report name is required and must be 180 characters or fewer."));
        }

        var source = readers.FirstOrDefault(x =>
            string.Equals(
                x.Descriptor.Key,
                request.SourceKey?.Trim(),
                StringComparison.OrdinalIgnoreCase));
        if (source is null)
        {
            return DefinitionValidation.Invalid(
                Validation("sourceKey", "Select an available report source."));
        }

        var sourceAccess = await RequireAsync(
            httpContext,
            accessEvaluator,
            source.Descriptor.RequiredPermission,
            cancellationToken);
        if (!sourceAccess.Allowed)
        {
            return DefinitionValidation.Invalid(
                Forbidden("REPORT_SOURCE_PERMISSION_DENIED"));
        }

        var allowedColumns = source.Descriptor.Columns
            .Select(x => x.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var columns = (request.Columns ?? [])
            .Where(allowedColumns.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (columns.Length == 0)
        {
            return DefinitionValidation.Invalid(
                Validation("columns", "Select at least one report column."));
        }

        var filterFields = source.Descriptor.FilterFields
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var filters = (request.Filters ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Field)
                && !string.IsNullOrWhiteSpace(x.Value))
            .ToArray();
        if (filters.Any(x =>
            !filterFields.Contains(x.Field)
            || !Operators.Contains(x.Operator)))
        {
            return DefinitionValidation.Invalid(
                Validation("filters", "One or more report filters are not supported by this source."));
        }

        return new DefinitionValidation(
            source,
            columns,
            filters,
            null);
    }

    private static async Task<ScheduleValidation> ValidateScheduleAsync(
        ReportScheduleMutationRequest request,
        ReportsDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)
            || request.Name.Trim().Length > 180)
        {
            return ScheduleValidation.Invalid(
                Validation("name", "Schedule name is required and must be 180 characters or fewer."));
        }

        if (!OpaqueId.TryParse(request.ReportId ?? "", "rpt", out var reportId)
            || !await db.ReportDefinitions.AsNoTracking().AnyAsync(
                x => x.Id == reportId && x.Status == "active",
                cancellationToken))
        {
            return ScheduleValidation.Invalid(
                Validation("reportId", "Select an active report."));
        }

        var cadence = request.Cadence?.Trim().ToLowerInvariant() ?? "";
        if (!Cadences.Contains(cadence))
        {
            return ScheduleValidation.Invalid(
                Validation("cadence", "Cadence must be daily, weekly or monthly."));
        }

        if (request.Hour is < 0 or > 23 || request.Minute is < 0 or > 59)
        {
            return ScheduleValidation.Invalid(
                Validation("time", "Select a valid schedule time."));
        }

        if (cadence == "weekly"
            && (request.DayOfWeek is null or < 0 or > 6))
        {
            return ScheduleValidation.Invalid(
                Validation("dayOfWeek", "Weekly schedules require a day from 0 to 6."));
        }

        if (cadence == "monthly"
            && (request.DayOfMonth is null or < 1 or > 31))
        {
            return ScheduleValidation.Invalid(
                Validation("dayOfMonth", "Monthly schedules require a day from 1 to 31."));
        }

        var timeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId)
            ? "Asia/Bangkok"
            : request.TimeZoneId.Trim();
        _ = ReportScheduleClock.ResolveTimeZone(timeZoneId);

        return new ScheduleValidation(
            reportId,
            cadence,
            timeZoneId,
            request.Hour,
            request.Minute,
            cadence == "weekly" ? request.DayOfWeek : null,
            cadence == "monthly" ? request.DayOfMonth : null,
            null);
    }

    private static ReportDetailResponse ToDetail(
        ReportDefinition report,
        IEnumerable<IReportSourceReader> readers)
    {
        var descriptor = readers.FirstOrDefault(x =>
            string.Equals(
                x.Descriptor.Key,
                report.SourceKey,
                StringComparison.OrdinalIgnoreCase))?.Descriptor;
        return new(
            OpaqueId.Format("rpt", report.Id),
            report.Name,
            report.Description,
            report.SourceKey,
            descriptor?.Name ?? report.SourceKey,
            JsonSerializer.Deserialize<string[]>(report.ColumnsJson) ?? [],
            JsonSerializer.Deserialize<ReportFilter[]>(report.FiltersJson) ?? [],
            report.OutputFormat,
            report.Status,
            report.Version,
            report.CreatedAt,
            report.UpdatedAt,
            Etag(report.Version));
    }

    private static ReportRunListItemResponse ToRunListItem(ReportRun run) =>
        new(
            OpaqueId.Format("rpt_run", run.Id),
            run.ReportVersion,
            run.Trigger,
            run.Status,
            run.RowCount,
            run.OutputFileName,
            run.ErrorCode,
            run.CreatedAt,
            run.CompletedAt);

    private static ReportRunDetailResponse ToRunDetail(ReportRun run) =>
        new(
            OpaqueId.Format("rpt_run", run.Id),
            OpaqueId.Format("rpt", run.ReportId),
            run.ReportVersion,
            run.ReportName,
            run.Trigger,
            run.Status,
            run.RowCount,
            run.OutputFileName,
            run.OutputMimeType,
            run.ErrorCode,
            run.ErrorDetail,
            run.CreatedAt,
            run.StartedAt,
            run.CompletedAt);

    private static ReportScheduleResponse ToSchedule(
        ReportSchedule schedule,
        string? reportName) =>
        new(
            OpaqueId.Format("rpt_sched", schedule.Id),
            OpaqueId.Format("rpt", schedule.ReportId),
            reportName ?? "Report",
            schedule.Name,
            schedule.Cadence,
            schedule.TimeZoneId,
            schedule.Hour,
            schedule.Minute,
            schedule.DayOfWeek,
            schedule.DayOfMonth,
            schedule.IsEnabled,
            schedule.NextRunAt,
            schedule.LastRunAt,
            schedule.LastRunId.HasValue
                ? OpaqueId.Format("rpt_run", schedule.LastRunId.Value)
                : null,
            schedule.Version,
            Etag(schedule.Version));

    private static Task<EffectiveAccess> RequireAsync(
        HttpContext context,
        IAccessEvaluator accessEvaluator,
        string permission,
        CancellationToken cancellationToken) =>
        accessEvaluator.EvaluateAsync(
            context.User,
            permission,
            cancellationToken);

    private static string Subject(HttpContext context) =>
        context.User.FindFirst("sub")?.Value ?? "";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult? ValidateIfMatch(
        HttpContext context,
        long currentVersion)
    {
        var raw = context.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }
        return long.TryParse(value, out var expected)
            && expected == currentVersion
            ? null
            : Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Report changed",
                detail: "Refresh the resource and retry the action.");
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Resource not found",
        detail: detail);

    private static IResult Validation(string field, string detail) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]>
            {
                [field] = [detail]
            },
            title: "Validation failed");

    public sealed record ReportMutationRequest(
        string Name,
        string? Description,
        string? SourceKey,
        IReadOnlyList<string>? Columns,
        IReadOnlyList<ReportFilter>? Filters);

    public sealed record ReportScheduleMutationRequest(
        string Name,
        string? ReportId,
        string? Cadence,
        string? TimeZoneId,
        int Hour,
        int Minute,
        int? DayOfWeek,
        int? DayOfMonth,
        bool IsEnabled);

    private sealed record DefinitionValidation(
        IReportSourceReader? Source,
        string[] Columns,
        ReportFilter[] Filters,
        IResult? Result)
    {
        public static DefinitionValidation Invalid(IResult result) =>
            new(null, [], [], result);
    }

    private sealed record ScheduleValidation(
        Guid ReportId,
        string Cadence,
        string TimeZoneId,
        int Hour,
        int Minute,
        int? DayOfWeek,
        int? DayOfMonth,
        IResult? Result)
    {
        public static ScheduleValidation Invalid(IResult result) =>
            new(Guid.Empty, "", "", 0, 0, null, null, result);
    }

    private sealed record ReportListItemResponse(
        string Id,
        string Name,
        string? Description,
        string SourceKey,
        string OutputFormat,
        string Status,
        long Version,
        DateTimeOffset UpdatedAt);

    private sealed record ReportDetailResponse(
        string Id,
        string Name,
        string? Description,
        string SourceKey,
        string SourceName,
        IReadOnlyList<string> Columns,
        IReadOnlyList<ReportFilter> Filters,
        string OutputFormat,
        string Status,
        long Version,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record ReportRunStartResponse(
        string Id,
        string Status,
        string? ErrorCode,
        string? ErrorDetail);

    private sealed record ReportRunListItemResponse(
        string Id,
        long ReportVersion,
        string Trigger,
        string Status,
        int RowCount,
        string? OutputFileName,
        string? ErrorCode,
        DateTimeOffset CreatedAt,
        DateTimeOffset? CompletedAt);

    private sealed record ReportRunDetailResponse(
        string Id,
        string ReportId,
        long ReportVersion,
        string ReportName,
        string Trigger,
        string Status,
        int RowCount,
        string? OutputFileName,
        string? OutputMimeType,
        string? ErrorCode,
        string? ErrorDetail,
        DateTimeOffset CreatedAt,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt);

    private sealed record ReportScheduleResponse(
        string Id,
        string ReportId,
        string ReportName,
        string Name,
        string Cadence,
        string TimeZoneId,
        int Hour,
        int Minute,
        int? DayOfWeek,
        int? DayOfMonth,
        bool IsEnabled,
        DateTimeOffset? NextRunAt,
        DateTimeOffset? LastRunAt,
        string? LastRunId,
        long Version,
        string ETag);
}
