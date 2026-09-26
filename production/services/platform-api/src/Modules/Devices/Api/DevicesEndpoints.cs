using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class DevicesEndpoints
{
    public static RouteGroupBuilder MapDevicesEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices", ListAsync)
            .WithName("devices.list");

        api.MapGet("/devices/{deviceId}", GetAsync)
            .WithName("devices.get");

        return api;
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? sort = "lastSeenAt",
        string? order = "desc",
        string? status = null,
        string? os = null,
        string? groupId = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<Device> query = db.Devices.AsNoTracking();

        if (!access.AllResources)
        {
            var organizationIds = access.OrganizationIds.ToArray();
            var locationIds = access.LocationIds.ToArray();
            var accessGroupIds = access.DeviceGroupIds.ToArray();

            query = query.Where(device =>
                (device.OrganizationUnitId.HasValue && organizationIds.Contains(device.OrganizationUnitId.Value))
                || (device.LocationId.HasValue && locationIds.Contains(device.LocationId.Value))
                || db.DeviceGroupMembers.Any(member =>
                    member.DeviceId == device.Id && accessGroupIds.Contains(member.GroupId)));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Hostname.ToLower().Contains(term)
                || (x.SerialNumber != null && x.SerialNumber.ToLower().Contains(term))
                || (x.IpAddress != null && x.IpAddress.ToLower().Contains(term))
                || (x.OperatingSystem != null && x.OperatingSystem.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLower();
            query = query.Where(x => x.ConnectivityState == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(os) && !string.Equals(os, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedOs = os.Trim().ToLower();
            query = query.Where(x => x.OperatingSystem != null && x.OperatingSystem.ToLower().Contains(normalizedOs));
        }

        if (!string.IsNullOrWhiteSpace(groupId))
        {
            if (!OpaqueId.TryParse(groupId, "grp", out var parsedGroupId))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Invalid groupId");
            }

            query = query.Where(x => db.DeviceGroupMembers.Any(m => m.GroupId == parsedGroupId && m.DeviceId == x.Id));
        }

        query = ApplySort(query, sort, order);

        var totalItems = await query.CountAsync(cancellationToken);
        var devices = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var deviceIds = devices.Select(x => x.Id).ToArray();
        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => deviceIds.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);
        var groupIds = memberships.Select(x => x.GroupId).Distinct().ToArray();
        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => groupIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var directory = await directoryReader.ReadAsync(
            devices.Where(x => x.OwnerUserId.HasValue).Select(x => x.OwnerUserId!.Value).Distinct().ToArray(),
            devices.Where(x => x.OrganizationUnitId.HasValue).Select(x => x.OrganizationUnitId!.Value).Distinct().ToArray(),
            devices.Where(x => x.LocationId.HasValue).Select(x => x.LocationId!.Value).Distinct().ToArray(),
            cancellationToken);

        var items = devices.Select(device =>
        {
            var deviceMemberships = memberships.Where(x => x.DeviceId == device.Id).ToArray();
            var group = deviceMemberships
                .Select(x => groups.GetValueOrDefault(x.GroupId))
                .FirstOrDefault(x => x is not null);

            return new DeviceListItem(
                OpaqueId.Format("dev", device.Id),
                device.Hostname,
                device.DeviceType,
                device.ConnectivityState,
                device.IpAddress,
                device.SerialNumber,
                device.OwnerUserId is Guid ownerId ? directory.Users.GetValueOrDefault(ownerId) : null,
                device.OperatingSystem,
                group,
                device.OrganizationUnitId is Guid orgId ? directory.Organizations.GetValueOrDefault(orgId) : null,
                device.LocationId is Guid locationId ? directory.Locations.GetValueOrDefault(locationId) : null,
                device.LastSeenAt);
        }).ToList();

        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<DeviceListItem>(items, page, pageSize, totalItems, totalPages));
    }

    private static async Task<IResult> GetAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Device not found");
        }

        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var device = await db.Devices.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Device not found");
        }

        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => x.DeviceId == device.Id)
            .ToListAsync(cancellationToken);
        var deviceGroupIds = memberships.Select(x => x.GroupId).ToHashSet();

        if (!CanAccessDevice(access, device, deviceGroupIds))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => deviceGroupIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .Select(x => new ReferenceResponse(OpaqueId.Format("grp", x.Id), x.Name))
            .ToListAsync(cancellationToken);

        var directory = await directoryReader.ReadAsync(
            device.OwnerUserId is Guid ownerId ? new[] { ownerId } : Array.Empty<Guid>(),
            device.OrganizationUnitId is Guid orgId ? new[] { orgId } : Array.Empty<Guid>(),
            device.LocationId is Guid locationId ? new[] { locationId } : Array.Empty<Guid>(),
            cancellationToken);

        var provider = await db.DeviceExternalMappings.AsNoTracking()
            .Where(x => x.DeviceId == device.Id)
            .Select(x => x.Provider)
            .FirstOrDefaultAsync(cancellationToken);

        var response = new DeviceDetail(
            OpaqueId.Format("dev", device.Id),
            device.Hostname,
            device.DeviceType,
            device.ConnectivityState,
            device.ConnectivityState != "online",
            device.OwnerUserId is Guid owner ? directory.Users.GetValueOrDefault(owner) : null,
            device.OrganizationUnitId is Guid organization
                ? new ReferenceResponse(OpaqueId.Format("org", organization), directory.Organizations.GetValueOrDefault(organization) ?? "Unknown")
                : null,
            device.LocationId is Guid location
                ? new ReferenceResponse(OpaqueId.Format("loc", location), directory.Locations.GetValueOrDefault(location) ?? "Unknown")
                : null,
            groups,
            device.SerialNumber,
            device.IpAddress,
            device.MacAddress,
            device.OperatingSystem,
            device.Manufacturer,
            device.Model,
            device.Processor,
            device.BiosVersion,
            device.LoggedOnUser,
            device.AssetReference,
            device.AgentVersion,
            device.LastSeenAt,
            device.CpuPercent,
            device.MemoryUsedGb,
            device.MemoryTotalGb,
            device.DiskUsedGb,
            device.DiskTotalGb,
            string.Equals(provider, "meshcentral", StringComparison.OrdinalIgnoreCase) ? "MeshCentral" : provider);

        return Results.Ok(new ResourceResponse<DeviceDetail>(response));
    }

    private static bool CanAccessDevice(EffectiveAccess access, Device device, IReadOnlySet<Guid> groupIds)
    {
        if (access.AllResources)
        {
            return true;
        }

        return (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            || (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            || groupIds.Any(access.DeviceGroupIds.Contains);
    }

    private static IQueryable<Device> ApplySort(IQueryable<Device> query, string? sort, string? order)
    {
        var descending = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return (sort?.Trim().ToLowerInvariant()) switch
        {
            "name" => descending ? query.OrderByDescending(x => x.Hostname) : query.OrderBy(x => x.Hostname),
            "status" => descending ? query.OrderByDescending(x => x.ConnectivityState) : query.OrderBy(x => x.ConnectivityState),
            "os" => descending ? query.OrderByDescending(x => x.OperatingSystem) : query.OrderBy(x => x.OperatingSystem),
            _ => descending
                ? query.OrderByDescending(x => x.LastSeenAt).ThenBy(x => x.Hostname)
                : query.OrderBy(x => x.LastSeenAt).ThenBy(x => x.Hostname)
        };
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record DeviceListItem(
        string Id,
        string Name,
        string Type,
        string Status,
        string? IpAddress,
        string? SerialNumber,
        string? User,
        string? OperatingSystem,
        string? Group,
        string? Organization,
        string? Location,
        DateTimeOffset? LastSeenAt);

    private sealed record DeviceDetail(
        string Id,
        string Name,
        string Type,
        string Status,
        bool IsOffline,
        string? AssignedUser,
        ReferenceResponse? Organization,
        ReferenceResponse? Location,
        IReadOnlyList<ReferenceResponse> Groups,
        string? SerialNumber,
        string? IpAddress,
        string? MacAddress,
        string? OperatingSystem,
        string? Manufacturer,
        string? Model,
        string? Processor,
        string? BiosVersion,
        string? LoggedOnUser,
        string? AssetReference,
        string? AgentVersion,
        DateTimeOffset? LastSeenAt,
        int? CpuPercent,
        decimal? MemoryUsedGb,
        decimal? MemoryTotalGb,
        decimal? DiskUsedGb,
        decimal? DiskTotalGb,
        string? ManagementEngine);
}
