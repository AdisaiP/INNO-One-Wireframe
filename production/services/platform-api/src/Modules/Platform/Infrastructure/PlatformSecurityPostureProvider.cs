using System.Diagnostics;
using INNO.One.Contracts.Audit;
using INNO.One.Contracts.Security;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Infrastructure;

public sealed class PlatformSecurityPostureProvider(
    PlatformDbContext db,
    IAuditQueryService auditQuery) : ISecurityPostureProvider
{
    private static readonly string[] CriticalPermissions =
    [
        "admin.security.view",
        "admin.security.manage",
        "admin.audit.view"
    ];

    public string Id => "platform-controls";

    public async Task<SecurityPostureSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;
        var controls = new List<SecurityControlSnapshot>();

        var permissionIds = await db.Permissions
            .AsNoTracking()
            .Where(x => CriticalPermissions.Contains(x.PermissionId))
            .Select(x => x.PermissionId)
            .ToArrayAsync(cancellationToken);

        var missingPermissions = CriticalPermissions
            .Except(permissionIds, StringComparer.Ordinal)
            .ToArray();

        controls.Add(new SecurityControlSnapshot(
            "platform.security-permissions",
            "Security permission catalog",
            missingPermissions.Length == 0 ? "healthy" : "attention",
            missingPermissions.Length == 0
                ? "Complete"
                : $"{missingPermissions.Length} missing",
            missingPermissions.Length == 0
                ? "Security and audit permissions are registered in the platform permission catalog."
                : "One or more reserved security permissions are missing from the platform permission catalog."));

        var platformAdmin = await db.Roles
            .AsNoTracking()
            .Where(x => x.Code == "platform_admin" && x.Status == "active")
            .Select(x => new { x.Id })
            .FirstOrDefaultAsync(cancellationToken);

        if (platformAdmin is null)
        {
            controls.Add(new SecurityControlSnapshot(
                "platform.admin-role",
                "Platform Admin security grants",
                "attention",
                "Role unavailable",
                "The active platform_admin role could not be found."));
        }
        else
        {
            var granted = await db.RolePermissions
                .AsNoTracking()
                .Where(x => x.RoleId == platformAdmin.Id
                    && CriticalPermissions.Contains(x.PermissionId))
                .Select(x => x.PermissionId)
                .ToArrayAsync(cancellationToken);

            var missingGrants = CriticalPermissions
                .Except(granted, StringComparer.Ordinal)
                .ToArray();

            controls.Add(new SecurityControlSnapshot(
                "platform.admin-role",
                "Platform Admin security grants",
                missingGrants.Length == 0 ? "healthy" : "attention",
                missingGrants.Length == 0
                    ? "Granted"
                    : $"{missingGrants.Length} missing",
                missingGrants.Length == 0
                    ? "The built-in Platform Admin role has the reserved Security and Audit permissions."
                    : "The built-in Platform Admin role is missing one or more Security/Audit grants."));
        }

        try
        {
            var facets = await auditQuery.GetFacetsAsync(cancellationToken);
            controls.Add(new SecurityControlSnapshot(
                "platform.audit-ledger",
                "Audit ledger availability",
                "healthy",
                "Readable",
                facets.Modules.Count == 0
                    ? "The immutable audit ledger is reachable and currently has no module facets."
                    : $"The immutable audit ledger is reachable across {facets.Modules.Count} module facet(s)."));
        }
        catch
        {
            controls.Add(new SecurityControlSnapshot(
                "platform.audit-ledger",
                "Audit ledger availability",
                "unavailable",
                "Unavailable",
                "The Security Center could not read the immutable audit ledger."));
        }

        controls.Add(new SecurityControlSnapshot(
            "platform.authorization-model",
            "Authorization boundary",
            "informational",
            "Permission + resource scope",
            "Protected Admin APIs evaluate authorization server-side through the shared access evaluator."));

        var status = controls.Any(x => x.Status is "attention" or "unavailable")
            ? "attention"
            : "healthy";

        return new SecurityPostureSnapshot(
            "platform-controls",
            "Platform Authorization & Audit",
            "Platform",
            "platform",
            status,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            "Platform posture verifies the registered Security/Audit permissions and the audit-ledger read path.",
            controls);
    }
}
