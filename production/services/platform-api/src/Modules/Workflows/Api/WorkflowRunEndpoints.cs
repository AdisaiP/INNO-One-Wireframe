using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Workflows.Application;
using INNO.One.Modules.Workflows.Domain;
using INNO.One.Modules.Workflows.Infrastructure;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Api;

public static class WorkflowRunEndpoints
{
    private const string OwnerModule = "helpdesk";
    private const string ManagePermission = "helpdesk.automation.manage";
    private const string RunViewPermission = "helpdesk.automation.run.view";

    public static RouteGroupBuilder MapWorkflowRunEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/helpdesk/automations/{automationId}/runs", StartHelpdeskRunAsync)
            .WithName("helpdesk.automations.runs.start");
        api.MapGet("/helpdesk/automations/{automationId}/runs", ListHelpdeskRunsAsync)
            .WithName("helpdesk.automations.runs.list");
        api.MapGet("/helpdesk/automations/{automationId}/runs/{runId}", GetHelpdeskRunAsync)
            .WithName("helpdesk.automations.runs.get");
        return api;
    }

    private static async Task<IResult> StartHelpdeskRunAsync(
        string automationId,
        StartAutomationRunRequest request,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IAutomationNodeExecutor> executors,
        WorkflowLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId))
        {
            return AutomationNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            ManagePermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var subject = httpContext.User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Authentication subject missing");
        }

        if (request.Input.ValueKind != JsonValueKind.Object)
        {
            return Validation("input", "Run input must be an object.");
        }

        if (!TryString(request.Input, "ticketId", out var ticketId)
            || !OpaqueId.TryParse(ticketId, "ticket", out _))
        {
            return Validation("ticketId", "Select a valid Helpdesk ticket for this run.");
        }

        var definition = await db.WorkflowDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == workflowId
                    && x.OwnerModule == OwnerModule
                    && x.Status != "deleted",
                cancellationToken);
        if (definition is null)
        {
            return AutomationNotFound();
        }

        var version = await db.WorkflowDefinitionVersions.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.WorkflowId == workflowId
                    && x.Version == definition.Version
                    && x.OwnerModule == OwnerModule,
                cancellationToken);
        if (version is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Automation version unavailable",
                detail: "The current immutable automation version could not be loaded.");
        }

        var executorList = executors.ToList();
        if (!WorkflowExecutionPlanner.TryCreate(
                OwnerModule,
                version.NodesJson,
                version.EdgesJson,
                executorList,
                out _,
                out var planErrorCode,
                out var planErrorDetail))
        {
            return NotExecutable(
                planErrorCode ?? "AUTOMATION_NOT_EXECUTABLE",
                planErrorDetail);
        }

        var snapshot = SnapshotJson(automationId, version);
        var now = DateTimeOffset.UtcNow;
        var run = new WorkflowRun
        {
            Id = Guid.NewGuid(),
            WorkflowId = workflowId,
            WorkflowVersion = version.Version,
            OwnerModule = OwnerModule,
            WorkflowName = version.Name,
            DefinitionSnapshotJson = snapshot,
            InputJson = request.Input.GetRawText(),
            Status = "queued",
            ActiveNodeIdsJson = "[]",
            CompletedNodeIdsJson = "[]",
            AttemptCount = 1,
            MaxAttempts = 3,
            NextAttemptAt = now,
            RequestedByUserId = access.UserId,
            RequestedBySubject = subject,
            CorrelationId = CorrelationId(httpContext),
            TraceId = httpContext.TraceIdentifier,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.WorkflowRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        var publicRunId = OpaqueId.Format("run", run.Id);
        var actorId = OpaqueId.Format("user", access.UserId);

        await ledger.AppendAuditAsync(
            "helpdesk.automation.run.queued",
            OwnerModule,
            "automation_run",
            publicRunId,
            actorId,
            run.CorrelationId,
            run.TraceId,
            new
            {
                ownerModule = OwnerModule,
                workflowId = automationId,
                workflowVersion = version.Version,
                runId = publicRunId,
                ticketId
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "automation.run.queued",
            "workflows",
            "automation_run",
            publicRunId,
            new
            {
                ownerModule = OwnerModule,
                workflowId = automationId,
                workflowVersion = version.Version,
                runId = publicRunId,
                ticketId
            },
            run.CorrelationId,
            null,
            run.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Results.Accepted(
            $"/api/v1/helpdesk/automations/{automationId}/runs/{publicRunId}",
            new ResourceResponse<AutomationRunDetail>(ToDetail(run, [])));
    }

    private static async Task<IResult> ListHelpdeskRunsAsync(
        string automationId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId))
        {
            return AutomationNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            RunViewPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.WorkflowRuns.AsNoTracking()
            .Where(x => x.OwnerModule == OwnerModule && x.WorkflowId == workflowId);

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalizedStatus);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(ToSummary).ToList();
        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);

        return Results.Ok(new PagedResponse<AutomationRunSummary>(
            items,
            page,
            pageSize,
            totalItems,
            totalPages));
    }

    private static async Task<IResult> GetHelpdeskRunAsync(
        string automationId,
        string runId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(automationId, "wf", out var workflowId)
            || !OpaqueId.TryParse(runId, "run", out var parsedRunId))
        {
            return RunNotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            RunViewPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var run = await db.WorkflowRuns.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == parsedRunId
                    && x.WorkflowId == workflowId
                    && x.OwnerModule == OwnerModule,
                cancellationToken);
        if (run is null)
        {
            return RunNotFound();
        }

        var steps = await db.WorkflowRunSteps.AsNoTracking()
            .Where(x => x.RunId == run.Id)
            .OrderBy(x => x.CreatedAt)
            .ThenBy(x => x.Attempt)
            .ToListAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<AutomationRunDetail>(
            ToDetail(run, steps)));
    }

    private static AutomationRunSummary ToSummary(WorkflowRun run) =>
        new(
            OpaqueId.Format("run", run.Id),
            OpaqueId.Format("wf", run.WorkflowId),
            run.WorkflowVersion,
            run.WorkflowName,
            run.Status,
            TicketId(run.InputJson),
            run.AttemptCount,
            run.MaxAttempts,
            run.ErrorCode,
            run.CreatedAt,
            run.StartedAt,
            run.CompletedAt);

    private static AutomationRunDetail ToDetail(
        WorkflowRun run,
        IReadOnlyCollection<WorkflowRunStep> steps)
    {
        using var snapshot = JsonDocument.Parse(run.DefinitionSnapshotJson);
        using var input = JsonDocument.Parse(run.InputJson);
        using var active = JsonDocument.Parse(run.ActiveNodeIdsJson);
        using var completed = JsonDocument.Parse(run.CompletedNodeIdsJson);

        return new AutomationRunDetail(
            OpaqueId.Format("run", run.Id),
            OpaqueId.Format("wf", run.WorkflowId),
            run.WorkflowVersion,
            run.OwnerModule,
            run.WorkflowName,
            run.Status,
            input.RootElement.Clone(),
            snapshot.RootElement.Clone(),
            active.RootElement.Clone(),
            completed.RootElement.Clone(),
            run.FailedNodeId,
            run.AttemptCount,
            run.MaxAttempts,
            run.ErrorCode,
            run.ErrorDetail,
            run.CreatedAt,
            run.StartedAt,
            run.CompletedAt,
            steps.Select(x => new AutomationRunStepDetail(
                OpaqueId.Format("step", x.Id),
                x.NodeId,
                x.NodeKind,
                x.CatalogKey,
                x.Status,
                x.Attempt,
                ParseOptionalJson(x.OutputJson),
                x.ErrorCode,
                x.ErrorDetail,
                x.StartedAt,
                x.CompletedAt)).ToList());
    }

    private static string SnapshotJson(
        string automationId,
        WorkflowDefinitionVersion version)
    {
        using var nodes = JsonDocument.Parse(version.NodesJson);
        using var edges = JsonDocument.Parse(version.EdgesJson);

        return JsonSerializer.Serialize(new
        {
            schemaVersion = 1,
            workflowId = automationId,
            workflowVersion = version.Version,
            ownerModule = version.OwnerModule,
            name = version.Name,
            nodes = nodes.RootElement.Clone(),
            edges = edges.RootElement.Clone(),
            orientation = version.Orientation,
            status = version.Status
        });
    }

    private static JsonElement? ParseOptionalJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private static string? TicketId(string inputJson)
    {
        try
        {
            using var input = JsonDocument.Parse(inputJson);
            return TryString(input.RootElement, "ticketId", out var ticketId)
                ? ticketId
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryString(JsonElement element, string property, out string value)
    {
        value = "";
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var candidate)
            || candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = candidate.GetString()?.Trim() ?? "";
        return value.Length > 0;
    }

    private static IResult NotExecutable(string code, string? detail) =>
        Results.UnprocessableEntity(new
        {
            type = "https://inno.one/problems/automation-not-executable",
            title = "Automation is not executable",
            status = 422,
            code,
            detail = detail ?? "The current definition cannot be executed."
        });

    private static IResult Validation(string field, string message) =>
        Results.UnprocessableEntity(new
        {
            type = "https://inno.one/problems/validation",
            title = "Validation failed",
            status = 422,
            code = "VALIDATION_FAILED",
            detail = "One or more fields are invalid.",
            fieldErrors = new Dictionary<string, string[]> { [field] = new[] { message } }
        });

    private static IResult Forbidden(string? reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Permission denied",
        detail: reason ?? "You do not have permission to view automation runs.");

    private static IResult AutomationNotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Helpdesk automation not found",
        detail: "The automation does not exist in Helpdesk or is unavailable.");

    private static IResult RunNotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Automation run not found",
        detail: "The run does not exist for this Helpdesk automation.");

    private static string CorrelationId(HttpContext httpContext) =>
        string.IsNullOrWhiteSpace(httpContext.Request.Headers["X-Correlation-Id"])
            ? httpContext.TraceIdentifier
            : httpContext.Request.Headers["X-Correlation-Id"].ToString();
}

public sealed record StartAutomationRunRequest(JsonElement Input);

public sealed record AutomationRunSummary(
    string Id,
    string WorkflowId,
    long WorkflowVersion,
    string WorkflowName,
    string Status,
    string? TicketId,
    int AttemptCount,
    int MaxAttempts,
    string? ErrorCode,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt);

public sealed record AutomationRunDetail(
    string Id,
    string WorkflowId,
    long WorkflowVersion,
    string OwnerModule,
    string WorkflowName,
    string Status,
    JsonElement Input,
    JsonElement DefinitionSnapshot,
    JsonElement ActiveNodeIds,
    JsonElement CompletedNodeIds,
    string? FailedNodeId,
    int AttemptCount,
    int MaxAttempts,
    string? ErrorCode,
    string? ErrorDetail,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<AutomationRunStepDetail> Steps);

public sealed record AutomationRunStepDetail(
    string Id,
    string NodeId,
    string NodeKind,
    string CatalogKey,
    string Status,
    int Attempt,
    JsonElement? Output,
    string? ErrorCode,
    string? ErrorDetail,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt);
