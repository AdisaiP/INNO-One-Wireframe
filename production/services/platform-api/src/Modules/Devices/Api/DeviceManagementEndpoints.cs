using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Integrations;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace INNO.One.Modules.Devices.Api;

public static class DeviceManagementEndpoints
{
    public static RouteGroupBuilder MapDeviceManagementEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/groups", ListGroupsAsync)
            .WithName("devices.groups.list");

        api.MapPost("/devices/groups", CreateGroupAsync)
            .WithName("devices.groups.create");

        api.MapGet("/devices/groups/{groupId}", GetGroupAsync)
            .WithName("devices.groups.get");

        api.MapPatch("/devices/groups/{groupId}", UpdateGroupAsync)
            .WithName("devices.groups.update");

        api.MapGet("/devices/groups/{groupId}/members", ListGroupMembersAsync)
            .WithName("devices.group_members.list");

        api.MapPost("/devices/discovery-scans", CreateDiscoveryScanAsync)
            .WithName("devices.discovery_scan.create");

        api.MapGet("/devices/discovery-scans/{scanId}", GetDiscoveryScanAsync)
            .WithName("devices.discovery_scan.get");

        api.MapGet("/devices/discovery-scans/{scanId}/results", ListDiscoveryResultsAsync)
            .WithName("devices.discovery_results.list");

        api.MapPost("/devices/agent-installers", CreateAgentInstallerAsync)
            .WithName("devices.agent_installer.create");

