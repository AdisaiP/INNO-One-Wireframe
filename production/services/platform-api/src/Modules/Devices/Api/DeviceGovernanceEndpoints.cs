using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class DeviceGovernanceEndpoints
{
    public static RouteGroupBuilder MapDeviceGovernanceEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/overview", GetOverviewAsync)
            .WithName("devices.overview.get");

        api.MapGet("/devices/policies", ListPoliciesAsync)
            .WithName("devices.policies.list");
        api.MapGet("/devices/policies/{policyId}", GetPolicyAsync)
            .WithName("devices.policies.get");
        api.MapPut("/devices/policies/{policyId}", UpdatePolicyAsync)
            .WithName("devices.policies.update");
        api.MapGet("/devices/policies/{policyId}/compliance", ListPolicyComplianceAsync)
            .WithName("devices.policy_compliance.list");

        return api;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var deviceQuery = ApplyDeviceScope(db.Devices.AsNoTracking(), db, access);
        var devices = await deviceQuery
            .OrderByDescending(x => x.LastSeenAt)
            .ToListAsync(cancellationToken);
        var deviceIds = devices.Select(x => x.Id).ToArray();

        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => deviceIds.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);
        var groupIds = memberships.Select(x => x.GroupId).Distinct().ToArray();
        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => groupIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var activeAlerts = await ApplyAlertScope(
                db.DeviceAlerts.AsNoTracking().Where(x => x.Status != "resolved"),
                db,
                access)
            .ToListAsync(cancellationToken);

        var total = devices.Count;
        var online = devices.Count(x =>
            string.Equals(x.ConnectivityState, "online", StringComparison.OrdinalIgnoreCase));
        var offline = total - online;
        var offlineOver24Hours = devices.Count(x =>
            !string.Equals(x.ConnectivityState, "online", StringComparison.OrdinalIgnoreCase)
            && x.LastSeenAt is DateTimeOffset seen
            && seen <= DateTimeOffset.UtcNow.AddHours(-24));
        var criticalAlerts = activeAlerts.Count(x => x.Severity == "critical");

        var accessibleGroupCount = await CountAccessibleGroupsAsync(db, access, cancellationToken);

        var osBreakdown = devices
            .GroupBy(x => OsBucket(x.OperatingSystem))
            .Select(x => new DistributionItem(
                x.Key,
                x.Count(),
                Percent(x.Count(), total)))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Label)
            .ToArray();

        var manufacturerBreakdown = devices
            .GroupBy(x => string.IsNullOrWhiteSpace(x.Manufacturer) ? "Unknown" : x.Manufacturer!)
            .Select(x => new DistributionItem(
                x.Key,
                x.Count(),
                Percent(x.Count(), total)))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Label)
            .Take(6)
            .ToArray();

        var recent = devices.Take(6).Select(device =>
        {
            var group = memberships
                .Where(x => x.DeviceId == device.Id)
                .Select(x => groups.GetValueOrDefault(x.GroupId))
                .FirstOrDefault(x => x is not null);

            return new OverviewDeviceItem(
                OpaqueId.Format("dev", device.Id),
                device.Hostname,
                device.DeviceType,
                device.ConnectivityState,
                device.OperatingSystem,
                group,
                device.LastSeenAt);
        }).ToArray();

        return Results.Ok(new ResourceResponse<DeviceOverviewResponse>(
            new(
                total,
                online,
                offline,
                offlineOver24Hours,
                activeAlerts.Count,
                criticalAlerts,
                accessibleGroupCount,
                devices.Select(x => x.DeviceType).Distinct().Count(),
                Percent(online, total),
                osBreakdown,
                manufacturerBreakdown,
                recent)));
    }

    private static async Task<IResult> ListPoliciesAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var policies = await db.EndpointPolicies.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var assignments = await db.PolicyAssignments.AsNoTracking()
            .ToListAsync(cancellationToken);
        var accessibleDevices = await ApplyDeviceScope(
                db.Devices.AsNoTracking(), db, access)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => accessibleDevices.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);
        var devices = await db.Devices.AsNoTracking()
            .Where(x => accessibleDevices.Contains(x.Id))
            .ToListAsync(cancellationToken);

        var items = policies
            .Where(policy => CanViewPolicy(
                policy.Id,
                assignments,
                access))
            .Select(policy =>
            {
                var policyAssignments = assignments.Where(x => x.PolicyId == policy.Id).ToArray();
                var assignedCount = devices.Count(device =>
                    policyAssignments.Any(assignment =>
                        AssignmentMatches(assignment, device, memberships)));
                return ToPolicySummary(policy, policyAssignments, assignedCount);
            })
            .ToArray();

        return Results.Ok(new { items });
    }

    private static async Task<IResult> GetPolicyAsync(
        string policyId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(policyId, "pol", out var id))
            return NotFound("Endpoint policy not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var policy = await db.EndpointPolicies.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (policy is null)
            return NotFound("Endpoint policy not found.");

        var assignments = await db.PolicyAssignments.AsNoTracking()
            .Where(x => x.PolicyId == id)
            .OrderBy(x => x.ScopeLabel)
            .ToListAsync(cancellationToken);
        if (!CanViewPolicy(id, assignments, access))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var accessibleDevices = await ApplyDeviceScope(
                db.Devices.AsNoTracking(), db, access)
            .ToListAsync(cancellationToken);
        var accessibleDeviceIds = accessibleDevices.Select(x => x.Id).ToArray();
        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => accessibleDeviceIds.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);
        var assignedCount = accessibleDevices.Count(device =>
            assignments.Any(assignment => AssignmentMatches(
                assignment, device, memberships)));

        httpContext.Response.Headers.ETag = Etag(policy.Version);
        return Results.Ok(new ResourceResponse<EndpointPolicyDetail>(
            ToPolicyDetail(policy, assignments, assignedCount)));
    }

    private static async Task<IResult> UpdatePolicyAsync(
        string policyId,
        UpdateEndpointPolicyRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(policyId, "pol", out var id))
            return NotFound("Endpoint policy not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.policy.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var policy = await db.EndpointPolicies
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (policy is null)
            return NotFound("Endpoint policy not found.");

        var assignments = await db.PolicyAssignments.AsNoTracking()
            .Where(x => x.PolicyId == id)
            .ToListAsync(cancellationToken);
        if (!CanManagePolicy(assignments, access))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var status = string.IsNullOrWhiteSpace(request.Status)
            ? policy.Status
            : request.Status.Trim().ToLowerInvariant();
        if (status is not ("enabled" or "disabled" or "draft"))
            return Validation("status", "Status must be enabled, disabled or draft.");

        var configurationJson = policy.ConfigurationJson;
        if (request.Configuration is not null)
        {
            configurationJson = JsonSerializer.Serialize(request.Configuration);
            var validation = ValidatePolicyConfiguration(policy.PolicyType, configurationJson);
            if (validation is not null)
                return validation;
        }

        policy.Status = status;
        policy.ConfigurationJson = configurationJson;
        policy.Version++;
        policy.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("pol", policy.Id);
        await ledger.AppendAuditAsync(
            "devices.policy.updated",
            "endpoint_policy",
            publicId,
            OpaqueId.Format("user", access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                policy.Code,
                policy.PolicyType,
                policy.Status,
                policy.Version
            },
            cancellationToken,
            "internal");

        var accessibleDevices = await ApplyDeviceScope(
                db.Devices.AsNoTracking(), db, access)
            .ToListAsync(cancellationToken);
        var accessibleDeviceIds = accessibleDevices.Select(x => x.Id).ToArray();
        var memberships = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => accessibleDeviceIds.Contains(x.DeviceId))
            .ToListAsync(cancellationToken);
        var assignedCount = accessibleDevices.Count(device =>
            assignments.Any(assignment => AssignmentMatches(
                assignment, device, memberships)));

        httpContext.Response.Headers.ETag = Etag(policy.Version);
        return Results.Ok(new ResourceResponse<EndpointPolicyDetail>(
            ToPolicyDetail(policy, assignments, assignedCount)));
    }

    private static async Task<IResult> ListPolicyComplianceAsync(
        string policyId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(policyId, "pol", out var id))
            return NotFound("Endpoint policy not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var policy = await db.EndpointPolicies.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (policy is null)
            return NotFound("Endpoint policy not found.");

        var assignments = await db.PolicyAssignments.AsNoTracking()
            .Where(x => x.PolicyId == id)
            .ToListAsync(cancellationToken);
        if (!CanViewPolicy(id, assignments, access))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var accessibleDevices = ApplyDeviceScope(db.Devices.AsNoTracking(), db, access);
        var query =
            from compliance in db.PolicyCompliance.AsNoTracking()
            join device in accessibleDevices on compliance.DeviceId equals device.Id
            where compliance.PolicyId == id
            select new { compliance, device };

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.compliance.Status == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.compliance.EvaluatedAt)
            .ThenBy(x => x.device.Hostname)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => new PolicyComplianceItem(
            OpaqueId.Format("pcomp", x.compliance.Id),
            OpaqueId.Format("dev", x.device.Id),
            x.device.Hostname,
            OpaqueId.Format("pol", policy.Id),
            policy.Name,
            x.compliance.ExpectedValue,
            x.compliance.ActualValue,
            x.compliance.Status,
            x.compliance.EvidenceSource,
            x.compliance.EvaluatedAt)).ToArray();

        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);
        return Results.Ok(new PagedResponse<PolicyComplianceItem>(
            items, page, pageSize, totalItems, totalPages));
    }

    internal static IQueryable<Device> ApplyDeviceScope(
        IQueryable<Device> query,
        DevicesDbContext db,
        EffectiveAccess access)
    {
        if (access.AllResources)
            return query;

        var organizationIds = access.OrganizationIds.ToArray();
        var locationIds = access.LocationIds.ToArray();
        var groupIds = access.DeviceGroupIds.ToArray();

        return query.Where(device =>
            (device.OrganizationUnitId.HasValue
                && organizationIds.Contains(device.OrganizationUnitId.Value))
            || (device.LocationId.HasValue
                && locationIds.Contains(device.LocationId.Value))
            || db.DeviceGroupMembers.Any(member =>
                member.DeviceId == device.Id
                && groupIds.Contains(member.GroupId)));
    }

    internal static IQueryable<DeviceAlert> ApplyAlertScope(
        IQueryable<DeviceAlert> query,
        DevicesDbContext db,
        EffectiveAccess access)
    {
        if (access.AllResources)
            return query;

        var organizationIds = access.OrganizationIds.ToArray();
        var locationIds = access.LocationIds.ToArray();
        var groupIds = access.DeviceGroupIds.ToArray();

        return query.Where(alert =>
            (alert.DeviceGroupId.HasValue
                && groupIds.Contains(alert.DeviceGroupId.Value))
            || (alert.DeviceId.HasValue
                && db.Devices.Any(device =>
                    device.Id == alert.DeviceId.Value
                    && ((device.OrganizationUnitId.HasValue
                            && organizationIds.Contains(device.OrganizationUnitId.Value))
                        || (device.LocationId.HasValue
                            && locationIds.Contains(device.LocationId.Value))
                        || db.DeviceGroupMembers.Any(member =>
                            member.DeviceId == device.Id
                            && groupIds.Contains(member.GroupId))))));
    }

    internal static bool CanAccessRuleScope(
        string scopeType,
        Guid? scopeId,
        EffectiveAccess access)
    {
        if (access.AllResources)
            return true;

        return scopeType switch
        {
            "device_group" => scopeId is Guid groupId
                && access.DeviceGroupIds.Contains(groupId),
            "organization" => scopeId is Guid organizationId
                && access.OrganizationIds.Contains(organizationId),
            "location" => scopeId is Guid locationId
                && access.LocationIds.Contains(locationId),
            _ => false
        };
    }

    private static bool CanViewPolicy(
        Guid policyId,
        IReadOnlyCollection<PolicyAssignment> assignments,
        EffectiveAccess access)
    {
        var policyAssignments = assignments.Where(x => x.PolicyId == policyId).ToArray();
        if (policyAssignments.Length == 0)
            return access.AllResources;

        return access.AllResources || policyAssignments.Any(assignment =>
            assignment.ScopeType == "all_managed"
            || CanAccessRuleScope(assignment.ScopeType, assignment.ScopeId, access));
    }

    private static bool CanManagePolicy(
        IReadOnlyCollection<PolicyAssignment> assignments,
        EffectiveAccess access)
    {
        if (access.AllResources)
            return true;

        return assignments.Count > 0
            && assignments.All(assignment =>
                assignment.ScopeType != "all_managed"
                && CanAccessRuleScope(
                    assignment.ScopeType,
                    assignment.ScopeId,
                    access));
    }

    private static bool AssignmentMatches(
        PolicyAssignment assignment,
        Device device,
        IReadOnlyCollection<DeviceGroupMember> memberships)
    {
        return assignment.ScopeType switch
        {
            "all_managed" => true,
            "organization" => assignment.ScopeId is Guid orgId
                && device.OrganizationUnitId == orgId,
            "location" => assignment.ScopeId is Guid locationId
                && device.LocationId == locationId,
            "device_group" => assignment.ScopeId is Guid groupId
                && memberships.Any(x =>
                    x.GroupId == groupId && x.DeviceId == device.Id),
            _ => false
        };
    }

    private static async Task<int> CountAccessibleGroupsAsync(
        DevicesDbContext db,
        EffectiveAccess access,
        CancellationToken cancellationToken)
    {
        var query = db.DeviceGroups.AsNoTracking()
            .Where(x => x.Status == "active");
        if (access.AllResources)
            return await query.CountAsync(cancellationToken);

        var organizationIds = access.OrganizationIds.ToArray();
        var locationIds = access.LocationIds.ToArray();
        var groupIds = access.DeviceGroupIds.ToArray();

        return await query.CountAsync(group =>
            groupIds.Contains(group.Id)
            || (group.OrganizationUnitId.HasValue
                && organizationIds.Contains(group.OrganizationUnitId.Value))
            || (group.LocationId.HasValue
                && locationIds.Contains(group.LocationId.Value)),
            cancellationToken);
    }

    private static EndpointPolicySummary ToPolicySummary(
        EndpointPolicy policy,
        IReadOnlyCollection<PolicyAssignment> assignments,
        int assignedDeviceCount) =>
        new(
            OpaqueId.Format("pol", policy.Id),
            policy.Code,
            policy.Name,
            policy.PolicyType,
            policy.Description,
            policy.Status,
            assignedDeviceCount,
            assignments.Select(x => new PolicyAssignmentResponse(
                x.ScopeType,
                x.ScopeId is Guid id
                    ? ScopePublicId(x.ScopeType, id)
                    : null,
                x.ScopeLabel)).ToArray(),
            policy.UpdatedAt,
            Etag(policy.Version));

    private static EndpointPolicyDetail ToPolicyDetail(
        EndpointPolicy policy,
        IReadOnlyCollection<PolicyAssignment> assignments,
        int assignedDeviceCount)
    {
        using var document = JsonDocument.Parse(policy.ConfigurationJson);
        return new EndpointPolicyDetail(
            OpaqueId.Format("pol", policy.Id),
            policy.Code,
            policy.Name,
            policy.PolicyType,
            policy.Description,
            policy.Status,
            document.RootElement.Clone(),
            assignedDeviceCount,
            assignments.Select(x => new PolicyAssignmentResponse(
                x.ScopeType,
                x.ScopeId is Guid id
                    ? ScopePublicId(x.ScopeType, id)
                    : null,
                x.ScopeLabel)).ToArray(),
            policy.UpdatedAt,
            Etag(policy.Version));
    }

    private static string ScopePublicId(string scopeType, Guid id) =>
        scopeType switch
        {
            "device_group" => OpaqueId.Format("grp", id),
            "organization" => OpaqueId.Format("org", id),
            "location" => OpaqueId.Format("loc", id),
            _ => id.ToString()
        };

    private static IResult? ValidatePolicyConfiguration(
        string policyType,
        string configurationJson)
    {
        try
        {
            using var document = JsonDocument.Parse(configurationJson);
            var root = document.RootElement;

            if (policyType == "usb_storage")
            {
                var mode = root.TryGetProperty("mode", out var value)
                    ? value.GetString()
                    : null;
                if (mode is not ("registered_only" or "read_only" or "blocked" or "allow_all"))
                    return Validation(
                        "configuration.mode",
                        "USB mode must be registered_only, read_only, blocked or allow_all.");
            }
            else if (policyType == "agent_update")
            {
                var version = root.TryGetProperty("targetVersion", out var value)
                    ? value.GetString()
                    : null;
                if (string.IsNullOrWhiteSpace(version))
                    return Validation(
                        "configuration.targetVersion",
                        "Agent target version is required.");
            }

            return null;
        }
        catch (JsonException)
        {
            return Validation("configuration", "Configuration must be valid JSON.");
        }
    }

    private static int Percent(int value, int total) =>
        total == 0
            ? 0
            : (int)Math.Round(value * 100d / total);

    private static string OsBucket(string? operatingSystem)
    {
        if (string.IsNullOrWhiteSpace(operatingSystem))
            return "Other";
        if (operatingSystem.Contains("Windows 11", StringComparison.OrdinalIgnoreCase))
            return "Windows 11";
        if (operatingSystem.Contains("Windows 10", StringComparison.OrdinalIgnoreCase))
            return "Windows 10";
        if (operatingSystem.Contains("Server", StringComparison.OrdinalIgnoreCase))
            return "Server";
        return "Other";
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string title) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: title);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]> { [field] = [message] });

    public sealed record UpdateEndpointPolicyRequest(
        string? Status,
        Dictionary<string, JsonElement>? Configuration);

    private sealed record DeviceOverviewResponse(
        int TotalDevices,
        int OnlineDevices,
        int OfflineDevices,
        int OfflineOver24Hours,
        int ActiveAlerts,
        int CriticalAlerts,
        int DeviceGroups,
        int DeviceTypes,
        int OnlinePercent,
        IReadOnlyList<DistributionItem> OperatingSystems,
        IReadOnlyList<DistributionItem> Manufacturers,
        IReadOnlyList<OverviewDeviceItem> RecentDevices);

    private sealed record DistributionItem(
        string Label,
        int Count,
        int Percent);

    private sealed record OverviewDeviceItem(
        string Id,
        string Name,
        string Type,
        string Status,
        string? OperatingSystem,
        string? Group,
        DateTimeOffset? LastSeenAt);

    private sealed record EndpointPolicySummary(
        string Id,
        string Code,
        string Name,
        string PolicyType,
        string? Description,
        string Status,
        int AssignedDeviceCount,
        IReadOnlyList<PolicyAssignmentResponse> Assignments,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record EndpointPolicyDetail(
        string Id,
        string Code,
        string Name,
        string PolicyType,
        string? Description,
        string Status,
        JsonElement Configuration,
        int AssignedDeviceCount,
        IReadOnlyList<PolicyAssignmentResponse> Assignments,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record PolicyAssignmentResponse(
        string ScopeType,
        string? ScopeId,
        string ScopeLabel);

    private sealed record PolicyComplianceItem(
        string Id,
        string DeviceId,
        string DeviceName,
        string PolicyId,
        string PolicyName,
        string Expected,
        string Actual,
        string Status,
        string EvidenceSource,
        DateTimeOffset EvaluatedAt);
}
