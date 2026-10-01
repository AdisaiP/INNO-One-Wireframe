using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class InventoryQueryEndpoints
{
    public static RouteGroupBuilder MapInventoryQueryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/inventory-queries", ListSavedQueriesAsync)
            .WithName("devices.inventory_queries.list");
        api.MapPost("/devices/inventory-queries", CreateSavedQueryAsync)
            .WithName("devices.inventory_queries.save");
        api.MapPost("/devices/inventory-queries/runs", CreateRunAsync)
            .WithName("devices.inventory_queries.run");
        api.MapGet("/devices/inventory-queries/runs/{runId}/results", ListResultsAsync)
            .WithName("devices.inventory_query_results.list");
        return api;
    }

    private static async Task<IResult> ListSavedQueriesAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        IQueryable<InventoryQuery> query = db.InventoryQueries.AsNoTracking()
            .Where(x => x.CreatedByUserId == access.UserId && x.Status == "active");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term)
                || x.Value.ToLower().Contains(term));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var saved = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var queryIds = saved.Select(x => x.Id).ToArray();
        var runRows = await db.InventoryQueryRuns.AsNoTracking()
            .Where(x => x.SavedQueryId.HasValue && queryIds.Contains(x.SavedQueryId.Value))
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var latestRun = runRows.GroupBy(x => x.SavedQueryId!.Value)
            .ToDictionary(x => x.Key, x => x.First());
        var items = saved.Select(item =>
        {
            latestRun.TryGetValue(item.Id, out var run);
            return ToSavedQueryResponse(item, run);
        }).ToList();

        return Results.Ok(new { items, totalItems });
    }

    private static async Task<IResult> CreateSavedQueryAsync(
        CreateInventoryQueryRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Validation("name", "Query name is required.");
        }

        if (!TryNormalizeDefinition(
                request.FactType, request.Field, request.Operator,
                request.Value, request.ScopeType, request.ScopeId,
                out var definition, out var validation))
        {
            return validation!;
        }

        var scopeError = await ValidateScopeAsync(
            definition, access, db, cancellationToken);
        if (scopeError is not null)
        {
            return scopeError;
        }

        var name = request.Name.Trim();
        if (name.Length > 160)
        {
            return Validation("name", "Query name must be 160 characters or fewer.");
        }

        if (await db.InventoryQueries.AnyAsync(
                x => x.CreatedByUserId == access.UserId && x.Name == name,
                cancellationToken))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Saved query already exists",
                detail: "Use a different query name.");
        }

        var now = DateTimeOffset.UtcNow;
        var saved = new InventoryQuery
        {
            Id = Guid.NewGuid(),
            CreatedByUserId = access.UserId,
            Name = name,
            FactType = definition.FactType,
            Field = definition.Field,
            Operator = definition.Operator,
            Value = definition.Value,
            ScopeType = definition.ScopeType,
            ScopeId = definition.ScopeId,
            Status = "active",
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.InventoryQueries.Add(saved);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            "/api/v1/devices/inventory-queries",
            new ResourceResponse<InventoryQueryListItem>(
                ToSavedQueryResponse(saved, null)));
    }

    private static async Task<IResult> CreateRunAsync(
        RunInventoryQueryRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        Guid? savedQueryId = null;
        InventoryQueryDefinition definition;

        if (!string.IsNullOrWhiteSpace(request.SavedQueryId))
        {
            if (!OpaqueId.TryParse(request.SavedQueryId, "iq", out var parsed))
            {
                return Validation("savedQueryId", "Saved query identifier is invalid.");
            }

            var saved = await db.InventoryQueries.AsNoTracking()
                .SingleOrDefaultAsync(
                    x => x.Id == parsed
                        && x.CreatedByUserId == access.UserId
                        && x.Status == "active",
                    cancellationToken);
            if (saved is null)
            {
                return NotFound("Saved inventory query not found.");
            }

            savedQueryId = saved.Id;
            definition = new InventoryQueryDefinition(
                saved.FactType, saved.Field, saved.Operator, saved.Value,
                saved.ScopeType, saved.ScopeId);
        }
        else if (!TryNormalizeDefinition(
                     request.FactType, request.Field, request.Operator,
                     request.Value, request.ScopeType, request.ScopeId,
                     out definition, out var validation))
        {
            return validation!;
        }

        var scopeError = await ValidateScopeAsync(
            definition, access, db, cancellationToken);
        if (scopeError is not null)
        {
            return scopeError;
        }

        var accessScope = new InventoryQueryAccessScope(
            access.AllResources,
            access.OrganizationIds.ToArray(),
            access.LocationIds.ToArray(),
            access.DeviceGroupIds.ToArray());

        var now = DateTimeOffset.UtcNow;
        var run = new InventoryQueryRun
        {
            Id = Guid.NewGuid(),
            OperationId = Guid.NewGuid(),
            RequestedByUserId = access.UserId,
            SavedQueryId = savedQueryId,
            DefinitionJson = JsonSerializer.Serialize(definition),
            AccessScopeJson = JsonSerializer.Serialize(accessScope),
            Status = "queued",
            Progress = 0,
            DevicesEvaluated = 0,
            MatchCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.InventoryQueryRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.CreateOperationAsync(
            run.OperationId,
            "devices.inventory_query",
            "inventory_query_run",
            run.Id,
            OpaqueId.Format("user", access.UserId),
            "devices.view",
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var runId = OpaqueId.Format("iqr", run.Id);
        var operationId = OpaqueId.Format("op", run.OperationId);
        var statusUrl = $"/api/v1/operations/{operationId}";
        return Results.Accepted(
            statusUrl,
            new InventoryQueryOperationAccepted(
                operationId,
                "queued",
                statusUrl,
                0,
                new InventoryQueryOperationResource(
                    runId,
                    savedQueryId.HasValue ? OpaqueId.Format("iq", savedQueryId.Value) : null)));
    }

    private static async Task<IResult> ListResultsAsync(
        string runId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(runId, "iqr", out var id))
        {
            return NotFound("Inventory query run not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var run = await db.InventoryQueryRuns.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == id && x.RequestedByUserId == access.UserId,
                cancellationToken);
        if (run is null)
        {
            return NotFound("Inventory query run not found.");
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var accessibleDevices = ApplyAccessScope(
            db.Devices.AsNoTracking(),
            db,
            access);

        var query =
            from result in db.InventoryQueryResults.AsNoTracking()
            join device in accessibleDevices
                on result.DeviceId equals device.Id
            where result.RunId == id
            select new { Result = result, Device = device };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Device.Hostname.ToLower().Contains(term)
                || x.Result.FactName.ToLower().Contains(term)
                || (x.Result.FactVersion != null && x.Result.FactVersion.ToLower().Contains(term))
                || (x.Result.FactPublisher != null && x.Result.FactPublisher.ToLower().Contains(term)));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(x => x.Device.Hostname)
            .ThenBy(x => x.Result.FactName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var ownerIds = rows
            .Where(x => x.Device.OwnerUserId.HasValue)
            .Select(x => x.Device.OwnerUserId!.Value)
            .Distinct()
            .ToArray();
        var directory = await directoryReader.ReadAsync(
            ownerIds,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);

        var items = rows.Select(x => new InventoryQueryResultItem(
            OpaqueId.Format("iqres", x.Result.Id),
            OpaqueId.Format("dev", x.Device.Id),
            x.Device.Hostname,
            x.Device.OwnerUserId is Guid ownerId
                ? directory.Users.GetValueOrDefault(ownerId)
                : null,
            x.Device.IpAddress,
            x.Result.FactType,
            x.Result.FactName,
            x.Result.FactVersion,
            x.Result.FactPublisher,
            x.Result.MatchedValue,
            x.Result.ObservedAt,
            x.Device.LastSeenAt)).ToList();

        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<InventoryQueryResultItem>(
            items, page, pageSize, totalItems, totalPages));
    }

    private static bool TryNormalizeDefinition(
        string? factType,
        string? field,
        string? operation,
        string? value,
        string? scopeType,
        string? scopeId,
        out InventoryQueryDefinition definition,
        out IResult? validation)
    {
        definition = new InventoryQueryDefinition(
            "software", "name", "contains", "", "all", null);
        validation = null;

        var normalizedFact = (factType ?? "").Trim().ToLowerInvariant();
        if (normalizedFact != "software")
        {
            validation = Validation(
                "factType",
                "Software is the only fact type backed by the current production inventory source.");
            return false;
        }

        var normalizedField = (field ?? "").Trim().ToLowerInvariant();
        if (normalizedField is not ("name" or "version" or "publisher"))
        {
            validation = Validation(
                "field",
                "Field must be name, version or publisher.");
            return false;
        }

        var normalizedOperator = (operation ?? "").Trim().ToLowerInvariant();
        var validOperator = normalizedField == "version"
            ? normalizedOperator is "equals" or "version_less_than"
            : normalizedOperator is "contains" or "equals";
        if (!validOperator)
        {
            validation = Validation(
                "operator",
                normalizedField == "version"
                    ? "Version supports equals or version_less_than."
                    : "This field supports contains or equals.");
            return false;
        }
        var normalizedValue = (value ?? "").Trim();
        if (normalizedValue.Length == 0)
        {
            validation = Validation("value", "Condition value is required.");
            return false;
        }

        var normalizedScope = string.IsNullOrWhiteSpace(scopeType)
            ? "all"
            : scopeType.Trim().ToLowerInvariant();
        if (normalizedScope is not ("all" or "group"))
        {
            validation = Validation("scopeType", "Scope must be all or group.");
            return false;
        }

        Guid? parsedScopeId = null;
        if (normalizedScope == "group")
        {
            if (!OpaqueId.TryParse(scopeId, "grp", out var groupId))
            {
                validation = Validation(
                    "scopeId",
                    "A valid Device Group is required for group scope.");
                return false;
            }
            parsedScopeId = groupId;
        }

        definition = new InventoryQueryDefinition(
            normalizedFact,
            normalizedField,
            normalizedOperator,
            normalizedValue,
            normalizedScope,
            parsedScopeId);
        return true;
    }

    private static async Task<IResult?> ValidateScopeAsync(
        InventoryQueryDefinition definition,
        EffectiveAccess access,
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        if (definition.ScopeType != "group" || !definition.ScopeId.HasValue)
        {
            return null;
        }

        var group = await db.DeviceGroups.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == definition.ScopeId.Value, cancellationToken);
        if (group is null)
        {
            return NotFound("Device group not found.");
        }

        if (!CanAccessGroup(access, group))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        return null;
    }

    private static IQueryable<Device> ApplyAccessScope(
        IQueryable<Device> query,
        DevicesDbContext db,
        EffectiveAccess access)
    {
        if (access.AllResources)
        {
            return query;
        }

        var organizations = access.OrganizationIds.ToArray();
        var locations = access.LocationIds.ToArray();
        var groups = access.DeviceGroupIds.ToArray();

        return query.Where(device =>
            (device.OrganizationUnitId.HasValue
                && organizations.Contains(device.OrganizationUnitId.Value))
            || (device.LocationId.HasValue
                && locations.Contains(device.LocationId.Value))
            || db.DeviceGroupMembers.Any(member =>
                groups.Contains(member.GroupId)
                && member.DeviceId == device.Id));
    }

    private static bool CanAccessGroup(EffectiveAccess access, DeviceGroup group) =>
        access.AllResources
        || access.DeviceGroupIds.Contains(group.Id)
        || (group.OrganizationUnitId is Guid orgId
            && access.OrganizationIds.Contains(orgId))
        || (group.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId));

    private static InventoryQueryListItem ToSavedQueryResponse(
        InventoryQuery query,
        InventoryQueryRun? latestRun) =>
        new(
            OpaqueId.Format("iq", query.Id),
            query.Name,
            ToDefinitionResponse(new InventoryQueryDefinition(
                query.FactType,
                query.Field,
                query.Operator,
                query.Value,
                query.ScopeType,
                query.ScopeId)),
            latestRun?.MatchCount,
            latestRun?.CompletedAt,
            query.UpdatedAt);

    private static InventoryQueryDefinitionResponse ToDefinitionResponse(
        InventoryQueryDefinition definition) =>
        new(
            definition.FactType,
            definition.Field,
            definition.Operator,
            definition.Value,
            definition.ScopeType,
            definition.ScopeId.HasValue
                ? OpaqueId.Format("grp", definition.ScopeId.Value)
                : null);

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
            new Dictionary<string, string[]> { [field] = [detail] },
            title: "Validation failed");

    public sealed record CreateInventoryQueryRequest(
        string Name,
        string FactType,
        string Field,
        string Operator,
        string Value,
        string ScopeType,
        string? ScopeId);

    public sealed record RunInventoryQueryRequest(
        string? SavedQueryId,
        string? FactType,
        string? Field,
        string? Operator,
        string? Value,
        string? ScopeType,
        string? ScopeId);

    public sealed record InventoryQueryDefinitionResponse(
        string FactType,
        string Field,
        string Operator,
        string Value,
        string ScopeType,
        string? ScopeId);

    public sealed record InventoryQueryListItem(
        string Id,
        string Name,
        InventoryQueryDefinitionResponse Definition,
        int? LastMatchCount,
        DateTimeOffset? LastRunAt,
        DateTimeOffset UpdatedAt);

    public sealed record InventoryQueryOperationResource(
        string RunId,
        string? SavedQueryId);

    public sealed record InventoryQueryOperationAccepted(
        string OperationId,
        string Status,
        string StatusUrl,
        int Progress,
        InventoryQueryOperationResource Resource);

    public sealed record InventoryQueryResultItem(
        string Id,
        string DeviceId,
        string DeviceName,
        string? User,
        string? IpAddress,
        string FactType,
        string FactName,
        string? FactVersion,
        string? FactPublisher,
        string MatchedValue,
        DateTimeOffset ObservedAt,
        DateTimeOffset? LastSeenAt);
}
