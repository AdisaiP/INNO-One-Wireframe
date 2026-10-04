using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Workflows.Domain;
using INNO.One.Modules.Workflows.Infrastructure;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Workflows.Api;

public static class WorkflowEndpoints
{
    public static RouteGroupBuilder MapWorkflowEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/workflows", ListAsync).WithName("workflows.list");
        api.MapGet("/workflows/{workflowId}", GetAsync).WithName("workflows.get");
        api.MapPost("/workflows", CreateAsync).WithName("workflows.create");
        api.MapPut("/workflows/{workflowId}", UpdateAsync).WithName("workflows.update");
        api.MapDelete("/workflows/{workflowId}", DeleteAsync).WithName("workflows.delete");
        api.MapGet("/workflows/{workflowId}/versions", ListVersionsAsync).WithName("workflows.versions.list");
        return api;
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.WorkflowDefinitions.AsNoTracking().Where(x => x.Status != "deleted");
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(ToListItem).ToList();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<WorkflowListItem>(items, page, pageSize, totalItems, totalPages));
    }

    private static async Task<IResult> GetAsync(
        string workflowId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(workflowId, "wf", out var id)) return NotFound();

        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var row = await db.WorkflowDefinitions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id && x.Status != "deleted", cancellationToken);
        if (row is null) return NotFound();

        httpContext.Response.Headers.ETag = Etag(row.Version);
        return Results.Ok(new ResourceResponse<WorkflowDetail>(ToDetail(row)));
    }

    private static async Task<IResult> CreateAsync(
        UpsertWorkflowRequest request,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        WorkflowLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var validation = Validate(request);
        if (validation is not null) return validation;

        var now = DateTimeOffset.UtcNow;
        var row = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            NodesJson = request.Nodes.GetRawText(),
            EdgesJson = request.Edges.GetRawText(),
            Orientation = NormalizeOrientation(request.Orientation),
            Status = "draft",
            Version = 1,
            CreatedByUserId = access.UserId,
            UpdatedByUserId = access.UserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        var version = Snapshot(row, access.UserId, now);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.WorkflowDefinitions.Add(row);
        db.WorkflowDefinitionVersions.Add(version);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("wf", row.Id);
        await ledger.AppendAuditAsync(
            "workflow.definition.created",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { row.Name, row.Version, nodeCount = request.Nodes.GetArrayLength(), edgeCount = request.Edges.GetArrayLength() },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(row.Version);
        return Results.Created($"/api/v1/workflows/{publicId}", new ResourceResponse<WorkflowDetail>(ToDetail(row)));
    }

    private static async Task<IResult> UpdateAsync(
        string workflowId,
        UpsertWorkflowRequest request,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        WorkflowLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(workflowId, "wf", out var id)) return NotFound();

        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var validation = Validate(request);
        if (validation is not null) return validation;

        var row = await db.WorkflowDefinitions.SingleOrDefaultAsync(
            x => x.Id == id && x.Status != "deleted", cancellationToken);
        if (row is null) return NotFound();

        var concurrency = ValidateIfMatch(httpContext, row.Version);
        if (concurrency is not null) return concurrency;

        var beforeVersion = row.Version;
        row.Name = request.Name.Trim();
        row.NodesJson = request.Nodes.GetRawText();
        row.EdgesJson = request.Edges.GetRawText();
        row.Orientation = NormalizeOrientation(request.Orientation);
        row.Version++;
        row.UpdatedByUserId = access.UserId;
        row.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.WorkflowDefinitionVersions.Add(Snapshot(row, access.UserId, row.UpdatedAt));
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConcurrencyConflict();
        }
        await ledger.AppendAuditAsync(
            "workflow.definition.updated",
            workflowId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { row.Name, beforeVersion, row.Version, nodeCount = request.Nodes.GetArrayLength(), edgeCount = request.Edges.GetArrayLength() },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(row.Version);
        return Results.Ok(new ResourceResponse<WorkflowDetail>(ToDetail(row)));
    }

    private static async Task<IResult> DeleteAsync(
        string workflowId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        WorkflowLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(workflowId, "wf", out var id)) return NotFound();

        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var row = await db.WorkflowDefinitions.SingleOrDefaultAsync(
            x => x.Id == id && x.Status != "deleted", cancellationToken);
        if (row is null) return NotFound();

        var concurrency = ValidateIfMatch(httpContext, row.Version);
        if (concurrency is not null) return concurrency;

        var beforeVersion = row.Version;
        row.Status = "deleted";
        row.Version++;
        row.UpdatedByUserId = access.UserId;
        row.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.WorkflowDefinitionVersions.Add(Snapshot(row, access.UserId, row.UpdatedAt));
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConcurrencyConflict();
        }

        await ledger.AppendAuditAsync(
            "workflow.definition.deleted",
            workflowId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { row.Name, beforeVersion, row.Version },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListVersionsAsync(
        string workflowId,
        HttpContext httpContext,
        WorkflowsDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(workflowId, "wf", out var id)) return NotFound();

        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "workflows.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        if (!await db.WorkflowDefinitions.AsNoTracking().AnyAsync(x => x.Id == id && x.Status != "deleted", cancellationToken))
            return NotFound();

        var items = await db.WorkflowDefinitionVersions.AsNoTracking()
            .Where(x => x.WorkflowId == id)
            .OrderByDescending(x => x.Version)
            .Select(x => new WorkflowVersionItem(
                x.Version,
                x.Name,
                x.Status,
                OpaqueId.Format("user", x.ChangedByUserId),
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Results.Ok(new { items });
    }

    private static IResult? Validate(UpsertWorkflowRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Validation("name", "Workflow name is required.");
        if (request.Name.Trim().Length > 180)
            return Validation("name", "Workflow name must be 180 characters or fewer.");
        if (request.Nodes.ValueKind != JsonValueKind.Array)
            return Validation("nodes", "Workflow nodes must be an array.");
        if (request.Edges.ValueKind != JsonValueKind.Array)
            return Validation("edges", "Workflow edges must be an array.");
        if (request.Nodes.GetArrayLength() == 0)
            return Validation("nodes", "Workflow must contain at least one node.");
        return null;
    }

    private static WorkflowDefinitionVersion Snapshot(WorkflowDefinition row, Guid actorId, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        WorkflowId = row.Id,
        Version = row.Version,
        Name = row.Name,
        NodesJson = row.NodesJson,
        EdgesJson = row.EdgesJson,
        Orientation = row.Orientation,
        Status = row.Status,
        ChangedByUserId = actorId,
        CreatedAt = now
    };

    private static WorkflowListItem ToListItem(WorkflowDefinition row)
    {
        using var nodes = JsonDocument.Parse(row.NodesJson);
        using var edges = JsonDocument.Parse(row.EdgesJson);
        return new(
            OpaqueId.Format("wf", row.Id),
            row.Name,
            row.Status,
            row.Version,
            nodes.RootElement.GetArrayLength(),
            edges.RootElement.GetArrayLength(),
            row.UpdatedAt,
            Etag(row.Version));
    }

    private static WorkflowDetail ToDetail(WorkflowDefinition row)
    {
        using var nodes = JsonDocument.Parse(row.NodesJson);
        using var edges = JsonDocument.Parse(row.EdgesJson);
        return new(
            OpaqueId.Format("wf", row.Id),
            row.Name,
            nodes.RootElement.Clone(),
            edges.RootElement.Clone(),
            row.Orientation,
            row.Status,
            row.Version,
            row.CreatedAt,
            row.UpdatedAt,
            Etag(row.Version));
    }

    private static string NormalizeOrientation(string? orientation) =>
        string.Equals(orientation, "vertical", StringComparison.OrdinalIgnoreCase) ? "vertical" : "horizontal";

    private static IResult? ValidateIfMatch(HttpContext httpContext, long version)
    {
        var ifMatch = httpContext.Request.Headers.IfMatch.ToString();
        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match is required",
                detail: "Send the workflow ETag when updating a persisted definition.");
        }
        if (!string.Equals(ifMatch, Etag(version), StringComparison.Ordinal))
        {
            return ConcurrencyConflict();
        }
        return null;
    }

    private static IResult ConcurrencyConflict() => Results.Problem(
        statusCode: StatusCodes.Status412PreconditionFailed,
        title: "Workflow changed",
        detail: "The workflow was updated by another request. Reload the latest definition before saving.");

    private static IResult Forbidden(string? reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Permission denied",
        detail: reason ?? "You do not have permission to access workflows.");

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Workflow not found",
        detail: "The workflow definition does not exist or is unavailable.");

    private static IResult Validation(string field, string message) => Results.UnprocessableEntity(new
    {
        type = "https://inno.one/problems/validation",
        title = "Validation failed",
        status = 422,
        code = "VALIDATION_FAILED",
        detail = "One or more fields are invalid.",
        fieldErrors = new Dictionary<string, string[]> { [field] = [message] }
    });

    private static string Etag(long version) => "\"v" + version + "\"";
    private static string CorrelationId(HttpContext httpContext) =>
        string.IsNullOrWhiteSpace(httpContext.Request.Headers["X-Correlation-Id"])
            ? httpContext.TraceIdentifier
            : httpContext.Request.Headers["X-Correlation-Id"].ToString();
}

public sealed record UpsertWorkflowRequest(
    string Name,
    JsonElement Nodes,
    JsonElement Edges,
    string? Orientation);

public sealed record WorkflowListItem(
    string Id,
    string Name,
    string Status,
    long Version,
    int NodeCount,
    int EdgeCount,
    DateTimeOffset UpdatedAt,
    string ETag);

public sealed record WorkflowDetail(
    string Id,
    string Name,
    JsonElement Nodes,
    JsonElement Edges,
    string Orientation,
    string Status,
    long Version,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string ETag);

public sealed record WorkflowVersionItem(
    long Version,
    string Name,
    string Status,
    string ChangedByUserId,
    DateTimeOffset CreatedAt);
