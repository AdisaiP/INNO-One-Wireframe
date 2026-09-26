using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;

namespace INNO.One.Modules.Platform.Api;

public static class PlatformEndpoints
{
    public static RouteGroupBuilder MapPlatformEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/platform/me", GetMeAsync)
            .WithName("platform.me.get");

        return api;
    }

    private static async Task<IResult> GetMeAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.workspace.access",
            cancellationToken);

        if (!access.Allowed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Access denied",
                detail: access.Reason);
        }

        var profile = await db.UserProfiles.AsNoTracking()
            .SingleAsync(x => x.Id == access.UserId, cancellationToken);

        var organization = profile.OrganizationUnitId is Guid orgId
            ? await db.OrganizationUnits.AsNoTracking().SingleOrDefaultAsync(x => x.Id == orgId, cancellationToken)
            : null;
        var position = profile.PositionId is Guid positionId
            ? await db.Positions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == positionId, cancellationToken)
            : null;
        var location = profile.LocationId is Guid locationId
            ? await db.Locations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == locationId, cancellationToken)
            : null;

        var assignments = await db.AccessAssignments.AsNoTracking()
            .Where(x => x.SubjectType == "user" && x.SubjectId == profile.Id && x.Status == "active")
            .ToListAsync(cancellationToken);
        var roleIds = assignments.Select(x => x.RoleId).Distinct().ToArray();

        var roles = await db.Roles.AsNoTracking()
            .Where(x => roleIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .Select(x => x.Name)
            .ToListAsync(cancellationToken);

        var rolePermissions = await db.RolePermissions.AsNoTracking()
            .Where(x => roleIds.Contains(x.RoleId))
            .ToListAsync(cancellationToken);
        var assignmentIds = assignments.Select(x => x.Id).ToArray();
        var actionOverrides = await db.AccessAssignmentActions.AsNoTracking()
            .Where(x => assignmentIds.Contains(x.AssignmentId))
            .ToListAsync(cancellationToken);
        var enabledModules = await db.AppModules.AsNoTracking()
            .Where(x => x.Installed && x.Enabled)
            .Select(x => x.AppId)
            .ToHashSetAsync(cancellationToken);

        var effectivePermissions = new HashSet<string>(StringComparer.Ordinal);
        foreach (var assignment in assignments)
        {
            var overrides = actionOverrides
                .Where(x => x.AssignmentId == assignment.Id)
                .Select(x => x.PermissionId)
                .ToHashSet(StringComparer.Ordinal);

            foreach (var permission in rolePermissions
                .Where(x => x.RoleId == assignment.RoleId)
                .Select(x => x.PermissionId))
            {
                if (overrides.Count > 0 && !overrides.Contains(permission))
                {
                    continue;
                }

                var moduleId = permission.Split('.', 2)[0];
                if (!string.Equals(moduleId, "platform", StringComparison.Ordinal)
                    && !enabledModules.Contains(moduleId))
                {
                    continue;
                }

                effectivePermissions.Add(permission);
            }
        }

        var permissions = effectivePermissions.OrderBy(x => x).ToArray();

        var response = new ProfileResponse(
            OpaqueId.Format("user", profile.Id),
            profile.EmployeeId,
            profile.FullName,
            profile.Email,
            profile.Phone,
            profile.Office,
            profile.Status,
            organization is null ? null : new ReferenceResponse(OpaqueId.Format("org", organization.Id), organization.Name),
            position is null ? null : new ReferenceResponse(OpaqueId.Format("pos", position.Id), position.Name),
            location is null ? null : new ReferenceResponse(OpaqueId.Format("loc", location.Id), location.Name),
            roles,
            permissions,
            "Asia/Bangkok",
            "connected");

        return Results.Ok(new ResourceResponse<ProfileResponse>(response));
    }

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record ProfileResponse(
        string Id,
        string EmployeeId,
        string FullName,
        string Email,
        string? Phone,
        string? Office,
        string Status,
        ReferenceResponse? Organization,
        ReferenceResponse? Position,
        ReferenceResponse? Location,
        IReadOnlyList<string> Roles,
        IReadOnlyList<string> Permissions,
        string TimeZone,
        string SsoStatus);
}
