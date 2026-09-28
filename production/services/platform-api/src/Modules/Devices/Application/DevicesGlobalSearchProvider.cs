using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Search;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class DevicesGlobalSearchProvider(
    DevicesDbContext db,
    IAccessEvaluator accessEvaluator) : IGlobalSearchProvider
{
    public string ProviderId => "devices";

    public async Task<IReadOnlyList<GlobalSearchResult>> SearchAsync(
        ClaimsPrincipal principal,
        string query,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "devices.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Array.Empty<GlobalSearchResult>();
        }

        IQueryable<Device> search = db.Devices.AsNoTracking();

        if (!access.AllResources)
        {
            var organizations = access.OrganizationIds.ToArray();
            var locations = access.LocationIds.ToArray();
            var groups = access.DeviceGroupIds.ToArray();

            search = search.Where(device =>
                (device.OrganizationUnitId.HasValue
                    && organizations.Contains(device.OrganizationUnitId.Value))
                || (device.LocationId.HasValue
                    && locations.Contains(device.LocationId.Value))
                || db.DeviceGroupMembers.Any(member =>
                    member.DeviceId == device.Id
                    && groups.Contains(member.GroupId)));
        }

        var term = query.Trim().ToLowerInvariant();
        search = search.Where(device =>
            device.Hostname.ToLower().Contains(term)
            || (device.SerialNumber != null
                && device.SerialNumber.ToLower().Contains(term))
            || (device.IpAddress != null
                && device.IpAddress.ToLower().Contains(term))
            || (device.OperatingSystem != null
                && device.OperatingSystem.ToLower().Contains(term)));

        var rows = await search
            .OrderBy(device => device.Hostname)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return rows.Select(device => new GlobalSearchResult(
            "device",
            OpaqueId.Format("dev", device.Id),
            device.Hostname,
            string.Join(
                " · ",
                new[] { "Devices", device.ConnectivityState, device.OperatingSystem }
                    .Where(value => !string.IsNullOrWhiteSpace(value))),
            "/devices/" + OpaqueId.Format("dev", device.Id)))
            .ToArray();
    }
}
