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

public static class DeviceHardwareInventoryEndpoints
{
    public static RouteGroupBuilder MapDeviceHardwareInventoryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/{deviceId}/hardware-inventory", GetAsync)
            .WithName("devices.hardware_inventory.get");
        return api;
    }

    private static async Task<IResult> GetAsync(
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
            .Where(x => x.DeviceId == id)
            .OrderByDescending(x => x.ObservedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (snapshot is null)
        {
            return Results.Ok(new ResourceResponse<HardwareInventoryResponse>(
                new(
                    deviceId, "not_reported", null, null, null, null, null,
                    false, null, null, null, null, null, null, null, null,
                    null, null, null, null, null)));
        }

        var isStale = snapshot.ObservedAt < DateTimeOffset.UtcNow.AddHours(-24);
        return Results.Ok(new ResourceResponse<HardwareInventoryResponse>(
            new(
                deviceId,
                snapshot.Completeness,
                OpaqueId.Format("hwi", snapshot.Id),
                snapshot.ObservedAt,
                snapshot.ReceivedAt,
                snapshot.Source,
                snapshot.SourceInstance,
                isStale,
                snapshot.Manufacturer,
                snapshot.Model,
                snapshot.SerialNumber,
                snapshot.Processor,
                snapshot.BiosVersion,
                snapshot.OperatingSystem,
                snapshot.MemoryTotalGb,
                snapshot.MemorySlotsUsed,
                snapshot.MemorySlotsTotal,
                snapshot.IpAddress,
                snapshot.MacAddress,
                device.LastSeenAt,
                device.ConnectivityState)));
    }

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

    private sealed record HardwareInventoryResponse(
        string DeviceId,
        string InventoryStatus,
        string? SnapshotId,
        DateTimeOffset? ObservedAt,
        DateTimeOffset? ReceivedAt,
        string? Source,
        string? SourceInstance,
        bool IsStale,
        string? Manufacturer,
        string? Model,
        string? SerialNumber,
        string? Processor,
        string? BiosVersion,
        string? OperatingSystem,
        decimal? MemoryTotalGb,
        int? MemorySlotsUsed,
        int? MemorySlotsTotal,
        string? IpAddress,
        string? MacAddress,
        DateTimeOffset? LastSeenAt,
        string? ConnectivityState);
}