        return api;
    }

    private static async Task<IResult> ListGroupsAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? type = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<DeviceGroup> query = db.DeviceGroups.AsNoTracking();
        query = ApplyGroupScope(query, access);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(term)
                || x.Code.ToLower().Contains(term)
                || (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(type)
            && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = type.Trim().ToLower();
            query = query.Where(x => x.GroupType == normalized);
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLower();
            query = query.Where(x => x.Status == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var groups = await query
            .OrderBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var groupIds = groups.Select(x => x.Id).ToArray();
        var memberCounts = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => groupIds.Contains(x.GroupId))
            .GroupBy(x => x.GroupId)
            .Select(x => new { GroupId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, cancellationToken);

        var onlineCounts = await (
            from member in db.DeviceGroupMembers.AsNoTracking()
            join device in db.Devices.AsNoTracking() on member.DeviceId equals device.Id
            where groupIds.Contains(member.GroupId) && device.ConnectivityState == "online"
            group member by member.GroupId into grouped
            select new { GroupId = grouped.Key, Count = grouped.Count() }
        ).ToDictionaryAsync(x => x.GroupId, x => x.Count, cancellationToken);

        var directory = await directoryReader.ReadAsync(
            Array.Empty<Guid>(),
            groups.Where(x => x.OrganizationUnitId.HasValue)
                .Select(x => x.OrganizationUnitId!.Value).Distinct().ToArray(),
            groups.Where(x => x.LocationId.HasValue)
                .Select(x => x.LocationId!.Value).Distinct().ToArray(),
            cancellationToken);

        var items = groups.Select(group => new DeviceGroupListItem(
            OpaqueId.Format("grp", group.Id),
            group.Code,
            group.Name,
            group.Description,
            group.GroupType,
            group.Status,
            group.SyncStatus,
            group.OrganizationUnitId is Guid orgId
                ? directory.Organizations.GetValueOrDefault(orgId)
                : null,
            group.LocationId is Guid locationId
                ? directory.Locations.GetValueOrDefault(locationId)
                : null,
            memberCounts.GetValueOrDefault(group.Id),
            onlineCounts.GetValueOrDefault(group.Id),
            group.LastSyncedAt,
            Etag(group.Version))).ToList();

        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<DeviceGroupListItem>(
            items, page, pageSize, totalItems, totalPages));
    }

    private static async Task<IResult> CreateGroupAsync(
        CreateDeviceGroupRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IRemoteDeviceEngine remoteEngine,
        DeviceLedgerWriter ledger,
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
            return Validation("name", "Group name is required.");
        }

        var groupType = string.IsNullOrWhiteSpace(request.GroupType)
            ? "static"
            : request.GroupType.Trim().ToLowerInvariant();
        if (groupType != "static")
        {
            return Validation(
                "groupType",
                "Step 16 implements static managed groups. Dynamic rule groups remain hidden until their rule engine is implemented.");
        }

        if (!TryParseOptionalId(request.OrganizationId, "org", out var organizationId)
            || !TryParseOptionalId(request.LocationId, "loc", out var locationId))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid resource identifier.");
        }

        if (!CanCreateGroupInScope(access, organizationId, locationId))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var code = NormalizeCode(request.Code, request.Name);
        if (await db.DeviceGroups.AnyAsync(x => x.Code == code, cancellationToken))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Device group already exists",
                detail: $"A group with code '{code}' already exists.");
        }

        RemoteDeviceGroup? remoteGroup = null;
        if (remoteEngine.IsEnabled)
        {
            try
            {
                remoteGroup = await remoteEngine.CreateGroupAsync(
                    request.Name.Trim(),
                    request.Description?.Trim(),
                    cancellationToken);
            }
            catch (RemoteEngineUnavailableException ex)
            {
                return RemoteUnavailable(ex.Message);
            }
        }

        var now = DateTimeOffset.UtcNow;
        var group = new DeviceGroup
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = NullIfWhiteSpace(request.Description),
            GroupType = groupType,
            OrganizationUnitId = organizationId,
            LocationId = locationId,
            ExternalProvider = remoteGroup is null ? null : "meshcentral",
            ExternalGroupId = remoteGroup?.ExternalId,
            SyncStatus = remoteGroup is null ? "local" : "pending",
            Status = "active",
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.DeviceGroups.Add(group);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("grp", group.Id);
        await ledger.AppendAuditAsync(
            "devices.group.created",
            "device_group",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                group.Code,
                group.Name,
                group.GroupType,
                organizationId = request.OrganizationId,
                locationId = request.LocationId,
                meshCentralProvisioned = remoteGroup is not null
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(group.Version);
        return Results.Created(
            $"/api/v1/devices/groups/{publicId}",
            new ResourceResponse<DeviceGroupMutationResponse>(
                ToMutationResponse(group, publicId)));
    }

    private static async Task<IResult> GetGroupAsync(
        string groupId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(groupId, "grp", out var id))
        {
            return NotFound("Device group not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var group = await db.DeviceGroups.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (group is null)
        {
            return NotFound("Device group not found.");
        }

        if (!CanAccessGroup(access, group))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var stats = await (
            from member in db.DeviceGroupMembers.AsNoTracking()
            join device in db.Devices.AsNoTracking() on member.DeviceId equals device.Id
            where member.GroupId == id
            group device by 1 into grouped
            select new
            {
                Members = grouped.Count(),
                Online = grouped.Count(x => x.ConnectivityState == "online")
            }
        ).SingleOrDefaultAsync(cancellationToken);

        var directory = await directoryReader.ReadAsync(
            Array.Empty<Guid>(),
            group.OrganizationUnitId is Guid orgId ? new[] { orgId } : Array.Empty<Guid>(),
            group.LocationId is Guid locationId ? new[] { locationId } : Array.Empty<Guid>(),
            cancellationToken);

        var response = new DeviceGroupDetailResponse(
            groupId,
            group.Code,
            group.Name,
            group.Description,
            group.GroupType,
            group.Status,
            group.SyncStatus,
            group.OrganizationUnitId is Guid organization
                ? new ReferenceResponse(
                    OpaqueId.Format("org", organization),
                    directory.Organizations.GetValueOrDefault(organization) ?? "Unknown")
                : null,
            group.LocationId is Guid location
                ? new ReferenceResponse(
                    OpaqueId.Format("loc", location),
                    directory.Locations.GetValueOrDefault(location) ?? "Unknown")
                : null,
            stats?.Members ?? 0,
            stats?.Online ?? 0,
            group.LastSyncedAt,
            Etag(group.Version));

        httpContext.Response.Headers.ETag = Etag(group.Version);
        return Results.Ok(new ResourceResponse<DeviceGroupDetailResponse>(response));
    }

    private static async Task<IResult> UpdateGroupAsync(
        string groupId,
        UpdateDeviceGroupRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IRemoteDeviceEngine remoteEngine,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(groupId, "grp", out var id))
        {
            return NotFound("Device group not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var group = await db.DeviceGroups.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (group is null)
        {
            return NotFound("Device group not found.");
        }

        if (!CanAccessGroup(access, group))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        if (!TryReadVersion(httpContext.Request.Headers.IfMatch, out var expectedVersion))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match is required",
                detail: "Send the ETag returned by the device-group resource.");
        }

        if (expectedVersion != group.Version)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Device group changed",
                detail: "Refresh the group and retry your update.");
        }

        var nextName = string.IsNullOrWhiteSpace(request.Name)
            ? group.Name
            : request.Name.Trim();
        var nextDescription = request.Description is null
            ? group.Description
            : NullIfWhiteSpace(request.Description);
        var nextStatus = request.Status is null
            ? group.Status
            : request.Status.Trim().ToLowerInvariant();

        if (nextStatus is not ("active" or "inactive"))
        {
            return Validation("status", "Status must be active or inactive.");
        }

        if (group.ExternalProvider == "meshcentral"
            && !string.IsNullOrWhiteSpace(group.ExternalGroupId))
        {
            if (!remoteEngine.IsEnabled)
            {
                return RemoteUnavailable(
                    "The group is mapped to MeshCentral but the integration is disabled.");
            }

            try
            {
                await remoteEngine.UpdateGroupAsync(
                    group.ExternalGroupId,
                    nextName,
                    nextDescription,
                    cancellationToken);
            }
            catch (RemoteEngineUnavailableException ex)
            {
                return RemoteUnavailable(ex.Message);
            }
        }

        var before = new { group.Name, group.Description, group.Status };
        group.Name = nextName;
        group.Description = nextDescription;
        group.Status = nextStatus;
        group.SyncStatus = group.ExternalGroupId is null ? "local" : "pending";
        group.Version++;
        group.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "devices.group.updated",
            "device_group",
            groupId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                before,
                after = new { group.Name, group.Description, group.Status }
            },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(group.Version);
        return Results.Ok(new ResourceResponse<DeviceGroupMutationResponse>(
            ToMutationResponse(group, groupId)));
    }

    private static async Task<IResult> ListGroupMembersAsync(
        string groupId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(groupId, "grp", out var id))
        {
            return NotFound("Device group not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var group = await db.DeviceGroups.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (group is null)
        {
            return NotFound("Device group not found.");
        }

        if (!CanAccessGroup(access, group))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query =
            from member in db.DeviceGroupMembers.AsNoTracking()
            join device in db.Devices.AsNoTracking() on member.DeviceId equals device.Id
            where member.GroupId == id
            select device;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Hostname.ToLower().Contains(term)
                || (x.IpAddress != null && x.IpAddress.ToLower().Contains(term))
                || (x.OperatingSystem != null && x.OperatingSystem.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLower();
            query = query.Where(x => x.ConnectivityState == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var devices = await query
            .OrderBy(x => x.Hostname)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var directory = await directoryReader.ReadAsync(
            devices.Where(x => x.OwnerUserId.HasValue)
                .Select(x => x.OwnerUserId!.Value).Distinct().ToArray(),
            devices.Where(x => x.OrganizationUnitId.HasValue)
                .Select(x => x.OrganizationUnitId!.Value).Distinct().ToArray(),
            devices.Where(x => x.LocationId.HasValue)
                .Select(x => x.LocationId!.Value).Distinct().ToArray(),
            cancellationToken);

        var items = devices.Select(device => new DeviceGroupMemberResponse(
            OpaqueId.Format("dev", device.Id),
            device.Hostname,
            device.DeviceType,
            device.ConnectivityState,
            device.OwnerUserId is Guid ownerId
                ? directory.Users.GetValueOrDefault(ownerId)
                : null,
            device.OrganizationUnitId is Guid orgId
                ? directory.Organizations.GetValueOrDefault(orgId)
                : null,
            device.LocationId is Guid locationId
                ? directory.Locations.GetValueOrDefault(locationId)
                : null,
            device.IpAddress,
            device.OperatingSystem,
            device.LastSeenAt)).ToList();

        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<DeviceGroupMemberResponse>(
            items, page, pageSize, totalItems, totalPages));
    }

    private static async Task<IResult> CreateDiscoveryScanAsync(
        CreateDiscoveryScanRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var ranges = (request.Ranges ?? Array.Empty<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (!PrivateNetworkRange.TryExpand(ranges, out var addresses, out var error))
        {
            return Validation("ranges", error ?? "Invalid discovery ranges.");
        }

        var now = DateTimeOffset.UtcNow;
        var scan = new DiscoveryScan
        {
            Id = Guid.NewGuid(),
            OperationId = Guid.NewGuid(),
            RequestedByUserId = access.UserId,
            RangesJson = JsonSerializer.Serialize(ranges),
            Status = "queued",
            Progress = 0,
            AddressesScanned = 0,
            DevicesFound = 0,
            UnmanagedCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.DiscoveryScans.Add(scan);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.CreateOperationAsync(
            scan.OperationId,
            "devices.discovery_scan",
            "discovery_scan",
            scan.Id,
            OpaqueId.Format("user", access.UserId),
            "devices.manage",
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var scanId = OpaqueId.Format("scan", scan.Id);
        var operationId = OpaqueId.Format("op", scan.OperationId);
        var statusUrl = $"/api/v1/operations/{operationId}";
        return Results.Accepted(
            statusUrl,
            new OperationResponse(
                operationId,
                "queued",
                statusUrl,
                0,
                new { scanId, addressCount = addresses.Count }));
    }

    private static async Task<IResult> GetDiscoveryScanAsync(
        string scanId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(scanId, "scan", out var id))
        {
            return NotFound("Discovery scan not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var scan = await db.DiscoveryScans.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (scan is null)
        {
            return NotFound("Discovery scan not found.");
        }

        var ranges = JsonSerializer.Deserialize<string[]>(scan.RangesJson) ?? [];
        return Results.Ok(new ResourceResponse<DiscoveryScanResponse>(
            new DiscoveryScanResponse(
                scanId,
                OpaqueId.Format("op", scan.OperationId),
                scan.Status,
                scan.Progress,
                ranges,
                scan.AddressesScanned,
                scan.DevicesFound,
                scan.UnmanagedCount,
                scan.ErrorCode,
                scan.StartedAt,
                scan.CompletedAt,
                scan.CreatedAt)));
    }

    private static async Task<IResult> ListDiscoveryResultsAsync(
        string scanId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(scanId, "scan", out var id))
        {
            return NotFound("Discovery scan not found.");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!await db.DiscoveryScans.AsNoTracking()
            .AnyAsync(x => x.Id == id, cancellationToken))
        {
            return NotFound("Discovery scan not found.");
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<DiscoveryResult> query = db.DiscoveryResults.AsNoTracking()
            .Where(x => x.ScanId == id);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.IpAddress.ToLower().Contains(term)
                || (x.Hostname != null && x.Hostname.ToLower().Contains(term))
                || (x.DetectedOperatingSystem != null && x.DetectedOperatingSystem.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLower();
            query = query.Where(x => x.ManagementStatus == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var resultRows = await query
            .OrderBy(x => x.IpAddress)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var rows = resultRows.Select(x => new DiscoveryResultResponse(
            OpaqueId.Format("disc", x.Id),
            x.IpAddress,
            x.Hostname,
            x.DetectedOperatingSystem,
            x.Vendor,
            x.DiscoveryMethod,
            x.ManagementStatus,
            x.MatchedDeviceId.HasValue
                ? OpaqueId.Format("dev", x.MatchedDeviceId.Value)
                : null,
            x.DiscoveredAt)).ToList();

        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<DiscoveryResultResponse>(
            rows, page, pageSize, totalItems, totalPages));
    }

    private static async Task<IResult> CreateAgentInstallerAsync(
        CreateAgentInstallerRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IRemoteDeviceEngine remoteEngine,
        DeviceLedgerWriter ledger,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.deploy", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!OpaqueId.TryParse(request.GroupId, "grp", out var groupId))
        {
            return Validation("groupId", "A valid Device Group is required.");
        }

        var group = await db.DeviceGroups.SingleOrDefaultAsync(
            x => x.Id == groupId,
            cancellationToken);
        if (group is null)
        {
            return NotFound("Device group not found.");
        }

        if (!CanAccessGroup(access, group))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        if (string.IsNullOrWhiteSpace(request.OperatingSystem))
        {
            return Validation("operatingSystem", "Operating system is required.");
        }

        var operatingSystem = request.OperatingSystem.Trim().ToLowerInvariant();
        if (operatingSystem is not ("windows" or "macos" or "linux"))
        {
            return Validation(
                "operatingSystem",
                "Operating system must be windows, macos or linux.");
        }

        if (!remoteEngine.IsEnabled)
        {
            return RemoteUnavailable(
                "MeshCentral integration must be enabled to generate an enrollment package.");
        }

        if (string.IsNullOrWhiteSpace(group.ExternalGroupId))
        {
            try
            {
                var remoteGroup = await remoteEngine.CreateGroupAsync(
                    group.Name,
                    group.Description,
                    cancellationToken);

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                group.ExternalProvider = "meshcentral";
                group.ExternalGroupId = remoteGroup.ExternalId;
                group.SyncStatus = "pending";
                group.Version++;
                group.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                await ledger.AppendAuditAsync(
                    "devices.group.updated",
                    "device_group",
                    request.GroupId,
                    OpaqueId.Format("user", access.UserId),
                    CorrelationId(httpContext),
                    httpContext.TraceIdentifier,
                    new { changeType = "meshcentral_provisioned" },
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (RemoteEngineUnavailableException ex)
            {
                return RemoteUnavailable(ex.Message);
            }
        }

        var expiresHours = Math.Clamp(request.ExpiresHours ?? 24, 1, 168);
        RemoteEnrollmentLink enrollment;
        try
        {
            enrollment = await remoteEngine.CreateEnrollmentLinkAsync(
                group.ExternalGroupId!,
                expiresHours,
                cancellationToken);
        }
        catch (RemoteEngineUnavailableException ex)
        {
            return RemoteUnavailable(ex.Message);
        }

        string? endpointEnrollmentToken = null;
        string? endpointInstallerUrl = null;
        DateTimeOffset? endpointEnrollmentExpiresAt = null;

        if (operatingSystem == "windows")
        {
            endpointInstallerUrl = configuration["EndpointAgent:InstallerUrl"];
            if (string.IsNullOrWhiteSpace(endpointInstallerUrl))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Endpoint Agent package unavailable",
                    detail: "EndpointAgent:InstallerUrl is not configured.");
            }

            endpointEnrollmentToken = DeviceMachineAuthenticator.GenerateToken("enr");
            endpointEnrollmentExpiresAt = DateTimeOffset.UtcNow.AddHours(expiresHours);
            var endpointTokenEntity = new DeviceEnrollmentToken
            {
                Id = Guid.NewGuid(),
                TokenHash = DeviceMachineAuthenticator.HashSecret(endpointEnrollmentToken),
                GroupId = groupId,
                IntendedOwnerUserId = null,
                CreatedByUserId = access.UserId,
                Label = $"Agent Deployment · {group.Name}",
                Status = "active",
                ExpiresAt = endpointEnrollmentExpiresAt.Value,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.DeviceEnrollmentTokens.Add(endpointTokenEntity);
            await db.SaveChangesAsync(cancellationToken);

            await ledger.AppendAuditAsync(
                "devices.agent_enrollment_token.created",
                "device_enrollment_token",
                OpaqueId.Format("enroll", endpointTokenEntity.Id),
                OpaqueId.Format("user", access.UserId),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                new
                {
                    groupId = request.GroupId,
                    operatingSystem,
                    profile = string.IsNullOrWhiteSpace(request.Profile)
                        ? "standard"
                        : request.Profile.Trim().ToLowerInvariant(),
                    expiresAt = endpointEnrollmentExpiresAt
                },
                cancellationToken,
                classification: "restricted");
        }

        httpContext.Response.Headers.CacheControl = "no-store";
        return Results.Ok(new ResourceResponse<AgentInstallerResponse>(
            new AgentInstallerResponse(
                OpaqueId.Format("ins", Guid.NewGuid()),
                request.GroupId,
                group.Name,
                operatingSystem,
                string.IsNullOrWhiteSpace(request.Profile)
                    ? "standard"
                    : request.Profile.Trim().ToLowerInvariant(),
                enrollment.Url,
                enrollment.ExpiresAt,
                endpointInstallerUrl,
                endpointEnrollmentToken,
                endpointEnrollmentExpiresAt,
                "ready")));
    }

    private static IQueryable<DeviceGroup> ApplyGroupScope(
        IQueryable<DeviceGroup> query,
        EffectiveAccess access)
    {
        if (access.AllResources)
        {
            return query;
        }

        var organizations = access.OrganizationIds.ToArray();
        var locations = access.LocationIds.ToArray();
        var groups = access.DeviceGroupIds.ToArray();

        return query.Where(x =>
            groups.Contains(x.Id)
            || (x.OrganizationUnitId.HasValue && organizations.Contains(x.OrganizationUnitId.Value))
            || (x.LocationId.HasValue && locations.Contains(x.LocationId.Value)));
    }

    private static bool CanAccessGroup(EffectiveAccess access, DeviceGroup group) =>
        access.AllResources
        || access.DeviceGroupIds.Contains(group.Id)
        || (group.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
        || (group.LocationId is Guid locationId && access.LocationIds.Contains(locationId));

    private static bool CanCreateGroupInScope(
        EffectiveAccess access,
        Guid? organizationId,
        Guid? locationId) =>
        access.AllResources
        || (organizationId.HasValue && access.OrganizationIds.Contains(organizationId.Value))
        || (locationId.HasValue && access.LocationIds.Contains(locationId.Value));

    private static bool TryParseOptionalId(
        string? value,
        string prefix,
        out Guid? id)
    {
        id = null;
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        if (!OpaqueId.TryParse(value, prefix, out var parsed))
        {
            return false;
        }

        id = parsed;
        return true;
    }

    private static string NormalizeCode(string? code, string name)
    {
        var source = string.IsNullOrWhiteSpace(code) ? name : code;
        var normalized = new string(source
            .Trim()
            .ToUpperInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .ToArray());

        while (normalized.Contains("--", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);
        }

        normalized = normalized.Trim('-');
        if (normalized.Length == 0)
        {
            normalized = "GROUP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        }

        return normalized.Length <= 64 ? normalized : normalized[..64];
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Etag(long version) => $"W/\"{version}\"";

    private static bool TryReadVersion(string? raw, out long version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal) && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        return long.TryParse(value, out version);
    }

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Resource not found",
        detail: detail);

    private static IResult Validation(string field, string detail) => Results.ValidationProblem(
        new Dictionary<string, string[]>
        {
            [field] = new[] { detail }
        },
        title: "Validation failed");

    private static IResult RemoteUnavailable(string detail) => Results.Problem(
        statusCode: StatusCodes.Status503ServiceUnavailable,
        title: "Remote device engine unavailable",
        detail: detail);

    private static DeviceGroupMutationResponse ToMutationResponse(
        DeviceGroup group,
        string publicId) =>
        new(
            publicId,
            group.Code,
            group.Name,
            group.Description,
            group.GroupType,
            group.Status,
            group.SyncStatus,
            group.LastSyncedAt,
            Etag(group.Version));

    public sealed record CreateDeviceGroupRequest(
        string Name,
        string? Code,
        string? Description,
        string? GroupType,
        string? OrganizationId,
        string? LocationId);

    public sealed record UpdateDeviceGroupRequest(
        string? Name,
        string? Description,
        string? Status);

    public sealed record CreateDiscoveryScanRequest(
        IReadOnlyList<string>? Ranges);

    public sealed record CreateAgentInstallerRequest(
        string GroupId,
        string OperatingSystem,
        string? Profile,
        int? ExpiresHours);

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record DeviceGroupListItem(
        string Id,
        string Code,
        string Name,
        string? Description,
        string GroupType,
        string Status,
        string SyncStatus,
        string? Organization,
        string? Location,
        int Members,
        int Online,
        DateTimeOffset? LastSyncedAt,
        string ETag);

    private sealed record DeviceGroupDetailResponse(
        string Id,
        string Code,
        string Name,
        string? Description,
        string GroupType,
        string Status,
        string SyncStatus,
        ReferenceResponse? Organization,
        ReferenceResponse? Location,
        int Members,
        int Online,
        DateTimeOffset? LastSyncedAt,
        string ETag);

    private sealed record DeviceGroupMutationResponse(
        string Id,
        string Code,
        string Name,
        string? Description,
        string GroupType,
        string Status,
        string SyncStatus,
        DateTimeOffset? LastSyncedAt,
        string ETag);

    private sealed record DeviceGroupMemberResponse(
        string Id,
        string Name,
        string Type,
        string Status,
        string? User,
        string? Organization,
        string? Location,
        string? IpAddress,
        string? OperatingSystem,
        DateTimeOffset? LastSeenAt);

    private sealed record OperationResponse(
        string OperationId,
        string Status,
        string StatusUrl,
        int Progress,
        object Resource);

    private sealed record DiscoveryScanResponse(
        string Id,
        string OperationId,
        string Status,
        int Progress,
        IReadOnlyList<string> Ranges,
        int AddressesScanned,
        int DevicesFound,
        int UnmanagedCount,
        string? ErrorCode,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt,
        DateTimeOffset CreatedAt);

    private sealed record DiscoveryResultResponse(
        string Id,
        string IpAddress,
        string? Hostname,
        string? DetectedOperatingSystem,
        string? Vendor,
        string DiscoveryMethod,
        string ManagementStatus,
        string? MatchedDeviceId,
        DateTimeOffset DiscoveredAt);

    private sealed record AgentInstallerResponse(
        string Id,
        string GroupId,
        string GroupName,
        string OperatingSystem,
        string Profile,
        string EnrollmentUrl,
        DateTimeOffset? ExpiresAt,
        string? EndpointInstallerUrl,
        string? EndpointEnrollmentToken,
        DateTimeOffset? EndpointEnrollmentExpiresAt,
        string Status);
}
