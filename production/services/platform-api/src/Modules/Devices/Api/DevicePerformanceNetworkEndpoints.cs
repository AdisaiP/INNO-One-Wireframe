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

public static class DevicePerformanceNetworkEndpoints
{
    public static RouteGroupBuilder MapDevicePerformanceNetworkEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/{deviceId}/performance", GetPerformanceAsync)
            .WithName("devices.performance.get");
        api.MapGet("/devices/{deviceId}/network-inventory", GetNetworkAsync)
            .WithName("devices.network_inventory.get");
        return api;
    }

    private static async Task<IResult> GetPerformanceAsync(
        string deviceId,
        string? window,
        int? interval,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound();

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound();

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var windowSeconds = window?.Trim().ToLowerInvariant() switch
        {
            "15m" => 15 * 60,
            "1h" => 60 * 60,
            _ => 5 * 60
        };
        var intervalSeconds = interval switch
        {
            15 => 15,
            30 => 30,
            60 => 60,
            _ => 5
        };

        var cutoff = DateTimeOffset.UtcNow.AddSeconds(-windowSeconds);
        var raw = await db.DevicePerformanceSamples.AsNoTracking()
            .Where(x => x.DeviceId == id && x.ObservedAt >= cutoff)
            .OrderBy(x => x.ObservedAt)
            .ToListAsync(cancellationToken);

        var points = Bucket(raw, intervalSeconds)
            .Select(x => new PerformancePointResponse(
                x.ObservedAt,
                x.CpuPercent,
                x.MemoryUsedGb,
                x.MemoryTotalGb,
                x.DiskUsedGb,
                x.DiskTotalGb,
                x.Source))
            .ToArray();

        var latest = raw.LastOrDefault();
        if (latest is null)
        {
            latest = await db.DevicePerformanceSamples.AsNoTracking()
                .Where(x => x.DeviceId == id)
                .OrderByDescending(x => x.ObservedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var isLive = latest is not null
            && device.ConnectivityState == "online"
            && latest.Source == "endpoint_agent"
            && latest.ObservedAt >= DateTimeOffset.UtcNow.AddSeconds(-60);

        var status = latest is null ? "no_data" : isLive ? "live" : "stale";

        return Results.Ok(new ResourceResponse<PerformanceResponse>(
            new(
                deviceId,
                status,
                isLive,
                latest is not null && !isLive,
                latest?.ObservedAt,
                latest?.ReceivedAt,
                latest?.Source,
                windowSeconds,
                intervalSeconds,
                latest?.CpuPercent,
                latest?.MemoryUsedGb,
                latest?.MemoryTotalGb,
                latest?.DiskUsedGb,
                latest?.DiskTotalGb,
                points)));
    }

    private static async Task<IResult> GetNetworkAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound();

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound();

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        var snapshot = await db.DeviceInventorySnapshots.AsNoTracking()
            .Where(x => x.DeviceId == id && x.NetworkObservedAt != null)
            .OrderByDescending(x => x.NetworkObservedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (snapshot is null)
        {
            return Results.Ok(new ResourceResponse<NetworkInventoryResponse>(
                new(
                    deviceId,
                    "not_reported",
                    null,
                    null,
                    null,
                    null,
                    null,
                    false,
                    device.ConnectivityState,
                    device.IpAddress,
                    device.MacAddress,
                    null,
                    null,
                    [],
                    null,
                    null,
                    null)));
        }

        var observedAt = snapshot.NetworkObservedAt!.Value;
        var isStale = observedAt < DateTimeOffset.UtcNow.AddMinutes(-15);
        return Results.Ok(new ResourceResponse<NetworkInventoryResponse>(
            new(
                deviceId,
                "reported",
                OpaqueId.Format("hwi", snapshot.Id),
                observedAt,
                snapshot.NetworkReceivedAt,
                snapshot.NetworkSource ?? snapshot.Source,
                snapshot.NetworkSourceInstance ?? snapshot.SourceInstance,
                isStale,
                device.ConnectivityState,
                snapshot.IpAddress ?? device.IpAddress,
                snapshot.MacAddress ?? device.MacAddress,
                snapshot.SubnetMask,
                snapshot.Gateway,
                ParseDns(snapshot.DnsServers),
                snapshot.NetworkAdapterName,
                snapshot.AgentLatencyMs,
                snapshot.PacketLossPercent)));
    }

    private static IEnumerable<DevicePerformanceSample> Bucket(
        IReadOnlyList<DevicePerformanceSample> samples,
        int intervalSeconds)
    {
        if (samples.Count == 0)
            return [];

        var result = new List<DevicePerformanceSample>();
        long? currentBucket = null;
        DevicePerformanceSample? latest = null;

        foreach (var sample in samples)
        {
            var bucket = sample.ObservedAt.ToUnixTimeSeconds() / intervalSeconds;
            if (currentBucket is not null && bucket != currentBucket && latest is not null)
                result.Add(latest);

            currentBucket = bucket;
            latest = sample;
        }

        if (latest is not null)
            result.Add(latest);

        return result;
    }

    private static string[] ParseDns(string? dnsServers) =>
        string.IsNullOrWhiteSpace(dnsServers)
            ? []
            : dnsServers.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

    private static async Task<bool> CanAccessDeviceAsync(
        DevicesDbContext db,
        EffectiveAccess access,
        Device device,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
            return true;

        if (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            return true;
        if (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            return true;

        var groupIds = access.DeviceGroupIds.ToArray();
        return groupIds.Length > 0 && await db.DeviceGroupMembers.AsNoTracking()
            .AnyAsync(x => x.DeviceId == device.Id && groupIds.Contains(x.GroupId), cancellationToken);
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Device not found");

    private sealed record PerformanceResponse(
        string DeviceId,
        string Status,
        bool IsLive,
        bool IsStale,
        DateTimeOffset? LatestObservedAt,
        DateTimeOffset? LatestReceivedAt,
        string? Source,
        int WindowSeconds,
        int IntervalSeconds,
        int? CpuPercent,
        decimal? MemoryUsedGb,
        decimal? MemoryTotalGb,
        decimal? DiskUsedGb,
        decimal? DiskTotalGb,
        IReadOnlyList<PerformancePointResponse> Points);

    private sealed record PerformancePointResponse(
        DateTimeOffset ObservedAt,
        int? CpuPercent,
        decimal? MemoryUsedGb,
        decimal? MemoryTotalGb,
        decimal? DiskUsedGb,
        decimal? DiskTotalGb,
        string Source);

    private sealed record NetworkInventoryResponse(
        string DeviceId,
        string InventoryStatus,
        string? SnapshotId,
        DateTimeOffset? ObservedAt,
        DateTimeOffset? ReceivedAt,
        string? Source,
        string? SourceInstance,
        bool IsStale,
        string ConnectivityState,
        string? IpAddress,
        string? MacAddress,
        string? SubnetMask,
        string? Gateway,
        IReadOnlyList<string> DnsServers,
        string? AdapterName,
        int? AgentLatencyMs,
        decimal? PacketLossPercent);
}
