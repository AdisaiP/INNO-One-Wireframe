using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class DevicesWorkspaceAttentionProvider(
    DevicesDbContext db,
    IAccessEvaluator accessEvaluator) : IWorkspaceAttentionProvider, IWorkspaceResourceVisibilityProvider
{
    public string ProviderId => "devices";

    public async Task<IReadOnlyList<WorkspaceAttentionItem>> GetAttentionAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "devices.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }
        IQueryable<Device> query = db.Devices.AsNoTracking();
        if (!access.AllResources)
        {
            var organizations = access.OrganizationIds.ToArray();
            var locations = access.LocationIds.ToArray();
            var groups = access.DeviceGroupIds.ToArray();
            query = query.Where(device =>
                (device.OrganizationUnitId.HasValue
                    && organizations.Contains(device.OrganizationUnitId.Value))
                || (device.LocationId.HasValue
                    && locations.Contains(device.LocationId.Value))
                || db.DeviceGroupMembers.Any(member =>
                    member.DeviceId == device.Id
                    && groups.Contains(member.GroupId)));
        }

        var count = await query.CountAsync(
            device => device.ConnectivityState != "online",
            cancellationToken);
        if (count == 0)
        {
            return Array.Empty<WorkspaceAttentionItem>();
        }
        return
        [
            new WorkspaceAttentionItem(
                "devices.offline",
                "devices",
                count == 1 ? "1 device needs attention" : $"{count} devices need attention",
                "Offline endpoints in your effective scope",
                count,
                "warning",
                "/devices")
        ];
    }

    public async Task<bool> CanAccessAsync(
        ClaimsPrincipal principal,
        string resourceType,
        string resourceId,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(resourceType, "device", StringComparison.Ordinal)
            || !OpaqueId.TryParse(resourceId, "dev", out var id))
        {
            return false;
        }

        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "devices.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return false;
        }

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null || access.AllResources)
        {
            return device is not null;
        }

        var groupIds = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => x.DeviceId == id)
            .Select(x => x.GroupId)
            .ToArrayAsync(cancellationToken);

        return (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            || (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            || groupIds.Any(access.DeviceGroupIds.Contains);
    }
}
