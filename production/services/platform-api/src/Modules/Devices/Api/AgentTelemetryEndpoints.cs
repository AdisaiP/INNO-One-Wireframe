using System.Text.RegularExpressions;
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

public static class AgentTelemetryEndpoints
{
    private static readonly string[] AllowedSoftwareArchitectures =
        ["x86", "x64", "arm", "arm64", "universal", "unknown"];

    public static RouteGroupBuilder MapAgentTelemetryEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/agent/devices/{deviceId}/telemetry", IngestAsync)
            .AllowAnonymous()
            .WithName("agent.telemetry.ingest");
        return api;
    }

    private static async Task<IResult> IngestAsync(
        string deviceId,
        AgentTelemetryRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceMachineAuthenticator machineAuthenticator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound();

        Device? device;
        if (machineAuthenticator.HasMachineHeaders(httpContext))
        {
            var machine = await machineAuthenticator.AuthenticateAsync(
                httpContext, db, id, cancellationToken);
            if (!machine.Success || machine.Device is null)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status401Unauthorized,
                    title: "Device authentication failed",
                    detail: machine.FailureCode ?? "DEVICE_CREDENTIAL_INVALID");
            }
            device = machine.Device;
        }
        else
        {
            if (httpContext.User.Identity?.IsAuthenticated != true)
                return Results.Problem(
                    statusCode: StatusCodes.Status401Unauthorized,
                    title: "Authentication required");

            var access = await accessEvaluator.EvaluateAsync(
                httpContext.User, "platform.workspace.access", cancellationToken);
            if (!access.Allowed)
                return Forbidden(access.Reason);

            device = await db.Devices
                .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (device is null)
                return NotFound();
            if (device.OwnerUserId != access.UserId)
                return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");
        }

        var now = DateTimeOffset.UtcNow;
        var observedAt = request.ObservedAt ?? now;
        if (observedAt > now.AddMinutes(5))
            return Validation("observedAt", "Observed time cannot be more than 5 minutes in the future.");
        if (observedAt < now.AddHours(-1))
            return Validation("observedAt", "Agent telemetry older than 1 hour is not accepted.");

        if (!ValidatePerformance(request.Performance, out var performanceError))
            return Validation("performance", performanceError!);
        if (!ValidateNetwork(request.Network, out var networkError))
            return Validation("network", networkError!);
        if (!ValidateHardware(request.Hardware, out var hardwareError))
            return Validation("hardware", hardwareError!);
        if (!TryNormalizeSoftware(request.Software, out var normalizedSoftware, out var softwareError))
            return Validation("software", softwareError!);

        var sourceInstance = Normalize(request.SourceInstance, 160);
        var storedPerformance = false;
        var storedNetwork = false;
        var storedHardware = false;
        var storedSoftware = false;

        if (request.Performance is not null)
        {
            var exists = await db.DevicePerformanceSamples.AsNoTracking()
                .AnyAsync(
                    x => x.DeviceId == id
                        && x.ObservedAt == observedAt
                        && x.Source == "endpoint_agent",
                    cancellationToken);

            if (!exists)
            {
                db.DevicePerformanceSamples.Add(new DevicePerformanceSample
                {
                    Id = Guid.NewGuid(),
                    DeviceId = id,
                    ObservedAt = observedAt,
                    ReceivedAt = now,
                    Source = "endpoint_agent",
                    SourceInstance = sourceInstance,
                    CpuPercent = request.Performance.CpuPercent,
                    MemoryUsedGb = request.Performance.MemoryUsedGb,
                    MemoryTotalGb = request.Performance.MemoryTotalGb,
                    DiskUsedGb = request.Performance.DiskUsedGb,
                    DiskTotalGb = request.Performance.DiskTotalGb
                });
                storedPerformance = true;
            }

            device.CpuPercent = request.Performance.CpuPercent ?? device.CpuPercent;
            device.MemoryUsedGb = request.Performance.MemoryUsedGb ?? device.MemoryUsedGb;
            device.MemoryTotalGb = request.Performance.MemoryTotalGb ?? device.MemoryTotalGb;
            device.DiskUsedGb = request.Performance.DiskUsedGb ?? device.DiskUsedGb;
            device.DiskTotalGb = request.Performance.DiskTotalGb ?? device.DiskTotalGb;
        }

        DeviceInventorySnapshot? inventorySnapshot = null;
        if (request.Hardware is not null || request.Network is not null)
        {
            inventorySnapshot = await db.DeviceInventorySnapshots
                .Where(x => x.DeviceId == id)
                .OrderByDescending(x => x.ObservedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (inventorySnapshot is null)
            {
                inventorySnapshot = new DeviceInventorySnapshot
                {
                    Id = Guid.NewGuid(),
                    DeviceId = id,
                    ObservedAt = observedAt,
                    ReceivedAt = now,
                    Completeness = "partial",
                    Source = "endpoint_agent",
                    SourceInstance = sourceInstance
                };
                db.DeviceInventorySnapshots.Add(inventorySnapshot);
            }
        }

        if (request.Hardware is not null && inventorySnapshot is not null)
        {
            inventorySnapshot.ObservedAt = observedAt;
            inventorySnapshot.ReceivedAt = now;
            inventorySnapshot.Completeness = HardwareCompleteness(request.Hardware);
            inventorySnapshot.Source = "endpoint_agent";
            inventorySnapshot.SourceInstance = sourceInstance;
            inventorySnapshot.Manufacturer = Normalize(request.Hardware.Manufacturer, 200);
            inventorySnapshot.Model = Normalize(request.Hardware.Model, 200);
            inventorySnapshot.SerialNumber = Normalize(request.Hardware.SerialNumber, 200);
            inventorySnapshot.Processor = Normalize(request.Hardware.Processor, 300);
            inventorySnapshot.BiosVersion = Normalize(request.Hardware.BiosVersion, 200);
            inventorySnapshot.OperatingSystem = Normalize(request.Hardware.OperatingSystem, 300);
            inventorySnapshot.MemoryTotalGb = request.Hardware.MemoryTotalGb;
            inventorySnapshot.MemorySlotsUsed = request.Hardware.MemorySlotsUsed;
            inventorySnapshot.MemorySlotsTotal = request.Hardware.MemorySlotsTotal;
            storedHardware = true;

            device.Manufacturer = inventorySnapshot.Manufacturer ?? device.Manufacturer;
            device.Model = inventorySnapshot.Model ?? device.Model;
            device.SerialNumber = inventorySnapshot.SerialNumber ?? device.SerialNumber;
            device.Processor = inventorySnapshot.Processor ?? device.Processor;
            device.BiosVersion = inventorySnapshot.BiosVersion ?? device.BiosVersion;
            device.OperatingSystem = inventorySnapshot.OperatingSystem ?? device.OperatingSystem;
            device.MemoryTotalGb = inventorySnapshot.MemoryTotalGb ?? device.MemoryTotalGb;
        }

        if (request.Network is not null && inventorySnapshot is not null)
        {
            inventorySnapshot.NetworkObservedAt = observedAt;
            inventorySnapshot.NetworkReceivedAt = now;
            inventorySnapshot.NetworkSource = "endpoint_agent";
            inventorySnapshot.NetworkSourceInstance = sourceInstance;
            inventorySnapshot.IpAddress = Normalize(request.Network.IpAddress, 64) ?? inventorySnapshot.IpAddress;
            inventorySnapshot.MacAddress = Normalize(request.Network.MacAddress, 64) ?? inventorySnapshot.MacAddress;
            inventorySnapshot.SubnetMask = Normalize(request.Network.SubnetMask, 64);
            inventorySnapshot.Gateway = Normalize(request.Network.Gateway, 64);
            inventorySnapshot.DnsServers = request.Network.DnsServers is null
                ? null
                : string.Join(
                    ",",
                    request.Network.DnsServers
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Select(x => x.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Take(8));
            inventorySnapshot.NetworkAdapterName = Normalize(request.Network.AdapterName, 240);
            inventorySnapshot.AgentLatencyMs = request.Network.AgentLatencyMs;
            inventorySnapshot.PacketLossPercent = request.Network.PacketLossPercent;
            storedNetwork = true;

            device.IpAddress = inventorySnapshot.IpAddress ?? device.IpAddress;
            device.MacAddress = inventorySnapshot.MacAddress ?? device.MacAddress;
        }

        DeviceSoftwareInventorySnapshot? softwareSnapshot = null;
        if (normalizedSoftware is not null)
        {
            var duplicateObservation = await db.SoftwareInventorySnapshots.AsNoTracking()
                .AnyAsync(
                    x => x.DeviceId == id
                        && x.ObservedAt == observedAt
                        && x.Source == "endpoint_agent",
                    cancellationToken);

            if (!duplicateObservation)
            {
                softwareSnapshot = new DeviceSoftwareInventorySnapshot
                {
                    Id = Guid.NewGuid(),
                    DeviceId = id,
                    ObservedAt = observedAt,
                    ReceivedAt = now,
                    Completeness = normalizedSoftware.Completeness,
                    Source = "endpoint_agent",
                    SourceInstance = sourceInstance,
                    PackageCount = normalizedSoftware.Packages.Count
                };
                db.SoftwareInventorySnapshots.Add(softwareSnapshot);
                db.InstalledSoftware.AddRange(normalizedSoftware.Packages.Select(package =>
                    new DeviceInstalledSoftware
                    {
                        Id = Guid.NewGuid(),
                        SnapshotId = softwareSnapshot.Id,
                        ProductKey = package.ProductKey,
                        DisplayName = package.DisplayName,
                        Version = package.Version,
                        Publisher = package.Publisher,
                        Architecture = package.Architecture
                    }));
                storedSoftware = true;
            }
        }

        device.AgentVersion = sourceInstance ?? device.AgentVersion;
        device.ConnectivityState = "online";
        device.LastSeenAt = now;
        device.UpdatedAt = now;
        device.Version++;

        await db.SaveChangesAsync(cancellationToken);

        var correlationId = httpContext.Request.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? httpContext.TraceIdentifier;
        if (storedHardware && inventorySnapshot is not null)
        {
            await ledger.AppendAuditAsync(
                "devices.hardware_inventory.observed",
                "device",
                deviceId,
                deviceId,
                correlationId,
                httpContext.TraceIdentifier,
                new
                {
                    snapshotId = OpaqueId.Format("hwi", inventorySnapshot.Id),
                    inventorySnapshot.ObservedAt,
                    inventorySnapshot.Completeness,
                    inventorySnapshot.Source
                },
                cancellationToken,
                actorType: "agent");
            await ledger.AppendOutboxAsync(
                "device.hardware_inventory.observed",
                "device",
                deviceId,
                new
                {
                    deviceId,
                    snapshotId = OpaqueId.Format("hwi", inventorySnapshot.Id),
                    inventorySnapshot.ObservedAt,
                    inventorySnapshot.Completeness,
                    inventorySnapshot.Source
                },
                correlationId,
                null,
                httpContext.TraceIdentifier,
                cancellationToken);
        }

        if (storedSoftware && softwareSnapshot is not null)
        {
            await ledger.AppendAuditAsync(
                "devices.software_inventory.observed",
                "device",
                deviceId,
                deviceId,
                correlationId,
                httpContext.TraceIdentifier,
                new
                {
                    snapshotId = OpaqueId.Format("swi", softwareSnapshot.Id),
                    softwareSnapshot.ObservedAt,
                    softwareSnapshot.Completeness,
                    softwareSnapshot.Source,
                    softwareSnapshot.PackageCount
                },
                cancellationToken,
                actorType: "agent");
            await ledger.AppendOutboxAsync(
                "device.software_inventory.observed",
                "device",
                deviceId,
                new
                {
                    deviceId,
                    snapshotId = OpaqueId.Format("swi", softwareSnapshot.Id),
                    softwareSnapshot.ObservedAt,
                    softwareSnapshot.Completeness,
                    softwareSnapshot.Source,
                    softwareSnapshot.PackageCount
                },
                correlationId,
                null,
                httpContext.TraceIdentifier,
                cancellationToken);
        }

        if (storedPerformance && observedAt.ToUnixTimeSeconds() % 300 < 5)
        {
            var retentionCutoff = now.AddHours(-1);
            await db.DevicePerformanceSamples
                .Where(x => x.DeviceId == id && x.ObservedAt < retentionCutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        return Results.Ok(new ResourceResponse<AgentTelemetryResponse>(
            new(
                deviceId,
                observedAt,
                now,
                storedPerformance,
                storedNetwork,
                storedHardware,
                storedSoftware)));
    }

    private static bool ValidatePerformance(
        AgentPerformanceTelemetry? performance,
        out string? error)
    {
        error = null;
        if (performance is null)
            return true;

        if (performance.CpuPercent is < 0 or > 100)
        {
            error = "CPU percent must be between 0 and 100.";
            return false;
        }

        if (performance.MemoryUsedGb is < 0
            || performance.MemoryTotalGb is <= 0
            || (performance.MemoryUsedGb is not null
                && performance.MemoryTotalGb is not null
                && performance.MemoryUsedGb > performance.MemoryTotalGb))
        {
            error = "Memory values are invalid.";
            return false;
        }

        if (performance.DiskUsedGb is < 0
            || performance.DiskTotalGb is <= 0
            || (performance.DiskUsedGb is not null
                && performance.DiskTotalGb is not null
                && performance.DiskUsedGb > performance.DiskTotalGb))
        {
            error = "Disk values are invalid.";
            return false;
        }

        return true;
    }

    private static bool ValidateNetwork(
        AgentNetworkTelemetry? network,
        out string? error)
    {
        error = null;
        if (network is null)
            return true;

        if (network.AgentLatencyMs is < 0 or > 300000)
        {
            error = "Agent latency must be between 0 and 300000 ms.";
            return false;
        }
        if (network.PacketLossPercent is < 0 or > 100)
        {
            error = "Packet loss percent must be between 0 and 100.";
            return false;
        }

        return true;
    }

    private static bool ValidateHardware(
        AgentHardwareTelemetry? hardware,
        out string? error)
    {
        error = null;
        if (hardware is null)
            return true;

        if (hardware.MemoryTotalGb is <= 0)
        {
            error = "Hardware memoryTotalGb must be greater than zero when provided.";
            return false;
        }
        if (hardware.MemorySlotsUsed is < 0 || hardware.MemorySlotsTotal is < 0)
        {
            error = "Hardware memory slot counts cannot be negative.";
            return false;
        }
        if (hardware.MemorySlotsUsed is not null
            && hardware.MemorySlotsTotal is not null
            && hardware.MemorySlotsUsed > hardware.MemorySlotsTotal)
        {
            error = "Hardware memorySlotsUsed cannot exceed memorySlotsTotal.";
            return false;
        }

        return true;
    }

    private static bool TryNormalizeSoftware(
        AgentSoftwareTelemetry? software,
        out NormalizedSoftware? normalized,
        out string? error)
    {
        normalized = null;
        error = null;
        if (software is null)
            return true;

        var completeness = software.Completeness?.Trim().ToLowerInvariant();
        if (completeness is not ("complete" or "partial"))
        {
            error = "Software completeness must be complete or partial.";
            return false;
        }

        if (software.Packages is null || software.Packages.Count > 2000)
        {
            error = "Software packages must contain between 0 and 2,000 items.";
            return false;
        }

        var packages = new List<NormalizedSoftwarePackage>(software.Packages.Count);
        foreach (var package in software.Packages)
        {
            var displayName = Normalize(package.DisplayName, 300);
            if (displayName is null)
            {
                error = "Every software package requires displayName.";
                return false;
            }

            var architecture = Normalize(package.Architecture, 32)?.ToLowerInvariant();
            if (architecture is not null && !AllowedSoftwareArchitectures.Contains(architecture))
            {
                error = "Software architecture must be x86, x64, arm, arm64, universal or unknown.";
                return false;
            }

            packages.Add(new NormalizedSoftwarePackage(
                NormalizeProductKey(package.ProductKey, package.Publisher, displayName),
                displayName,
                Normalize(package.Version, 120),
                Normalize(package.Publisher, 200),
                architecture));
        }

        var duplicate = packages
            .GroupBy(x => x.ProductKey, StringComparer.Ordinal)
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
        {
            error = "Duplicate software productKey: " + duplicate.Key;
            return false;
        }

        normalized = new NormalizedSoftware(completeness, packages);
        return true;
    }

    private static string HardwareCompleteness(AgentHardwareTelemetry hardware) =>
        !string.IsNullOrWhiteSpace(hardware.Manufacturer)
        && !string.IsNullOrWhiteSpace(hardware.Model)
        && !string.IsNullOrWhiteSpace(hardware.Processor)
        && !string.IsNullOrWhiteSpace(hardware.OperatingSystem)
            ? "complete"
            : "partial";

    private static string NormalizeProductKey(string? value, string? publisher, string displayName)
    {
        var raw = string.IsNullOrWhiteSpace(value)
            ? string.Join(
                ":",
                new[] { publisher, displayName }.Where(x => !string.IsNullOrWhiteSpace(x)))
            : value;
        var normalized = Regex.Replace(
            raw!.Trim().ToLowerInvariant(),
            "[^a-z0-9._:+-]+",
            "-").Trim('-');
        return string.IsNullOrWhiteSpace(normalized) ? "unknown-product" : normalized[..Math.Min(240, normalized.Length)];
    }

    private static string? Normalize(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Device not found");

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record AgentTelemetryRequest(
        DateTimeOffset? ObservedAt,
        string? SourceInstance,
        AgentPerformanceTelemetry? Performance,
        AgentNetworkTelemetry? Network,
        AgentHardwareTelemetry? Hardware,
        AgentSoftwareTelemetry? Software);

    public sealed record AgentPerformanceTelemetry(
        int? CpuPercent,
        decimal? MemoryUsedGb,
        decimal? MemoryTotalGb,
        decimal? DiskUsedGb,
        decimal? DiskTotalGb);

    public sealed record AgentNetworkTelemetry(
        string? IpAddress,
        string? MacAddress,
        string? SubnetMask,
        string? Gateway,
        IReadOnlyList<string>? DnsServers,
        string? AdapterName,
        int? AgentLatencyMs,
        decimal? PacketLossPercent);

    public sealed record AgentHardwareTelemetry(
        string? Manufacturer,
        string? Model,
        string? SerialNumber,
        string? Processor,
        string? BiosVersion,
        string? OperatingSystem,
        decimal? MemoryTotalGb,
        int? MemorySlotsUsed,
        int? MemorySlotsTotal);

    public sealed record AgentSoftwareTelemetry(
        string? Completeness,
        IReadOnlyList<AgentSoftwarePackage>? Packages);

    public sealed record AgentSoftwarePackage(
        string? ProductKey,
        string? DisplayName,
        string? Version,
        string? Publisher,
        string? Architecture);

    private sealed record NormalizedSoftware(
        string Completeness,
        IReadOnlyList<NormalizedSoftwarePackage> Packages);

    private sealed record NormalizedSoftwarePackage(
        string ProductKey,
        string DisplayName,
        string? Version,
        string? Publisher,
        string? Architecture);

    private sealed record AgentTelemetryResponse(
        string DeviceId,
        DateTimeOffset ObservedAt,
        DateTimeOffset ReceivedAt,
        bool PerformanceStored,
        bool NetworkStored,
        bool HardwareStored,
        bool SoftwareStored);
}
