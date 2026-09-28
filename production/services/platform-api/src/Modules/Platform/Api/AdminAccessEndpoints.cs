using System.Security.Claims;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class AdminAccessEndpoints
{
    public static RouteGroupBuilder MapAdminAccessEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/roles", GetRolesAsync).WithName("admin.roles.list");
        api.MapGet("/admin/permissions", GetPermissionsAsync).WithName("admin.permissions.list");
        api.MapGet("/admin/access-assignments", GetAssignmentsAsync).WithName("admin.access.assignments.list");
        api.MapGet("/admin/access-assignments/{assignmentId}", GetAssignmentAsync).WithName("admin.access.assignments.get");
        api.MapPut("/admin/access-assignments/{assignmentId}", UpdateAssignmentAsync).WithName("admin.access.assignments.update");
        api.MapGet("/admin/access-scopes/effective-tree", GetEffectiveTreeAsync).WithName("admin.access.scopes.tree");
        api.MapPost("/admin/access-scopes/evaluate", EvaluateAccessAsync).WithName("admin.access.scopes.evaluate");
        return api;
    }

    private static async Task<IResult> GetRolesAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.roles.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var roles = await db.Roles.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var links = await db.RolePermissions.AsNoTracking().ToListAsync(cancellationToken);
        var items = roles.Select(role => new RoleResponse(
            OpaqueId.Format("role", role.Id),
            role.Code,
            role.Name,
            role.Status,
            links.Where(x => x.RoleId == role.Id).Select(x => x.PermissionId).OrderBy(x => x).ToArray(),
            Etag(role.Version))).ToArray();

        return Results.Ok(new { items });
    }

    private static async Task<IResult> GetPermissionsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.roles.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var items = await db.Permissions.AsNoTracking()
            .OrderBy(x => x.Module)
            .ThenBy(x => x.PermissionId)
            .Select(x => new PermissionResponse(x.PermissionId, x.Module, x.Name))
            .ToListAsync(cancellationToken);
        return Results.Ok(new { items });
    }
    private static async Task<IResult> GetAssignmentsAsync(
        string? search,
        string? status,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access_scopes.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var assignments = await db.AccessAssignments.AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(status))
        {
            assignments = assignments
                .Where(x => string.Equals(x.Status, status.Trim(), StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var roleIds = assignments.Select(x => x.RoleId).Distinct().ToArray();
        var subjectIds = assignments.Where(x => x.SubjectType == "user").Select(x => x.SubjectId).Distinct().ToArray();
        var roles = await db.Roles.AsNoTracking()
            .Where(x => roleIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var users = await db.UserProfiles.AsNoTracking()
            .Where(x => subjectIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);
        var assignmentIds = assignments.Select(x => x.Id).ToArray();
        var resources = await db.AccessAssignmentResources.AsNoTracking()
            .Where(x => assignmentIds.Contains(x.AssignmentId))
            .ToListAsync(cancellationToken);
        var actions = await db.AccessAssignmentActions.AsNoTracking()
            .Where(x => assignmentIds.Contains(x.AssignmentId))
            .ToListAsync(cancellationToken);

        var items = assignments.Select(x => ToAssignmentResponse(x, roles, users, resources, actions)).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            items = items.Where(x =>
                    x.SubjectName.Contains(term, StringComparison.OrdinalIgnoreCase)
                    || x.RoleName.Contains(term, StringComparison.OrdinalIgnoreCase)
                    || x.ScopeType.Contains(term, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return Results.Ok(new { items });
    }

    private static async Task<IResult> GetAssignmentAsync(
        string assignmentId,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access_scopes.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(assignmentId, "asg", out var id)) return NotFound("Access assignment not found.");

        var assignment = await db.AccessAssignments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (assignment is null) return NotFound("Access assignment not found.");

        var response = await BuildAssignmentResponseAsync(assignment, db, cancellationToken);
        httpContext.Response.Headers.ETag = Etag(assignment.Version);
        return Results.Ok(new ResourceResponse<AccessAssignmentResponse>(response));
    }
    private static async Task<IResult> UpdateAssignmentAsync(
        string assignmentId,
        AccessAssignmentUpdateRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access_scopes.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(assignmentId, "asg", out var id)) return NotFound("Access assignment not found.");

        var assignment = await db.AccessAssignments.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (assignment is null) return NotFound("Access assignment not found.");
        var stale = ValidateIfMatch(httpContext, assignment.Version);
        if (stale is not null) return stale;

        if (!OpaqueId.TryParse(request.RoleId, "role", out var roleId)
            || !await db.Roles.AnyAsync(x => x.Id == roleId && x.Status == "active", cancellationToken))
        {
            return BadRequest("Role is invalid or inactive.");
        }

        var scopeType = NormalizeScopeType(request.ScopeType);
        if (scopeType is null) return BadRequest("Scope type must be all, organization, location or device_group.");

        var resourceIds = new List<Guid>();
        if (!string.Equals(scopeType, "all", StringComparison.Ordinal))
        {
            if (request.ResourceIds is null || request.ResourceIds.Count == 0)
                return BadRequest("At least one scope resource is required.");

            foreach (var resourceId in request.ResourceIds.Distinct(StringComparer.Ordinal))
            {
                var parsed = await ParseAndValidateScopeResourceAsync(scopeType, resourceId, db, cancellationToken);
                if (parsed.Error is not null) return parsed.Error;
                resourceIds.Add(parsed.Id!.Value);
            }
        }

        var rolePermissions = await db.RolePermissions.AsNoTracking()
            .Where(x => x.RoleId == roleId)
            .Select(x => x.PermissionId)
            .ToListAsync(cancellationToken);
        var rolePermissionSet = rolePermissions.ToHashSet(StringComparer.Ordinal);
        var actionOverrides = (request.ActionOverrides ?? Array.Empty<string>())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var invalidAction = actionOverrides.FirstOrDefault(x => !rolePermissionSet.Contains(x));
        if (invalidAction is not null)
            return BadRequest($"Action override '{invalidAction}' is not granted by the selected role.");

        var previous = await BuildAssignmentResponseAsync(assignment, db, cancellationToken);

        assignment.RoleId = roleId;
        assignment.ScopeType = scopeType;
        assignment.IncludeChildren = request.IncludeChildren && scopeType is "organization" or "location";
        assignment.Status = NormalizeStatus(request.Status);
        assignment.Version++;
        assignment.UpdatedAt = DateTimeOffset.UtcNow;

        var existingResources = await db.AccessAssignmentResources.Where(x => x.AssignmentId == id).ToListAsync(cancellationToken);
        var existingActions = await db.AccessAssignmentActions.Where(x => x.AssignmentId == id).ToListAsync(cancellationToken);
        db.AccessAssignmentResources.RemoveRange(existingResources);
        db.AccessAssignmentActions.RemoveRange(existingActions);

        if (!string.Equals(scopeType, "all", StringComparison.Ordinal))
        {
            db.AccessAssignmentResources.AddRange(resourceIds.Select(resourceId => new AccessAssignmentResource
            {
                AssignmentId = id,
                ResourceType = scopeType,
                ResourceId = resourceId
            }));
        }
        db.AccessAssignmentActions.AddRange(actionOverrides.Select(permissionId => new AccessAssignmentAction
        {
            AssignmentId = id,
            PermissionId = permissionId
        }));

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.access_assignment.updated",
            "access_assignment",
            assignmentId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                previous,
                current = new
                {
                    roleId = request.RoleId,
                    scopeType,
                    resourceIds = request.ResourceIds,
                    assignment.IncludeChildren,
                    actionOverrides,
                    assignment.Status,
                    assignment.Version
                }
            },
            cancellationToken,
            "restricted");
        await tx.CommitAsync(cancellationToken);

        var response = await BuildAssignmentResponseAsync(assignment, db, cancellationToken);
        httpContext.Response.Headers.ETag = Etag(assignment.Version);
        return Results.Ok(new ResourceResponse<AccessAssignmentResponse>(response));
    }
    private static async Task<IResult> GetEffectiveTreeAsync(
        string userId,
        string permission,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access_scopes.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var evaluation = await EvaluateForUserAsync(userId, permission, db, accessEvaluator, cancellationToken);
        if (evaluation.Error is not null) return evaluation.Error;

        var organizations = await db.OrganizationUnits.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var locations = await db.Locations.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var effective = evaluation.Access!;

        return Results.Ok(new
        {
            userId,
            permission,
            allowed = effective.Allowed,
            reason = effective.Reason,
            allResources = effective.AllResources,
            organizations = organizations.Select(x => new
            {
                id = OpaqueId.Format("org", x.Id),
                x.Code,
                x.Name,
                parentId = x.ParentUnitId is Guid parent ? OpaqueId.Format("org", parent) : null,
                effective = effective.AllResources || effective.OrganizationIds.Contains(x.Id)
            }),
            locations = locations.Select(x => new
            {
                id = OpaqueId.Format("loc", x.Id),
                x.Code,
                x.Name,
                parentId = x.ParentLocationId is Guid parent ? OpaqueId.Format("loc", parent) : null,
                effective = effective.AllResources || effective.LocationIds.Contains(x.Id)
            }),
            deviceGroupIds = effective.DeviceGroupIds.Select(x => OpaqueId.Format("grp", x)).ToArray()
        });
    }

    private static async Task<IResult> EvaluateAccessAsync(
        AccessEvaluationRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var adminAccess = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access_scopes.evaluate", cancellationToken);
        if (!adminAccess.Allowed) return Forbidden(adminAccess.Reason);

        var evaluation = await EvaluateForUserAsync(request.UserId, request.Permission, db, accessEvaluator, cancellationToken);
        if (evaluation.Error is not null) return evaluation.Error;

        var result = evaluation.Access!;
        await ledger.AppendAuditAsync(
            "platform.access_evaluated",
            "authorization_decision",
            Guid.NewGuid().ToString("N"),
            OpaqueId.Format("user", adminAccess.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                request.UserId,
                request.Permission,
                result.Allowed,
                result.Reason,
                result.AllResources,
                organizations = result.OrganizationIds.Select(x => OpaqueId.Format("org", x)),
                locations = result.LocationIds.Select(x => OpaqueId.Format("loc", x)),
                deviceGroups = result.DeviceGroupIds.Select(x => OpaqueId.Format("grp", x))
            },
            cancellationToken,
            "restricted");

        return Results.Ok(new ResourceResponse<AccessEvaluationResponse>(
            new(
                request.UserId,
                request.Permission,
                result.Allowed,
                result.Reason,
                result.AllResources,
                result.OrganizationIds.Select(x => OpaqueId.Format("org", x)).ToArray(),
                result.LocationIds.Select(x => OpaqueId.Format("loc", x)).ToArray(),
                result.DeviceGroupIds.Select(x => OpaqueId.Format("grp", x)).ToArray())));
    }
    private static async Task<(EffectiveAccess? Access, IResult? Error)> EvaluateForUserAsync(
        string userId,
        string permission,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(userId, "user", out var id))
            return (null, BadRequest("Invalid user ID."));
        if (string.IsNullOrWhiteSpace(permission)
            || !await db.Permissions.AnyAsync(x => x.PermissionId == permission, cancellationToken))
        {
            return (null, BadRequest("Unknown permission."));
        }

        var user = await db.UserProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null) return (null, NotFound("User not found."));

        var identity = new ClaimsIdentity(
            new[] { new Claim("sub", user.KeycloakSubject) },
            authenticationType: "admin-evaluation");
        var principal = new ClaimsPrincipal(identity);
        var result = await accessEvaluator.EvaluateAsync(principal, permission, cancellationToken);
        return (result, null);
    }

    private static async Task<(Guid? Id, IResult? Error)> ParseAndValidateScopeResourceAsync(
        string scopeType,
        string resourceId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var prefix = scopeType switch
        {
            "organization" => "org",
            "location" => "loc",
            "device_group" => "grp",
            _ => string.Empty
        };
        if (!OpaqueId.TryParse(resourceId, prefix, out var id))
            return (null, BadRequest($"Invalid {scopeType} resource ID."));

        if (scopeType == "organization"
            && !await db.OrganizationUnits.AnyAsync(x => x.Id == id, cancellationToken))
        {
            return (null, NotFound("Organization resource not found."));
        }
        if (scopeType == "location"
            && !await db.Locations.AnyAsync(x => x.Id == id, cancellationToken))
        {
            return (null, NotFound("Location resource not found."));
        }

        return (id, null);
    }

    private static string? NormalizeScopeType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "all" or "organization" or "location" or "device_group"
            ? normalized
            : null;
    }
    private static async Task<AccessAssignmentResponse> BuildAssignmentResponseAsync(
        AccessAssignment assignment,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var role = await db.Roles.AsNoTracking().SingleAsync(x => x.Id == assignment.RoleId, cancellationToken);
        var subjectName = assignment.SubjectType == "user"
            ? await db.UserProfiles.AsNoTracking()
                .Where(x => x.Id == assignment.SubjectId)
                .Select(x => x.FullName)
                .SingleOrDefaultAsync(cancellationToken) ?? OpaqueId.Format("user", assignment.SubjectId)
            : assignment.SubjectId.ToString();

        var resources = await db.AccessAssignmentResources.AsNoTracking()
            .Where(x => x.AssignmentId == assignment.Id)
            .OrderBy(x => x.ResourceType)
            .ThenBy(x => x.ResourceId)
            .ToListAsync(cancellationToken);
        var actions = await db.AccessAssignmentActions.AsNoTracking()
            .Where(x => x.AssignmentId == assignment.Id)
            .OrderBy(x => x.PermissionId)
            .Select(x => x.PermissionId)
            .ToListAsync(cancellationToken);

        return ToAssignmentResponse(
            assignment,
            new Dictionary<Guid, string> { [role.Id] = role.Name },
            assignment.SubjectType == "user"
                ? new Dictionary<Guid, string> { [assignment.SubjectId] = subjectName }
                : new Dictionary<Guid, string>(),
            resources,
            actions.Select(x => new AccessAssignmentAction
            {
                AssignmentId = assignment.Id,
                PermissionId = x
            }).ToList());
    }

    private static AccessAssignmentResponse ToAssignmentResponse(
        AccessAssignment assignment,
        IReadOnlyDictionary<Guid, string> roles,
        IReadOnlyDictionary<Guid, string> users,
        IReadOnlyCollection<AccessAssignmentResource> resources,
        IReadOnlyCollection<AccessAssignmentAction> actions)
    {
        var roleName = roles.TryGetValue(assignment.RoleId, out var role) ? role : "Unknown role";
        var subjectName = assignment.SubjectType == "user" && users.TryGetValue(assignment.SubjectId, out var user)
            ? user
            : assignment.SubjectId.ToString();

        var publicResources = resources
            .Where(x => x.AssignmentId == assignment.Id)
            .Select(x => new ScopeResourceResponse(
                x.ResourceType,
                OpaqueId.Format(ResourcePrefix(x.ResourceType), x.ResourceId)))
            .ToArray();
        var overrides = actions
            .Where(x => x.AssignmentId == assignment.Id)
            .Select(x => x.PermissionId)
            .OrderBy(x => x)
            .ToArray();

        return new AccessAssignmentResponse(
            OpaqueId.Format("asg", assignment.Id),
            assignment.SubjectType,
            OpaqueId.Format(assignment.SubjectType == "user" ? "user" : assignment.SubjectType, assignment.SubjectId),
            subjectName,
            OpaqueId.Format("role", assignment.RoleId),
            roleName,
            assignment.ScopeType,
            publicResources,
            assignment.IncludeChildren,
            overrides,
            assignment.Status,
            Etag(assignment.Version));
    }

    private static string ResourcePrefix(string resourceType) => resourceType switch
    {
        "organization" => "org",
        "location" => "loc",
        "device_group" => "grp",
        _ => resourceType
    };
    private static string NormalizeStatus(string? value) =>
        string.Equals(value, "inactive", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

    private static IResult? ValidateIfMatch(HttpContext httpContext, long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match is required",
                detail: "Refresh this assignment and retry the save.");
        }
        if (!TryReadVersion(raw, out var expected) || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Access assignment changed",
                detail: "Refresh this assignment and retry the save.");
        }
        return null;
    }

    private static bool TryReadVersion(string raw, out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal) && value.EndsWith('"'))
            value = value[3..^1];
        else if (value.StartsWith('"') && value.EndsWith('"'))
            value = value[1..^1];
        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";
    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault() ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult BadRequest(string detail) => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Invalid request",
        detail: detail);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Not found",
        detail: detail);
    private sealed record RoleResponse(
        string Id,
        string Code,
        string Name,
        string Status,
        IReadOnlyList<string> Permissions,
        string ETag);

    private sealed record PermissionResponse(
        string Id,
        string Module,
        string Name);

    private sealed record ScopeResourceResponse(
        string Type,
        string Id);

    private sealed record AccessAssignmentResponse(
        string Id,
        string SubjectType,
        string SubjectId,
        string SubjectName,
        string RoleId,
        string RoleName,
        string ScopeType,
        IReadOnlyList<ScopeResourceResponse> Resources,
        bool IncludeChildren,
        IReadOnlyList<string> ActionOverrides,
        string Status,
        string ETag);

    private sealed record AccessAssignmentUpdateRequest(
        string RoleId,
        string ScopeType,
        IReadOnlyList<string>? ResourceIds,
        bool IncludeChildren,
        IReadOnlyList<string>? ActionOverrides,
        string? Status);

    private sealed record AccessEvaluationRequest(
        string UserId,
        string Permission);

    private sealed record AccessEvaluationResponse(
        string UserId,
        string Permission,
        bool Allowed,
        string Reason,
        bool AllResources,
        IReadOnlyList<string> OrganizationIds,
        IReadOnlyList<string> LocationIds,
        IReadOnlyList<string> DeviceGroupIds);
}
