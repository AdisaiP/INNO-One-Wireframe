using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Application;

public sealed class AccessEvaluator(PlatformDbContext db) : IAccessEvaluator
{
    public async Task<EffectiveAccess> EvaluateAsync(
        ClaimsPrincipal principal,
        string permission,
        CancellationToken cancellationToken = default)
    {
        var subject = principal.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Denied(Guid.Empty, permission, "UNAUTHENTICATED");
        }

        var user = await db.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.KeycloakSubject == subject, cancellationToken);

        if (user is null)
        {
            return Denied(Guid.Empty, permission, "PROFILE_NOT_FOUND");
        }

        if (!string.Equals(user.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return Denied(user.Id, permission, "PROFILE_NOT_ACTIVE");
        }

        var moduleId = permission.Split('.', 2)[0];
        if (!string.Equals(moduleId, "platform", StringComparison.Ordinal))
        {
            var module = await db.AppModules.AsNoTracking()
                .SingleOrDefaultAsync(x => x.AppId == moduleId, cancellationToken);
            if (module is null || !module.Installed || !module.Enabled)
            {
                return Denied(user.Id, permission, "MODULE_DISABLED");
            }
        }

        var candidates = await (
            from assignment in db.AccessAssignments.AsNoTracking()
            join rolePermission in db.RolePermissions.AsNoTracking()
                on assignment.RoleId equals rolePermission.RoleId
            where assignment.SubjectType == "user"
                && assignment.SubjectId == user.Id
                && assignment.Status == "active"
                && rolePermission.PermissionId == permission
            select assignment
        ).ToListAsync(cancellationToken);

        if (candidates.Count == 0)
        {
            return Denied(user.Id, permission, "PERMISSION_NOT_GRANTED");
        }

        var assignmentIds = candidates.Select(x => x.Id).ToArray();
        var overrides = await db.AccessAssignmentActions.AsNoTracking()
            .Where(x => assignmentIds.Contains(x.AssignmentId))
            .ToListAsync(cancellationToken);

        var overrideAssignments = overrides.Select(x => x.AssignmentId).ToHashSet();
        candidates = candidates
            .Where(a => !overrideAssignments.Contains(a.Id)
                || overrides.Any(x => x.AssignmentId == a.Id && x.PermissionId == permission))
            .ToList();

        if (candidates.Count == 0)
        {
            return Denied(user.Id, permission, "ACTION_OVERRIDE_DENIED");
        }

        var matchedIds = candidates.Select(x => x.Id).ToArray();
        var resources = await db.AccessAssignmentResources.AsNoTracking()
            .Where(x => matchedIds.Contains(x.AssignmentId))
            .ToListAsync(cancellationToken);

        var allResources = candidates.Any(x => x.ScopeType == "all");
        var organizations = new HashSet<Guid>();
        var locations = new HashSet<Guid>();
        var deviceGroups = new HashSet<Guid>();

        var organizationsWithChildren = candidates
            .Where(x => x.ScopeType == "organization" && x.IncludeChildren)
            .Select(x => x.Id)
            .ToHashSet();
        var locationsWithChildren = candidates
            .Where(x => x.ScopeType == "location" && x.IncludeChildren)
            .Select(x => x.Id)
            .ToHashSet();

        foreach (var resource in resources)
        {
            switch (resource.ResourceType)
            {
                case "organization":
                    organizations.Add(resource.ResourceId);
                    break;
                case "location":
                    locations.Add(resource.ResourceId);
                    break;
                case "device_group":
                    deviceGroups.Add(resource.ResourceId);
                    break;
            }
        }

        if (organizationsWithChildren.Count > 0)
        {
            var roots = resources
                .Where(x => x.ResourceType == "organization" && organizationsWithChildren.Contains(x.AssignmentId))
                .Select(x => x.ResourceId)
                .ToHashSet();
            await ExpandOrganizationDescendantsAsync(roots, organizations, cancellationToken);
        }

        if (locationsWithChildren.Count > 0)
        {
            var roots = resources
                .Where(x => x.ResourceType == "location" && locationsWithChildren.Contains(x.AssignmentId))
                .Select(x => x.ResourceId)
                .ToHashSet();
            await ExpandLocationDescendantsAsync(roots, locations, cancellationToken);
        }

        return new EffectiveAccess(
            true,
            user.Id,
            permission,
            allResources,
            organizations,
            locations,
            deviceGroups,
            matchedIds,
            "ROLE_AND_SCOPE_MATCH");
    }

    private async Task ExpandOrganizationDescendantsAsync(
        HashSet<Guid> roots,
        HashSet<Guid> result,
        CancellationToken cancellationToken)
    {
        if (roots.Count == 0)
        {
            return;
        }

        var rows = await db.OrganizationUnits.AsNoTracking()
            .Select(x => new { x.Id, x.ParentUnitId })
            .ToListAsync(cancellationToken);

        ExpandHierarchy(roots, result, rows.Select(x => (x.Id, x.ParentUnitId)));
    }

    private async Task ExpandLocationDescendantsAsync(
        HashSet<Guid> roots,
        HashSet<Guid> result,
        CancellationToken cancellationToken)
    {
        if (roots.Count == 0)
        {
            return;
        }

        var rows = await db.Locations.AsNoTracking()
            .Select(x => new { x.Id, x.ParentLocationId })
            .ToListAsync(cancellationToken);

        ExpandHierarchy(roots, result, rows.Select(x => (x.Id, x.ParentLocationId)));
    }

    private static void ExpandHierarchy(
        HashSet<Guid> roots,
        HashSet<Guid> result,
        IEnumerable<(Guid Id, Guid? ParentId)> rows)
    {
        foreach (var root in roots)
        {
            result.Add(root);
        }

        var children = rows
            .Where(x => x.ParentId.HasValue)
            .GroupBy(x => x.ParentId!.Value)
            .ToDictionary(x => x.Key, x => x.Select(y => y.Id).ToArray());

        var queue = new Queue<Guid>(roots);
        while (queue.TryDequeue(out var parent))
        {
            if (!children.TryGetValue(parent, out var descendants))
            {
                continue;
            }

            foreach (var child in descendants)
            {
                if (result.Add(child))
                {
                    queue.Enqueue(child);
                }
            }
        }
    }

    private static EffectiveAccess Denied(Guid userId, string permission, string reason) =>
        new(false, userId, permission, false, new HashSet<Guid>(), new HashSet<Guid>(),
            new HashSet<Guid>(), Array.Empty<Guid>(), reason);
}
