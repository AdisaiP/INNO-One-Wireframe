using System.Security.Claims;
using System.Text.Json;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class DeviceAutomationNodeExecutor(
    DevicesDbContext db,
    IAccessEvaluator accessEvaluator,
    DeviceLedgerWriter ledger) : IAutomationNodeExecutor
{
    private const string AddToGroupCatalog = "devices.device.add_to_group";

    public string OwnerModule => "devices";

    public bool Supports(string catalogKey) =>
        string.Equals(catalogKey, AddToGroupCatalog, StringComparison.Ordinal);

    public AutomationNodeValidationResult Validate(
        string catalogKey,
        JsonElement configuration)
    {
        if (!Supports(catalogKey))
        {
            return AutomationNodeValidationResult.Failure(
                "DEVICES_ACTION_NOT_SUPPORTED",
                "This Devices remediation action is not supported.");
        }

        if (!TryString(configuration, "groupId", out var groupId)
            || !OpaqueId.TryParse(groupId, "grp", out _))
        {
            return AutomationNodeValidationResult.Failure(
                "DEVICES_GROUP_REQUIRED",
                "Add to Group requires a valid local static Device Group.");
        }

        return AutomationNodeValidationResult.Success();
    }

    public async Task<AutomationNodeExecutionResult> ExecuteAsync(
        AutomationNodeExecutionContext context,
        CancellationToken cancellationToken = default)
    {
        if (!Supports(context.CatalogKey))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_ACTION_NOT_SUPPORTED",
                "The requested Devices remediation action is not supported.");
        }

        if (!TryString(context.Input, "deviceId", out var devicePublicId)
            || !OpaqueId.TryParse(devicePublicId, "dev", out var deviceId))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_DEVICE_REQUIRED",
                "A managed device context is required.");
        }

        if (!TryString(context.Configuration, "groupId", out var groupPublicId)
            || !OpaqueId.TryParse(groupPublicId, "grp", out var groupId))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_GROUP_REQUIRED",
                "Add to Group requires a valid Device Group.");
        }

        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(
                [new Claim("sub", context.ActorSubject)],
                "automation-worker"));
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            "devices.manage",
            cancellationToken);
        if (!access.Allowed || access.UserId != context.ActorUserId)
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_PERMISSION_REVOKED",
                "The requesting actor no longer has Devices management permission.");
        }

        var device = await db.Devices.SingleOrDefaultAsync(
            x => x.Id == deviceId,
            cancellationToken);
        if (device is null)
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_DEVICE_NOT_FOUND",
                "The managed device no longer exists.");
        }

        var group = await db.DeviceGroups.SingleOrDefaultAsync(
            x => x.Id == groupId,
            cancellationToken);
        if (group is null)
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_GROUP_NOT_FOUND",
                "The target Device Group no longer exists.");
        }

        var currentGroups = await db.DeviceGroupMembers.AsNoTracking()
            .Where(x => x.DeviceId == device.Id)
            .Select(x => x.GroupId)
            .ToListAsync(cancellationToken);

        if (!CanAccessDevice(access, device, currentGroups)
            || !CanAccessGroup(access, group))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_OUTSIDE_ASSIGNED_SCOPE",
                "The device or target group is outside the actor's current access scope.");
        }

        if (!string.Equals(group.GroupType, "static", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(group.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_GROUP_NOT_ELIGIBLE",
                "Automation can add devices only to active static groups.");
        }

        if (!string.IsNullOrWhiteSpace(group.ExternalProvider)
            || !string.IsNullOrWhiteSpace(group.ExternalGroupId))
        {
            return AutomationNodeExecutionResult.Failure(
                "DEVICES_GROUP_PROVIDER_OWNED",
                "This group is controlled by the remote device provider. Automation will not bypass provider ownership.");
        }

        if (currentGroups.Contains(group.Id))
        {
            return AutomationNodeExecutionResult.Success(Output(
                devicePublicId,
                groupPublicId,
                true));
        }

        var now = DateTimeOffset.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.DeviceGroupMembers.Add(new DeviceGroupMember
        {
            GroupId = group.Id,
            DeviceId = device.Id,
            ResolvedAt = now
        });
        device.Version++;
        device.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            var exists = await db.DeviceGroupMembers.AsNoTracking()
                .AnyAsync(
                    x => x.GroupId == group.Id && x.DeviceId == device.Id,
                    cancellationToken);
            if (exists)
            {
                return AutomationNodeExecutionResult.Success(Output(
                    devicePublicId,
                    groupPublicId,
                    true));
            }

            return AutomationNodeExecutionResult.Failure(
                "DEVICES_GROUP_UPDATE_CONFLICT",
                "The device group membership changed concurrently.",
                retryable: true);
        }

        var actorId = OpaqueId.Format("user", context.ActorUserId);
        var runId = OpaqueId.Format("run", context.RunId);

        await ledger.AppendAuditAsync(
            "devices.automation.remediation.group_added",
            "device",
            devicePublicId,
            actorId,
            context.CorrelationId,
            context.TraceId,
            new
            {
                automationRunId = runId,
                workflowId = OpaqueId.Format("wf", context.WorkflowId),
                context.WorkflowVersion,
                context.NodeId,
                deviceId = devicePublicId,
                groupId = groupPublicId,
                group.Name
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "device.group.membership.added",
            "device",
            devicePublicId,
            new
            {
                deviceId = devicePublicId,
                groupId = groupPublicId,
                groupName = group.Name,
                automationRunId = runId,
                occurredAt = now
            },
            context.CorrelationId,
            runId,
            context.TraceId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return AutomationNodeExecutionResult.Success(Output(
            devicePublicId,
            groupPublicId,
            false));
    }

    private static JsonElement Output(
        string deviceId,
        string groupId,
        bool idempotentReplay)
    {
        using var document = JsonDocument.Parse(
            JsonSerializer.Serialize(new
            {
                deviceId,
                groupId,
                idempotentReplay
            }));
        return document.RootElement.Clone();
    }

    private static bool CanAccessDevice(
        EffectiveAccess access,
        Device device,
        IReadOnlyCollection<Guid> groupIds)
    {
        if (access.AllResources)
        {
            return true;
        }

        return (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            || (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            || groupIds.Any(access.DeviceGroupIds.Contains);
    }

    private static bool CanAccessGroup(
        EffectiveAccess access,
        DeviceGroup group)
    {
        if (access.AllResources)
        {
            return true;
        }

        return (group.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            || (group.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            || access.DeviceGroupIds.Contains(group.Id);
    }

    private static bool TryString(
        JsonElement element,
        string property,
        out string value)
    {
        value = "";
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var candidate)
            || candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = candidate.GetString()?.Trim() ?? "";
        return value.Length > 0;
    }
}
