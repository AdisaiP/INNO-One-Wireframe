using System.Text.Json;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace INNO.One.Modules.Devices.Infrastructure;

public sealed class DeviceGovernanceWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<DeviceGovernanceWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
                var ledger = scope.ServiceProvider.GetRequiredService<DeviceLedgerWriter>();

                await EnsureDefaultsAsync(db, stoppingToken);
                await EvaluatePoliciesAsync(db, stoppingToken);
                await EvaluateAlertsAsync(db, ledger, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Device governance evaluation failed.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private static async Task EnsureDefaultsAsync(
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        if (!await db.EndpointPolicies.AnyAsync(cancellationToken))
        {
            var usbId = Guid.Parse("84000000-0000-0000-0000-000000000001");
            var consentId = Guid.Parse("84000000-0000-0000-0000-000000000002");
            var captureId = Guid.Parse("84000000-0000-0000-0000-000000000003");
            var agentUpdateId = Guid.Parse("84000000-0000-0000-0000-000000000004");

            db.EndpointPolicies.AddRange(
                new EndpointPolicy
                {
                    Id = usbId,
                    Code = "usb-storage-control",
                    Name = "USB Storage Control",
                    PolicyType = "usb_storage",
                    Description = "Control removable-storage behavior for managed endpoints.",
                    Status = "enabled",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        mode = "registered_only",
                        exceptions = Array.Empty<object>()
                    }),
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new EndpointPolicy
                {
                    Id = consentId,
                    Code = "remote-consent",
                    Name = "Remote Consent",
                    PolicyType = "remote_consent",
                    Description = "Require endpoint user consent before remote access starts.",
                    Status = "enabled",
                    ConfigurationJson = JsonSerializer.Serialize(new { mode = "always_prompt" }),
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new EndpointPolicy
                {
                    Id = captureId,
                    Code = "screen-capture",
                    Name = "Screen Capture",
                    PolicyType = "screen_capture",
                    Description = "Control managed-endpoint screen capture behavior.",
                    Status = "draft",
                    ConfigurationJson = JsonSerializer.Serialize(new { mode = "blocked" }),
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new EndpointPolicy
                {
                    Id = agentUpdateId,
                    Code = "agent-update",
                    Name = "Agent Update",
                    PolicyType = "agent_update",
                    Description = "Track the expected INNO.One Endpoint Agent release.",
                    Status = "enabled",
                    ConfigurationJson = JsonSerializer.Serialize(new { targetVersion = "1.8.4" }),
                    CreatedAt = now,
                    UpdatedAt = now
                });

            db.PolicyAssignments.AddRange(
                AllManagedAssignment("84100000-0000-0000-0000-000000000001", usbId, now),
                AllManagedAssignment("84100000-0000-0000-0000-000000000002", consentId, now),
                AllManagedAssignment("84100000-0000-0000-0000-000000000003", agentUpdateId, now));

            await db.SaveChangesAsync(cancellationToken);
        }

        if (!await db.DeviceAlertRules.AnyAsync(cancellationToken))
        {
            db.DeviceAlertRules.AddRange(
                new DeviceAlertRule
                {
                    Id = Guid.Parse("85000000-0000-0000-0000-000000000001"),
                    Code = "offline-anomaly-by-group",
                    Name = "Offline anomaly by group",
                    Description = "Detect Device Groups with an abnormal percentage of offline endpoints.",
                    RuleType = "offline_anomaly",
                    Severity = "critical",
                    ScopeType = "all_groups",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        evaluationWindowMinutes = 10,
                        baseline = "current_scope",
                        offlineThresholdPercent = 30,
                        minimumAffectedDevices = 1
                    }),
                    ChannelsJson = JsonSerializer.Serialize(new[] { "console", "sound" }),
                    Status = "enabled",
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new DeviceAlertRule
                {
                    Id = Guid.Parse("85000000-0000-0000-0000-000000000002"),
                    Code = "hardware-change-detected",
                    Name = "Hardware change detected",
                    Description = "Detect memory, disk, BIOS or network-adapter changes when comparison evidence exists.",
                    RuleType = "hardware_change",
                    Severity = "warning",
                    ScopeType = "all_devices",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        detect = new[] { "added", "removed", "version_changed" }
                    }),
                    ChannelsJson = JsonSerializer.Serialize(new[] { "console" }),
                    Status = "enabled",
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new DeviceAlertRule
                {
                    Id = Guid.Parse("85000000-0000-0000-0000-000000000003"),
                    Code = "software-inventory-changed",
                    Name = "Software inventory changed",
                    Description = "Detect install, removal or version changes when two complete observations are available.",
                    RuleType = "software_change",
                    Severity = "warning",
                    ScopeType = "all_devices",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        detect = new[] { "added", "removed", "version_changed" },
                        ignoreApprovedDeployments = true
                    }),
                    ChannelsJson = JsonSerializer.Serialize(new[] { "console" }),
                    Status = "enabled",
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new DeviceAlertRule
                {
                    Id = Guid.Parse("85000000-0000-0000-0000-000000000004"),
                    Code = "asset-baseline-drift",
                    Name = "Asset baseline drift",
                    Description = "Reserved for evidence-backed Assets baseline drift projection.",
                    RuleType = "baseline_drift",
                    Severity = "information",
                    ScopeType = "all_devices",
                    ConfigurationJson = JsonSerializer.Serialize(new { evidenceRequired = true }),
                    ChannelsJson = JsonSerializer.Serialize(new[] { "console" }),
                    Status = "enabled",
                    CreatedAt = now,
                    UpdatedAt = now
                });

            await db.SaveChangesAsync(cancellationToken);
        }

        if (!await db.AlertChannels.AnyAsync(cancellationToken))
        {
            db.AlertChannels.AddRange(
                new AlertChannel
                {
                    Id = Guid.Parse("86000000-0000-0000-0000-000000000001"),
                    ChannelType = "console",
                    Enabled = true,
                    Status = "healthy",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        showSymbol = true,
                        showToast = true,
                        alertCenter = true
                    }),
                    UpdatedAt = now
                },
                new AlertChannel
                {
                    Id = Guid.Parse("86000000-0000-0000-0000-000000000002"),
                    ChannelType = "sound",
                    Enabled = true,
                    Status = "healthy",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        minimumSeverity = "warning",
                        criticalSound = "Critical Pulse",
                        warningSound = "System Alert"
                    }),
                    UpdatedAt = now
                },
                new AlertChannel
                {
                    Id = Guid.Parse("86000000-0000-0000-0000-000000000003"),
                    ChannelType = "email",
                    Enabled = false,
                    Status = "not_configured",
                    ConfigurationJson = JsonSerializer.Serialize(new
                    {
                        recipients = Array.Empty<string>(),
                        delivery = "immediate",
                        minimumSeverity = "warning"
                    }),
                    UpdatedAt = now
                });

            await db.SaveChangesAsync(cancellationToken);
        }

        static PolicyAssignment AllManagedAssignment(string id, Guid policyId, DateTimeOffset createdAt) =>
            new()
            {
                Id = Guid.Parse(id),
                PolicyId = policyId,
                ScopeType = "all_managed",
                ScopeLabel = "All managed devices",
                CreatedAt = createdAt
            };
    }

    private static async Task EvaluatePoliciesAsync(
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        var policies = await db.EndpointPolicies.AsNoTracking().ToListAsync(cancellationToken);
        var assignments = await db.PolicyAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var devices = await db.Devices.AsNoTracking().ToListAsync(cancellationToken);
        var groupMemberships = await db.DeviceGroupMembers.AsNoTracking().ToListAsync(cancellationToken);
        var existing = await db.PolicyCompliance.ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var activeKeys = new HashSet<(Guid PolicyId, Guid DeviceId)>();

        foreach (var policy in policies.Where(x => x.Status != "disabled"))
        {
            var policyAssignments = assignments.Where(x => x.PolicyId == policy.Id).ToArray();
            if (policyAssignments.Length == 0)
                continue;

            foreach (var device in devices.Where(device =>
                policyAssignments.Any(assignment => AssignmentMatches(
                    assignment, device, groupMemberships))))
            {
                activeKeys.Add((policy.Id, device.Id));
                var evaluation = EvaluatePolicy(policy, device);
                var row = existing.SingleOrDefault(x =>
                    x.PolicyId == policy.Id && x.DeviceId == device.Id);

                if (row is null)
                {
                    db.PolicyCompliance.Add(new PolicyCompliance
                    {
                        Id = Guid.NewGuid(),
                        PolicyId = policy.Id,
                        DeviceId = device.Id,
                        ExpectedValue = evaluation.Expected,
                        ActualValue = evaluation.Actual,
                        Status = evaluation.Status,
                        EvidenceSource = evaluation.Source,
                        EvaluatedAt = now
                    });
                }
                else
                {
                    row.ExpectedValue = evaluation.Expected;
                    row.ActualValue = evaluation.Actual;
                    row.Status = evaluation.Status;
                    row.EvidenceSource = evaluation.Source;
                    row.EvaluatedAt = now;
                }
            }
        }

        var stale = existing.Where(x => !activeKeys.Contains((x.PolicyId, x.DeviceId))).ToArray();
        if (stale.Length > 0)
            db.PolicyCompliance.RemoveRange(stale);

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);
    }

    private static (string Expected, string Actual, string Status, string Source) EvaluatePolicy(
        EndpointPolicy policy,
        Device device)
    {
        using var configuration = JsonDocument.Parse(policy.ConfigurationJson);
        var root = configuration.RootElement;

        if (policy.PolicyType == "agent_update")
        {
            var expected = root.TryGetProperty("targetVersion", out var target)
                ? target.GetString() ?? "Not configured"
                : "Not configured";
            var actual = string.IsNullOrWhiteSpace(device.AgentVersion)
                ? "Not reported"
                : device.AgentVersion;

            if (actual == "Not reported")
                return (expected, actual, "pending", "device.agent_version");

            return (
                expected,
                actual,
                string.Equals(expected, actual, StringComparison.OrdinalIgnoreCase)
                    ? "compliant"
                    : "non_compliant",
                "device.agent_version");
        }

        if (policy.PolicyType == "remote_consent")
        {
            var expected = root.TryGetProperty("mode", out var mode)
                ? mode.GetString() ?? "always_prompt"
                : "always_prompt";
            return (
                expected,
                "Consent lifecycle enforced by INNO.One; per-device policy evidence is not reported",
                "pending",
                "product_control_plane");
        }

        var configured = root.TryGetProperty("mode", out var configuredMode)
            ? configuredMode.GetString() ?? "Configured"
            : "Configured";

        return (
            configured,
            "Not reported by Endpoint Agent",
            "pending",
            "endpoint_evidence_missing");
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
                && memberships.Any(x => x.GroupId == groupId && x.DeviceId == device.Id),
            _ => false
        };
    }

    private static async Task EvaluateAlertsAsync(
        DevicesDbContext db,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var rules = await db.DeviceAlertRules
            .Where(x => x.Status == "enabled" && x.RuleType == "offline_anomaly")
            .ToListAsync(cancellationToken);

        if (rules.Count == 0)
            return;

        var groups = await db.DeviceGroups.AsNoTracking()
            .Where(x => x.Status == "active")
            .ToListAsync(cancellationToken);
        var memberships = await db.DeviceGroupMembers.AsNoTracking().ToListAsync(cancellationToken);
        var devices = await db.Devices.AsNoTracking().ToDictionaryAsync(x => x.Id, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        foreach (var rule in rules)
        {
            using var config = JsonDocument.Parse(rule.ConfigurationJson);
            var root = config.RootElement;
            var threshold = root.TryGetProperty("offlineThresholdPercent", out var thresholdElement)
                ? Math.Clamp(thresholdElement.GetInt32(), 1, 100)
                : 30;
            var minimum = root.TryGetProperty("minimumAffectedDevices", out var minimumElement)
                ? Math.Max(1, minimumElement.GetInt32())
                : 1;

            IEnumerable<DeviceGroup> targetGroups = groups;
            if (rule.ScopeType == "device_group" && rule.ScopeId is Guid ruleGroupId)
                targetGroups = groups.Where(x => x.Id == ruleGroupId);

            foreach (var group in targetGroups)
            {
                var memberIds = memberships
                    .Where(x => x.GroupId == group.Id)
                    .Select(x => x.DeviceId)
                    .Where(devices.ContainsKey)
                    .ToArray();
                if (memberIds.Length == 0)
                    continue;

                var offline = memberIds.Count(id =>
                    !string.Equals(devices[id].ConnectivityState, "online", StringComparison.OrdinalIgnoreCase));
                var offlinePercent = (int)Math.Round(offline * 100d / memberIds.Length);
                var triggered = offline >= minimum && offlinePercent >= threshold;
                var fingerprint = $"rule:{rule.Id:N}:group:{group.Id:N}";
                var alert = await db.DeviceAlerts.SingleOrDefaultAsync(
                    x => x.Fingerprint == fingerprint,
                    cancellationToken);

                if (triggered)
                {
                    var createdOrReopened = alert is null || alert.Status == "resolved";
                    var detail =
                        $"{offline} of {memberIds.Length} devices are offline ({offlinePercent}%). "
                        + $"Rule threshold is {threshold}% with minimum {minimum} affected device(s).";

                    if (alert is null)
                    {
                        alert = new DeviceAlert
                        {
                            Id = Guid.NewGuid(),
                            RuleId = rule.Id,
                            DeviceGroupId = group.Id,
                            Fingerprint = fingerprint,
                            Severity = rule.Severity,
                            Title = "Abnormal offline rate",
                            Detail = detail,
                            Status = "open",
                            DetectedAt = now,
                            LastObservedAt = now
                        };
                        db.DeviceAlerts.Add(alert);
                    }
                    else
                    {
                        alert.Severity = rule.Severity;
                        alert.Title = "Abnormal offline rate";
                        alert.Detail = detail;
                        alert.LastObservedAt = now;
                        if (alert.Status == "resolved")
                        {
                            alert.Status = "open";
                            alert.DetectedAt = now;
                            alert.AcknowledgedAt = null;
                            alert.AcknowledgedByUserId = null;
                            alert.ResolvedAt = null;
                        }
                    }

                    await db.SaveChangesAsync(cancellationToken);

                    if (createdOrReopened)
                    {
                        db.AlertDeliveryHistory.Add(new AlertDeliveryHistory
                        {
                            Id = Guid.NewGuid(),
                            AlertId = alert.Id,
                            ChannelType = "console",
                            DeliveryStatus = "succeeded",
                            Detail = "Alert Center item created by INNO.One.",
                            AttemptedAt = now
                        });
                        await db.SaveChangesAsync(cancellationToken);

                        var alertId = OpaqueId.Format("alert", alert.Id);
                        await ledger.AppendOutboxAsync(
                            "device.alert.created",
                            "device_alert",
                            alertId,
                            new
                            {
                                alertId,
                                deviceId = (string?)null,
                                ruleId = OpaqueId.Format("arule", rule.Id),
                                severity = alert.Severity,
                                detectedAt = alert.DetectedAt
                            },
                            null,
                            null,
                            null,
                            cancellationToken);
                    }
                }
                else if (alert is not null && alert.Status != "resolved")
                {
                    alert.Status = "resolved";
                    alert.ResolvedAt = now;
                    alert.LastObservedAt = now;
                    await db.SaveChangesAsync(cancellationToken);
                }
            }
        }
    }
}
