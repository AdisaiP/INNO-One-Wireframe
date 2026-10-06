using System.Text.Json;
using System.Text.RegularExpressions;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class DeviceAlertEndpoints
{
    public static RouteGroupBuilder MapDeviceAlertEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/alerts", ListAlertsAsync)
            .WithName("devices.alerts.list");
        api.MapPost("/devices/alerts/{alertId}/acknowledge", AcknowledgeAlertAsync)
            .WithName("devices.alerts.ack");
        api.MapPost("/devices/alerts/acknowledge-all", AcknowledgeAllAsync)
            .WithName("devices.alerts.ack_all");

        api.MapGet("/devices/alert-rules", ListRulesAsync)
            .WithName("devices.alert_rules.list");
        api.MapGet("/devices/alert-rules/{ruleId}", GetRuleAsync)
            .WithName("devices.alert_rules.get");
        api.MapPost("/devices/alert-rules", CreateRuleAsync)
            .WithName("devices.alert_rules.create");
        api.MapPut("/devices/alert-rules/{ruleId}", UpdateRuleAsync)
            .WithName("devices.alert_rules.update");

        api.MapGet("/devices/alert-channels", GetChannelsAsync)
            .WithName("devices.alert_channels.get");
        api.MapPut("/devices/alert-channels", UpdateChannelsAsync)
            .WithName("devices.alert_channels.update");
        api.MapPost("/devices/alert-channels/tests", TestChannelsAsync)
            .WithName("devices.alert_channels.test");

        api.MapGet("/devices/alert-history", ListHistoryAsync)
            .WithName("devices.alert_history.list");
        return api;
    }

    private static async Task<IResult> ListAlertsAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? severity = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = DeviceGovernanceEndpoints.ApplyAlertScope(
            db.DeviceAlerts.AsNoTracking().Where(x => x.Status != "resolved"),
            db,
            access);

        if (!string.IsNullOrWhiteSpace(severity)
            && !string.Equals(severity, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = severity.Trim().ToLowerInvariant();
            query = query.Where(x => x.Severity == normalized);
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Title.ToLower().Contains(term)
                || x.Detail.ToLower().Contains(term));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(x => x.Severity == "critical"
                ? 0
                : x.Severity == "warning"
                    ? 1
                    : x.Severity == "information"
                        ? 2
                        : 3)
            .ThenByDescending(x => x.DetectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = await BuildAlertResponsesAsync(db, rows, cancellationToken);
        return Paged(items, page, pageSize, totalItems);
    }

    private static async Task<IResult> AcknowledgeAlertAsync(
        string alertId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(alertId, "alert", out var id))
            return NotFound("Device alert not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var allowed = await DeviceGovernanceEndpoints.ApplyAlertScope(
                db.DeviceAlerts.AsNoTracking().Where(x => x.Id == id),
                db,
                access)
            .AnyAsync(cancellationToken);
        if (!allowed)
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var alert = await db.DeviceAlerts
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (alert is null)
            return NotFound("Device alert not found.");
        if (alert.Status == "resolved")
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Alert is already resolved");

        if (alert.Status != "acknowledged")
        {
            alert.Status = "acknowledged";
            alert.AcknowledgedAt = DateTimeOffset.UtcNow;
            alert.AcknowledgedByUserId = access.UserId;
            await db.SaveChangesAsync(cancellationToken);
            await WriteAcknowledgementAsync(
                alert, access.UserId, httpContext, ledger, cancellationToken);
        }

        return Results.Ok(new
        {
            alertId,
            status = alert.Status,
            acknowledgedAt = alert.AcknowledgedAt
        });
    }

    private static async Task<IResult> AcknowledgeAllAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var ids = await DeviceGovernanceEndpoints.ApplyAlertScope(
                db.DeviceAlerts.AsNoTracking()
                    .Where(x => x.Status == "open"),
                db,
                access)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (ids.Count == 0)
            return Results.Ok(new { acknowledged = 0 });

        var alerts = await db.DeviceAlerts
            .Where(x => ids.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        foreach (var alert in alerts)
        {
            alert.Status = "acknowledged";
            alert.AcknowledgedAt = now;
            alert.AcknowledgedByUserId = access.UserId;
        }
        await db.SaveChangesAsync(cancellationToken);

        foreach (var alert in alerts)
        {
            await WriteAcknowledgementAsync(
                alert, access.UserId, httpContext, ledger, cancellationToken);
        }

        return Results.Ok(new { acknowledged = alerts.Count });
    }

    private static async Task<IResult> ListRulesAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? search = null,
        string? severity = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.DeviceAlertRules.AsNoTracking();
        if (!access.AllResources)
        {
            var groupIds = access.DeviceGroupIds.ToArray();
            var orgIds = access.OrganizationIds.ToArray();
            var locationIds = access.LocationIds.ToArray();
            query = query.Where(x =>
                x.ScopeType == "all_groups"
                || x.ScopeType == "all_devices"
                || (x.ScopeType == "device_group"
                    && x.ScopeId.HasValue
                    && groupIds.Contains(x.ScopeId.Value))
                || (x.ScopeType == "organization"
                    && x.ScopeId.HasValue
                    && orgIds.Contains(x.ScopeId.Value))
                || (x.ScopeType == "location"
                    && x.ScopeId.HasValue
                    && locationIds.Contains(x.ScopeId.Value)));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Name.ToLower().Contains(term)
                || x.Code.ToLower().Contains(term)
                || x.RuleType.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(severity)
            && !string.Equals(severity, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = severity.Trim().ToLowerInvariant();
            query = query.Where(x => x.Severity == normalized);
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var items = rows.Select(ToRuleResponse).ToArray();
        return Paged(items, page, pageSize, totalItems);
    }

    private static async Task<IResult> GetRuleAsync(
        string ruleId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ruleId, "arule", out var id))
            return NotFound("Alert rule not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var rule = await db.DeviceAlertRules.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (rule is null)
            return NotFound("Alert rule not found.");
        if (!CanViewRule(rule, access))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Ok(new ResourceResponse<AlertRuleResponse>(
            ToRuleResponse(rule)));
    }

    private static async Task<IResult> CreateRuleAsync(
        AlertRuleMutationRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var validation = ValidateRuleRequest(request, access);
        if (validation.Result is not null)
            return validation.Result;

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();
        var rule = new DeviceAlertRule
        {
            Id = id,
            Code = RuleCode(request.Name!, id),
            Name = request.Name!.Trim(),
            Description = TrimToNull(request.Description),
            RuleType = validation.RuleType!,
            Severity = validation.Severity!,
            ScopeType = validation.ScopeType!,
            ScopeId = validation.ScopeId,
            ConfigurationJson = JsonSerializer.Serialize(
                request.Configuration ?? new Dictionary<string, JsonElement>()),
            ChannelsJson = JsonSerializer.Serialize(
                NormalizeChannels(request.Channels)),
            Status = validation.Status!,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.DeviceAlertRules.Add(rule);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("arule", id);
        await ledger.AppendAuditAsync(
            "devices.alert_rule.created",
            "device_alert_rule",
            publicId,
            OpaqueId.Format("user", access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                rule.Code,
                rule.Name,
                rule.RuleType,
                rule.Severity,
                rule.ScopeType,
                rule.Status
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "device.alert.rule.updated",
            "device_alert_rule",
            publicId,
            new { ruleId = publicId, changeType = "created" },
            httpContext.TraceIdentifier,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Created(
            $"/api/v1/devices/alert-rules/{publicId}",
            new ResourceResponse<AlertRuleResponse>(ToRuleResponse(rule)));
    }

    private static async Task<IResult> UpdateRuleAsync(
        string ruleId,
        AlertRuleMutationRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(ruleId, "arule", out var id))
            return NotFound("Alert rule not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var rule = await db.DeviceAlertRules
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (rule is null)
            return NotFound("Alert rule not found.");
        if (!CanManageRule(rule, access))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var validation = ValidateRuleRequest(request, access);
        if (validation.Result is not null)
            return validation.Result;

        rule.Name = request.Name!.Trim();
        rule.Description = TrimToNull(request.Description);
        rule.RuleType = validation.RuleType!;
        rule.Severity = validation.Severity!;
        rule.ScopeType = validation.ScopeType!;
        rule.ScopeId = validation.ScopeId;
        rule.ConfigurationJson = JsonSerializer.Serialize(
            request.Configuration ?? new Dictionary<string, JsonElement>());
        rule.ChannelsJson = JsonSerializer.Serialize(
            NormalizeChannels(request.Channels));
        rule.Status = validation.Status!;
        rule.Version++;
        rule.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("arule", id);
        await ledger.AppendAuditAsync(
            "devices.alert_rule.updated",
            "device_alert_rule",
            publicId,
            OpaqueId.Format("user", access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                rule.Name,
                rule.RuleType,
                rule.Severity,
                rule.ScopeType,
                rule.Status,
                rule.Version
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "device.alert.rule.updated",
            "device_alert_rule",
            publicId,
            new { ruleId = publicId, changeType = "updated" },
            httpContext.TraceIdentifier,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(rule.Version);
        return Results.Ok(new ResourceResponse<AlertRuleResponse>(
            ToRuleResponse(rule)));
    }

    private static async Task<IResult> GetChannelsAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var channels = await db.AlertChannels.AsNoTracking()
            .OrderBy(x => x.ChannelType)
            .ToListAsync(cancellationToken);
        return Results.Ok(new ResourceResponse<AlertChannelsResponse>(
            ToChannelsResponse(channels)));
    }

    private static async Task<IResult> UpdateChannelsAsync(
        UpdateAlertChannelsRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var channels = await db.AlertChannels.ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        ApplyChannel(channels, "console", request.Console, now);
        ApplyChannel(channels, "sound", request.Sound, now);
        ApplyChannel(channels, "email", request.Email, now);
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "devices.alert_channels.updated",
            "alert_channels",
            "alert-channels",
            OpaqueId.Format("user", access.UserId),
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                consoleEnabled = channels.SingleOrDefault(x => x.ChannelType == "console")?.Enabled,
                soundEnabled = channels.SingleOrDefault(x => x.ChannelType == "sound")?.Enabled,
                emailEnabled = channels.SingleOrDefault(x => x.ChannelType == "email")?.Enabled
            },
            cancellationToken);

        return Results.Ok(new ResourceResponse<AlertChannelsResponse>(
            ToChannelsResponse(channels)));
    }

    private static async Task<IResult> TestChannelsAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var channels = await db.AlertChannels.AsNoTracking()
            .Where(x => x.Enabled)
            .ToListAsync(cancellationToken);
        var unavailable = channels
            .Where(x => x.Status != "healthy")
            .Select(x => x.ChannelType)
            .ToArray();

        var operationId = Guid.NewGuid();
        await ledger.CreateOperationAsync(
            operationId,
            "devices.alert_channels.test",
            "alert_channels",
            null,
            OpaqueId.Format("user", access.UserId),
            "devices.alert.manage",
            cancellationToken);

        var status = unavailable.Length == 0 ? "succeeded" : "partial";
        var errorCode = unavailable.Length == 0
            ? null
            : "ALERT_CHANNEL_NOT_CONFIGURED";
        await ledger.UpdateOperationAsync(
            operationId,
            status,
            100,
            "/api/v1/devices/alert-channels",
            errorCode,
            cancellationToken);

        return Results.Accepted(
            $"/api/v1/operations/{OpaqueId.Format("op", operationId)}",
            new
            {
                operationId = OpaqueId.Format("op", operationId),
                status,
                statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}",
                progress = 100,
                resultUrl = "/api/v1/devices/alert-channels",
                unavailableChannels = unavailable
            });
    }

    private static async Task<IResult> ListHistoryAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.alert.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var alerts = await DeviceGovernanceEndpoints.ApplyAlertScope(
                db.DeviceAlerts.AsNoTracking(),
                db,
                access)
            .OrderByDescending(x => x.DetectedAt)
            .Take(1000)
            .ToListAsync(cancellationToken);
        var alertIds = alerts.Select(x => x.Id).ToArray();
        var deliveries = await db.AlertDeliveryHistory.AsNoTracking()
            .Where(x => alertIds.Contains(x.AlertId))
            .OrderByDescending(x => x.AttemptedAt)
            .ToListAsync(cancellationToken);

        var deviceIds = alerts.Where(x => x.DeviceId.HasValue)
            .Select(x => x.DeviceId!.Value).Distinct().ToArray();
        var groupIds = alerts.Where(x => x.DeviceGroupId.HasValue)
            .Select(x => x.DeviceGroupId!.Value).Distinct().ToArray();
        var userIds = alerts.Where(x => x.AcknowledgedByUserId.HasValue)
            .Select(x => x.AcknowledgedByUserId!.Value).Distinct().ToArray();

        var devices = await db.Devices.AsNoTracking()
            .Where(x => deviceIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Hostname, cancellationToken);
        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => groupIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var directory = await directoryReader.ReadAsync(
            userIds,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);

        var history = new List<AlertHistoryItem>();
        foreach (var alert in alerts)
        {
            var publicAlertId = OpaqueId.Format("alert", alert.Id);
            var scopeLabel = ScopeLabel(alert, devices, groups);

            if (alert.AcknowledgedAt is DateTimeOffset acknowledgedAt)
            {
                history.Add(new AlertHistoryItem(
                    $"ack:{publicAlertId}:{acknowledgedAt.UtcTicks}",
                    publicAlertId,
                    "acknowledged",
                    alert.Title,
                    alert.Severity,
                    scopeLabel,
                    acknowledgedAt,
                    Array.Empty<string>(),
                    alert.AcknowledgedByUserId is Guid userId
                        ? directory.Users.GetValueOrDefault(userId)
                        : null,
                    "Acknowledged"));
            }

            if (alert.ResolvedAt is DateTimeOffset resolvedAt)
            {
                history.Add(new AlertHistoryItem(
                    $"resolved:{publicAlertId}:{resolvedAt.UtcTicks}",
                    publicAlertId,
                    "resolved",
                    alert.Title,
                    alert.Severity,
                    scopeLabel,
                    resolvedAt,
                    Array.Empty<string>(),
                    null,
                    "Resolved"));
            }
        }

        foreach (var delivery in deliveries)
        {
            var alert = alerts.First(x => x.Id == delivery.AlertId);
            history.Add(new AlertHistoryItem(
                OpaqueId.Format("adel", delivery.Id),
                OpaqueId.Format("alert", alert.Id),
                "notified",
                alert.Title,
                alert.Severity,
                ScopeLabel(alert, devices, groups),
                delivery.AttemptedAt,
                new[] { delivery.ChannelType },
                null,
                delivery.DeliveryStatus));
        }

        var ordered = history
            .OrderByDescending(x => x.OccurredAt)
            .ToList();
        var totalItems = ordered.Count;
        var items = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArray();
        return Paged(items, page, pageSize, totalItems);
    }

    private static async Task WriteAcknowledgementAsync(
        DeviceAlert alert,
        Guid userId,
        HttpContext httpContext,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var publicId = OpaqueId.Format("alert", alert.Id);
        var userPublicId = OpaqueId.Format("user", userId);
        await ledger.AppendAuditAsync(
            "devices.alert.acknowledged",
            "device_alert",
            publicId,
            userPublicId,
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                alertId = publicId,
                alert.Severity,
                alert.Title,
                acknowledgedAt = alert.AcknowledgedAt
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "device.alert.acknowledged",
            "device_alert",
            publicId,
            new
            {
                alertId = publicId,
                acknowledgedByUserId = userPublicId,
                acknowledgedAt = alert.AcknowledgedAt
            },
            httpContext.TraceIdentifier,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);
    }

    private static async Task<IReadOnlyList<DeviceAlertResponse>> BuildAlertResponsesAsync(
        DevicesDbContext db,
        IReadOnlyCollection<DeviceAlert> alerts,
        CancellationToken cancellationToken)
    {
        var deviceIds = alerts.Where(x => x.DeviceId.HasValue)
            .Select(x => x.DeviceId!.Value).Distinct().ToArray();
        var groupIds = alerts.Where(x => x.DeviceGroupId.HasValue)
            .Select(x => x.DeviceGroupId!.Value).Distinct().ToArray();
        var devices = await db.Devices.AsNoTracking()
            .Where(x => deviceIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Hostname, cancellationToken);
        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => groupIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return alerts.Select(alert => new DeviceAlertResponse(
            OpaqueId.Format("alert", alert.Id),
            OpaqueId.Format("arule", alert.RuleId),
            alert.Severity,
            alert.Title,
            alert.Detail,
            alert.DeviceId is Guid deviceId
                ? OpaqueId.Format("dev", deviceId)
                : null,
            alert.DeviceId is Guid deviceNameId
                ? devices.GetValueOrDefault(deviceNameId)
                : null,
            alert.DeviceGroupId is Guid groupId
                ? OpaqueId.Format("grp", groupId)
                : null,
            alert.DeviceGroupId is Guid groupNameId
                ? groups.GetValueOrDefault(groupNameId)
                : null,
            ScopeLabel(alert, devices, groups),
            alert.Status,
            alert.DetectedAt,
            alert.LastObservedAt,
            alert.AcknowledgedAt)).ToArray();
    }

    private static string ScopeLabel(
        DeviceAlert alert,
        IReadOnlyDictionary<Guid, string> devices,
        IReadOnlyDictionary<Guid, string> groups)
    {
        if (alert.DeviceId is Guid deviceId)
            return devices.GetValueOrDefault(deviceId) ?? "Managed device";
        if (alert.DeviceGroupId is Guid groupId)
            return groups.GetValueOrDefault(groupId) ?? "Device Group";
        return "Managed fleet";
    }

    private static AlertRuleResponse ToRuleResponse(DeviceAlertRule rule)
    {
        using var configuration = JsonDocument.Parse(rule.ConfigurationJson);
        string[] channels;
        try
        {
            channels = JsonSerializer.Deserialize<string[]>(rule.ChannelsJson)
                ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            channels = Array.Empty<string>();
        }

        return new AlertRuleResponse(
            OpaqueId.Format("arule", rule.Id),
            rule.Code,
            rule.Name,
            rule.Description,
            rule.RuleType,
            rule.Severity,
            rule.ScopeType,
            rule.ScopeId is Guid scopeId
                ? ScopePublicId(rule.ScopeType, scopeId)
                : null,
            configuration.RootElement.Clone(),
            channels,
            rule.Status,
            rule.UpdatedAt,
            Etag(rule.Version));
    }

    private static (
        string? RuleType,
        string? Severity,
        string? ScopeType,
        Guid? ScopeId,
        string? Status,
        IResult? Result) ValidateRuleRequest(
        AlertRuleMutationRequest request,
        EffectiveAccess access)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return (null, null, null, null, null,
                Validation("name", "Rule name is required."));

        var ruleType = request.RuleType?.Trim().ToLowerInvariant();
        if (ruleType is not ("offline_anomaly" or "hardware_change" or "software_change" or "baseline_drift"))
            return (null, null, null, null, null,
                Validation(
                    "ruleType",
                    "Rule type must be offline_anomaly, hardware_change, software_change or baseline_drift."));

        var severity = request.Severity?.Trim().ToLowerInvariant();
        if (severity is not ("critical" or "warning" or "information"))
            return (null, null, null, null, null,
                Validation(
                    "severity",
                    "Severity must be critical, warning or information."));

        var scopeType = request.ScopeType?.Trim().ToLowerInvariant();
        if (scopeType is not ("all_groups" or "all_devices" or "device_group" or "organization" or "location"))
            return (null, null, null, null, null,
                Validation(
                    "scopeType",
                    "Invalid alert-rule scope."));

        Guid? scopeId = null;
        if (scopeType is "device_group" or "organization" or "location")
        {
            var prefix = scopeType switch
            {
                "device_group" => "grp",
                "organization" => "org",
                _ => "loc"
            };
            if (string.IsNullOrWhiteSpace(request.ScopeId)
                || !OpaqueId.TryParse(request.ScopeId, prefix, out var parsed))
                return (null, null, null, null, null,
                    Validation("scopeId", "A valid scoped resource ID is required."));
            scopeId = parsed;
        }

        if ((scopeType is "all_groups" or "all_devices") && !access.AllResources)
            return (null, null, null, null, null,
                Forbidden("OUTSIDE_ASSIGNED_SCOPE"));
        if (scopeId is Guid scoped
            && !DeviceGovernanceEndpoints.CanAccessRuleScope(scopeType, scoped, access))
            return (null, null, null, null, null,
                Forbidden("OUTSIDE_ASSIGNED_SCOPE"));

        var status = string.IsNullOrWhiteSpace(request.Status)
            ? "enabled"
            : request.Status.Trim().ToLowerInvariant();
        if (status is not ("enabled" or "disabled"))
            return (null, null, null, null, null,
                Validation("status", "Status must be enabled or disabled."));

        if (ruleType == "offline_anomaly")
        {
            var configuration = request.Configuration
                ?? new Dictionary<string, JsonElement>();
            if (configuration.TryGetValue(
                    "offlineThresholdPercent", out var threshold)
                && threshold.ValueKind == JsonValueKind.Number
                && (threshold.GetInt32() < 1 || threshold.GetInt32() > 100))
            {
                return (null, null, null, null, null,
                    Validation(
                        "configuration.offlineThresholdPercent",
                        "Offline threshold must be between 1 and 100."));
            }
        }

        return (ruleType, severity, scopeType, scopeId, status, null);
    }

    private static bool CanViewRule(DeviceAlertRule rule, EffectiveAccess access) =>
        access.AllResources
        || rule.ScopeType is "all_groups" or "all_devices"
        || DeviceGovernanceEndpoints.CanAccessRuleScope(
            rule.ScopeType, rule.ScopeId, access);

    private static bool CanManageRule(DeviceAlertRule rule, EffectiveAccess access) =>
        access.AllResources
        || (rule.ScopeType is not ("all_groups" or "all_devices")
            && DeviceGovernanceEndpoints.CanAccessRuleScope(
                rule.ScopeType, rule.ScopeId, access));

    private static string[] NormalizeChannels(IReadOnlyCollection<string>? channels)
    {
        var allowed = new HashSet<string>(
            new[] { "console", "sound", "email" },
            StringComparer.OrdinalIgnoreCase);
        return (channels ?? Array.Empty<string>())
            .Select(x => x.Trim().ToLowerInvariant())
            .Where(allowed.Contains)
            .Distinct()
            .ToArray();
    }

    private static AlertChannelsResponse ToChannelsResponse(
        IReadOnlyCollection<AlertChannel> channels) =>
        new(
            ToChannel(channels.SingleOrDefault(x => x.ChannelType == "console"), "console"),
            ToChannel(channels.SingleOrDefault(x => x.ChannelType == "sound"), "sound"),
            ToChannel(channels.SingleOrDefault(x => x.ChannelType == "email"), "email"));

    private static AlertChannelResponse ToChannel(
        AlertChannel? channel,
        string channelType)
    {
        if (channel is null)
            return new AlertChannelResponse(
                channelType,
                false,
                "not_configured",
                JsonDocument.Parse("{}").RootElement.Clone(),
                Etag(0));

        using var configuration = JsonDocument.Parse(channel.ConfigurationJson);
        return new AlertChannelResponse(
            channel.ChannelType,
            channel.Enabled,
            channel.Status,
            configuration.RootElement.Clone(),
            Etag(channel.Version));
    }

    private static void ApplyChannel(
        List<AlertChannel> channels,
        string channelType,
        AlertChannelInput? input,
        DateTimeOffset now)
    {
        if (input is null)
            return;

        var channel = channels.SingleOrDefault(x => x.ChannelType == channelType);
        if (channel is null)
        {
            channel = new AlertChannel
            {
                Id = Guid.NewGuid(),
                ChannelType = channelType,
                ConfigurationJson = "{}",
                Status = "healthy",
                UpdatedAt = now
            };
            channels.Add(channel);
        }

        channel.Enabled = input.Enabled;
        channel.ConfigurationJson = JsonSerializer.Serialize(
            input.Configuration ?? new Dictionary<string, JsonElement>());
        channel.Status = channelType == "email"
            && input.Enabled
            && !HasEmailRecipients(input.Configuration)
                ? "not_configured"
                : "healthy";
        channel.Version++;
        channel.UpdatedAt = now;

        static bool HasEmailRecipients(
            Dictionary<string, JsonElement>? configuration)
        {
            if (configuration is null
                || !configuration.TryGetValue("recipients", out var recipients)
                || recipients.ValueKind != JsonValueKind.Array)
                return false;
            return recipients.GetArrayLength() > 0;
        }
    }

    private static string RuleCode(string name, Guid id)
    {
        var slug = Regex.Replace(
                name.Trim().ToLowerInvariant(),
                "[^a-z0-9]+",
                "-")
            .Trim('-');
        if (slug.Length > 48)
            slug = slug[..48].Trim('-');
        if (slug.Length == 0)
            slug = "rule";
        return $"{slug}-{id.ToString("N")[..6]}";
    }

    private static string ScopePublicId(string scopeType, Guid id) =>
        scopeType switch
        {
            "device_group" => OpaqueId.Format("grp", id),
            "organization" => OpaqueId.Format("org", id),
            "location" => OpaqueId.Format("loc", id),
            _ => id.ToString()
        };

    private static string Etag(long version) => $"W/\"{version}\"";

    private static int SeverityRank(string severity) =>
        severity switch
        {
            "critical" => 0,
            "warning" => 1,
            "information" => 2,
            _ => 3
        };

    private static IResult Paged<T>(
        IReadOnlyList<T> items,
        int page,
        int pageSize,
        int totalItems) =>
        Results.Ok(new PagedResponse<T>(
            items,
            page,
            pageSize,
            totalItems,
            totalItems == 0
                ? 0
                : (int)Math.Ceiling(totalItems / (double)pageSize)));

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

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public sealed record AlertRuleMutationRequest(
        string? Name,
        string? Description,
        string? RuleType,
        string? Severity,
        string? ScopeType,
        string? ScopeId,
        Dictionary<string, JsonElement>? Configuration,
        IReadOnlyCollection<string>? Channels,
        string? Status);

    public sealed record AlertChannelInput(
        bool Enabled,
        Dictionary<string, JsonElement>? Configuration);

    public sealed record UpdateAlertChannelsRequest(
        AlertChannelInput? Console,
        AlertChannelInput? Sound,
        AlertChannelInput? Email);

    private sealed record DeviceAlertResponse(
        string Id,
        string RuleId,
        string Severity,
        string Title,
        string Detail,
        string? DeviceId,
        string? DeviceName,
        string? GroupId,
        string? GroupName,
        string ScopeLabel,
        string Status,
        DateTimeOffset DetectedAt,
        DateTimeOffset LastObservedAt,
        DateTimeOffset? AcknowledgedAt);

    private sealed record AlertRuleResponse(
        string Id,
        string Code,
        string Name,
        string? Description,
        string RuleType,
        string Severity,
        string ScopeType,
        string? ScopeId,
        JsonElement Configuration,
        IReadOnlyList<string> Channels,
        string Status,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record AlertChannelResponse(
        string ChannelType,
        bool Enabled,
        string Status,
        JsonElement Configuration,
        string ETag);

    private sealed record AlertChannelsResponse(
        AlertChannelResponse Console,
        AlertChannelResponse Sound,
        AlertChannelResponse Email);

    private sealed record AlertHistoryItem(
        string Id,
        string AlertId,
        string EventType,
        string Title,
        string Severity,
        string ScopeLabel,
        DateTimeOffset OccurredAt,
        IReadOnlyList<string> Channels,
        string? OperatorName,
        string Result);
}
