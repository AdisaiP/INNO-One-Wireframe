using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Audit;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class AdminAuditEndpoints
{
    public static RouteGroupBuilder MapAdminAuditEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/audit", ListAuditAsync)
            .WithName("admin.audit.list");
        api.MapGet("/admin/audit/facets", GetAuditFacetsAsync)
            .WithName("admin.audit.facets");
        api.MapGet("/admin/audit/{auditId}", GetAuditAsync)
            .WithName("admin.audit.get");
        return api;
    }

    private static async Task<IResult> ListAuditAsync(
        string? search,
        string? module,
        string? action,
        string? actor,
        string? targetType,
        string? classification,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        HttpContext httpContext,
        IAuditQueryService auditQuery,
        PlatformDbContext platformDb,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.audit.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (from.HasValue && to.HasValue && to < from)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid audit date range",
                detail: "'to' must be greater than or equal to 'from'.");
        }

        var result = await auditQuery.QueryAsync(
            new AuditQuery(
                search,
                module,
                action,
                actor,
                targetType,
                classification,
                from,
                to,
                page,
                pageSize),
            cancellationToken);

        var actorNames = await ResolveActorNamesAsync(
            result.Items.Select(x => x.ActorId),
            platformDb,
            cancellationToken);

        var items = result.Items
            .Select(x => ToListItem(x, actorNames.GetValueOrDefault(x.ActorId)))
            .ToArray();

        return Results.Ok(new PagedResponse<AuditListItemResponse>(
            items,
            result.Page,
            result.PageSize,
            result.TotalItems,
            result.TotalPages));
    }

    private static async Task<IResult> GetAuditAsync(
        string auditId,
        HttpContext httpContext,
        IAuditQueryService auditQuery,
        PlatformDbContext platformDb,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.audit.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!OpaqueId.TryParse(auditId, "aud", out var id))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Audit record not found");
        }

        var row = await auditQuery.GetAsync(id, cancellationToken);
        if (row is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Audit record not found");
        }

        var actorNames = await ResolveActorNamesAsync(
            [row.ActorId],
            platformDb,
            cancellationToken);

        return Results.Ok(new ResourceResponse<AuditDetailResponse>(
            ToDetail(row, actorNames.GetValueOrDefault(row.ActorId))));
    }

    private static async Task<IResult> GetAuditFacetsAsync(
        HttpContext httpContext,
        IAuditQueryService auditQuery,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.audit.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        return Results.Ok(await auditQuery.GetFacetsAsync(cancellationToken));
    }

    private static async Task<Dictionary<string, string>> ResolveActorNamesAsync(
        IEnumerable<string> actorIds,
        PlatformDbContext platformDb,
        CancellationToken cancellationToken)
    {
        var parsed = actorIds
            .Distinct(StringComparer.Ordinal)
            .Select(value => new
            {
                Value = value,
                Parsed = OpaqueId.TryParse(value, "user", out var id),
                Id = id
            })
            .Where(x => x.Parsed)
            .ToArray();

        if (parsed.Length == 0)
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }

        var ids = parsed.Select(x => x.Id).Distinct().ToArray();
        var users = await platformDb.UserProfiles
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName })
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);

        return parsed
            .Where(x => users.ContainsKey(x.Id))
            .ToDictionary(
                x => x.Value,
                x => users[x.Id],
                StringComparer.Ordinal);
    }

    private static AuditListItemResponse ToListItem(
        AuditRecordSnapshot row,
        string? actorName) =>
        new(
            OpaqueId.Format("aud", row.AuditId),
            row.OccurredAt,
            row.Action,
            row.Module,
            row.TargetType,
            row.TargetId,
            row.ActorType,
            row.ActorId,
            actorName,
            row.CorrelationId,
            row.TraceId,
            row.Classification);

    private static AuditDetailResponse ToDetail(
        AuditRecordSnapshot row,
        string? actorName)
    {
        using var document = JsonDocument.Parse(row.MetadataJson);
        return new AuditDetailResponse(
            OpaqueId.Format("aud", row.AuditId),
            row.OccurredAt,
            row.Action,
            row.Module,
            row.TargetType,
            row.TargetId,
            row.ActorType,
            row.ActorId,
            actorName,
            row.CorrelationId,
            row.TraceId,
            row.Classification,
            document.RootElement.Clone());
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private sealed record AuditListItemResponse(
        string AuditId,
        DateTimeOffset OccurredAt,
        string Action,
        string Module,
        string TargetType,
        string TargetId,
        string ActorType,
        string ActorId,
        string? ActorName,
        string? CorrelationId,
        string? TraceId,
        string Classification);

    private sealed record AuditDetailResponse(
        string AuditId,
        DateTimeOffset OccurredAt,
        string Action,
        string Module,
        string TargetType,
        string TargetId,
        string ActorType,
        string ActorId,
        string? ActorName,
        string? CorrelationId,
        string? TraceId,
        string Classification,
        JsonElement Metadata);
}
