using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class AgentTelemetryEndpoints
{
    public static RouteGroupBuilder MapAgentTelemetryEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/agent/devices/{deviceId}/telemetry", IngestAsync)
            .WithName("agent.telemetry.ingest");
        return api;
    }

    private static async Task<IResult> IngestAsync(
        string deviceId,
        AgentTelemetryRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound();

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound();
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        var now = DateTimeOffset.UtcNow;
        var observedAt = request.ObservedAt ?? now;
        if (observedAt > now.AddMinutes(5))
            return Validation("observedAt", "Observed time cannot be more than 5 minutes in the future.");
        if (observedAt < now.AddHours(-1))
            return Validation("observedAt", "Performance telemetry older than 1 hour is not accepted.");

        if (!ValidatePerformance(request.Performance, out var performanceError))
            return Validation("performance", performanceError!);
        if (!ValidateNetwork(request.Network, out var networkError))
            return Validation("network", networkError!);

        var sourceInstance = Normalize(request.SourceInstance, 160);
        var storedPerformance = false;
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

        var storedNetwork = false;
        if (request.Network is not null)
        {
            var snapshot = await db.DeviceInventorySnapshots
                .Where(x => x.DeviceId == id)
                .OrderByDescending(x => x.ObservedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (snapshot is null)
            {
                snapshot = new DeviceInventorySnapshot
                {
                    Id = Guid.NewGuid(),
                    DeviceId = id,
                    ObservedAt = observedAt,
                    ReceivedAt = now,
                    Completeness = "partial",
                    Source = "endpoint_agent",
                    SourceInstance = sourceInstance
                };
                db.DeviceInventorySnapshots.Add(snapshot);
            }

            snapshot.NetworkObservedAt = observedAt;
            snapshot.NetworkReceivedAt = now;
            snapshot.NetworkSource = "endpoint_agent";
            snapshot.NetworkSourceInstance = sourceInstance;
            snapshot.IpAddress = Normalize(request.Network.IpAddress, 64) ?? snapshot.IpAddress;
            snapshot.MacAddress = Normalize(request.Network.MacAddress, 64) ?? snapshot.MacAddress;
            snapshot.SubnetMask = Normalize(request.Network.SubnetMask, 64);
            snapshot.Gateway = Normalize(request.Network.Gateway, 64);
            snapshot.DnsServers = request.Network.DnsServers is null
                ? null
                : string.Join(
                    ",",
                    request.Network.DnsServers
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Select(x => x.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Take(8));
            snapshot.NetworkAdapterName = Normalize(request.Network.AdapterName, 240);
            snapshot.AgentLatencyMs = request.Network.AgentLatencyMs;
            snapshot.PacketLossPercent = request.Network.PacketLossPercent;
            storedNetwork = true;

            device.IpAddress = snapshot.IpAddress ?? device.IpAddress;
            device.MacAddress = snapshot.MacAddress ?? device.MacAddress;
        }

        device.ConnectivityState = "online";
        device.LastSeenAt = now;
        device.UpdatedAt = now;
        device.Version++;

        await db.SaveChangesAsync(cancellationToken);

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
                storedNetwork)));
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
        AgentNetworkTelemetry? Network);

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

    private sealed record AgentTelemetryResponse(
        string DeviceId,
        DateTimeOffset ObservedAt,
        DateTimeOffset ReceivedAt,
        bool PerformanceStored,
        bool NetworkStored);
}
