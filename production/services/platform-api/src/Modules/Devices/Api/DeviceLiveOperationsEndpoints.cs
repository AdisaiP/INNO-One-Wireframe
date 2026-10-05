using System.Text.RegularExpressions;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Integrations;
using INNO.One.Modules.Devices.Application;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static partial class DeviceLiveOperationsEndpoints
{
    public static RouteGroupBuilder MapDeviceLiveOperationsEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/devices/{deviceId}/processes/snapshots", CreateProcessSnapshotAsync)
            .WithName("devices.process_snapshot.create");
        api.MapGet("/devices/{deviceId}/processes/snapshots/{snapshotId}", GetProcessSnapshotAsync)
            .WithName("devices.process_snapshot.get");
        api.MapPost("/devices/{deviceId}/processes/{processKey}/terminate", TerminateProcessAsync)
            .WithName("devices.process.terminate");

        api.MapPost("/devices/{deviceId}/services/snapshots", CreateServiceSnapshotAsync)
            .WithName("devices.service_snapshot.create");
        api.MapGet("/devices/{deviceId}/services/snapshots/{snapshotId}", GetServiceSnapshotAsync)
            .WithName("devices.service_snapshot.get");
        api.MapPost("/devices/{deviceId}/services/{serviceName}/actions", ExecuteServiceActionAsync)
            .WithName("devices.service.action");
        return api;
    }

    private static async Task<IResult> CreateProcessSnapshotAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLiveSnapshotStore snapshots,
        DeviceLedgerWriter ledger,
        IRemoteDeviceEngine remoteEngine,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.view",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        var device = context.Device!;
        var access = context.Access!;
        if (device.ConnectivityState != "online")
            return ResourceOffline();

        var externalNodeId = await GetMeshCentralNodeIdAsync(db, device.Id, cancellationToken);
        if (externalNodeId is null)
            return RemoteMappingMissing();

        var operationId = Guid.NewGuid();
        var actorId = OpaqueId.Format("user", access.UserId);
        await ledger.CreateOperationAsync(
            operationId,
            "device.process.snapshot",
            "device",
            device.Id,
            actorId,
            "devices.view",
            cancellationToken);

        try
        {
            await ledger.UpdateOperationAsync(
                operationId, "running", 25, null, null, cancellationToken);

            var items = await remoteEngine.ListProcessesAsync(externalNodeId, cancellationToken);
            var snapshot = snapshots.AddProcesses(device.Id, items, "meshcentral");

            var snapshotId = OpaqueId.Format("pss", snapshot.Id);
            var statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}";
            var resultUrl = $"/api/v1/devices/{deviceId}/processes/snapshots/{snapshotId}";

            await ledger.UpdateOperationAsync(
                operationId, "succeeded", 100, resultUrl, null, cancellationToken);

            return Results.Accepted(
                statusUrl,
                new LiveSnapshotOperationAccepted(
                    OpaqueId.Format("op", operationId),
                    "succeeded",
                    statusUrl,
                    100,
                    snapshotId,
                    resultUrl,
                    snapshot.ExpiresAt));
        }
        catch (RemoteEngineUnavailableException ex)
        {
            await ledger.UpdateOperationAsync(
                operationId, "failed", 100, null, "REMOTE_ENGINE_UNAVAILABLE", cancellationToken);
            return RemoteEngineUnavailable(ex.Message);
        }
    }

    private static async Task<IResult> GetProcessSnapshotAsync(
        string deviceId,
        string snapshotId,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLiveSnapshotStore snapshots,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.view",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        if (!OpaqueId.TryParse(snapshotId, "pss", out var id))
            return SnapshotExpired();

        var snapshot = snapshots.GetProcesses(context.Device!.Id, id);
        if (snapshot is null)
            return SnapshotExpired();

        return Results.Ok(new ResourceResponse<ProcessSnapshotResponse>(
            new(
                snapshotId,
                deviceId,
                snapshot.ObservedAt,
                snapshot.ExpiresAt,
                snapshot.Source,
                snapshot.Items.Select(ToProcessResponse).ToArray())));
    }

    private static async Task<IResult> TerminateProcessAsync(
        string deviceId,
        string processKey,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLedgerWriter ledger,
        IRemoteDeviceEngine remoteEngine,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.manage",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        if (!TryParseProcessKey(processKey, out var pid))
            return Validation("processKey", "Process key is invalid.");

        var device = context.Device!;
        var access = context.Access!;
        if (device.ConnectivityState != "online")
            return ResourceOffline();

        var externalNodeId = await GetMeshCentralNodeIdAsync(db, device.Id, cancellationToken);
        if (externalNodeId is null)
            return RemoteMappingMissing();

        var operationId = Guid.NewGuid();
        var actorId = OpaqueId.Format("user", access.UserId);
        await ledger.CreateOperationAsync(
            operationId,
            "device.process.terminate",
            "device",
            device.Id,
            actorId,
            "devices.manage",
            cancellationToken);

        try
        {
            await ledger.UpdateOperationAsync(
                operationId, "running", 25, null, null, cancellationToken);

            var verified = await remoteEngine.TerminateProcessAsync(
                externalNodeId,
                pid,
                cancellationToken);

            var status = verified ? "succeeded" : "failed";
            var errorCode = verified ? null : "REMOTE_ACTION_UNVERIFIED";
            await ledger.UpdateOperationAsync(
                operationId, status, 100, null, errorCode, cancellationToken);

            await ledger.AppendAuditAsync(
                "devices.process.terminate",
                "device",
                deviceId,
                actorId,
                httpContext.TraceIdentifier,
                httpContext.TraceIdentifier,
                new
                {
                    processKey,
                    processId = pid,
                    executionEngine = "meshcentral",
                    verified
                },
                cancellationToken);

            if (!verified)
                return RemoteActionUnverified("Process termination could not be verified.");

            var statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}";
            return Results.Accepted(
                statusUrl,
                new ActionOperationAccepted(
                    OpaqueId.Format("op", operationId),
                    "succeeded",
                    statusUrl,
                    100,
                    true));
        }
        catch (RemoteEngineUnavailableException ex)
        {
            await ledger.UpdateOperationAsync(
                operationId, "failed", 100, null, "REMOTE_ENGINE_UNAVAILABLE", cancellationToken);
            return RemoteEngineUnavailable(ex.Message);
        }
    }

    private static async Task<IResult> CreateServiceSnapshotAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLiveSnapshotStore snapshots,
        DeviceLedgerWriter ledger,
        IRemoteDeviceEngine remoteEngine,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.view",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        var device = context.Device!;
        var access = context.Access!;
        if (device.ConnectivityState != "online")
            return ResourceOffline();

        var externalNodeId = await GetMeshCentralNodeIdAsync(db, device.Id, cancellationToken);
        if (externalNodeId is null)
            return RemoteMappingMissing();

        var operationId = Guid.NewGuid();
        var actorId = OpaqueId.Format("user", access.UserId);
        await ledger.CreateOperationAsync(
            operationId,
            "device.service.snapshot",
            "device",
            device.Id,
            actorId,
            "devices.view",
            cancellationToken);

        try
        {
            await ledger.UpdateOperationAsync(
                operationId, "running", 25, null, null, cancellationToken);

            var items = await remoteEngine.ListServicesAsync(externalNodeId, cancellationToken);
            var snapshot = snapshots.AddServices(device.Id, items, "meshcentral");

            var snapshotId = OpaqueId.Format("svs", snapshot.Id);
            var statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}";
            var resultUrl = $"/api/v1/devices/{deviceId}/services/snapshots/{snapshotId}";

            await ledger.UpdateOperationAsync(
                operationId, "succeeded", 100, resultUrl, null, cancellationToken);

            return Results.Accepted(
                statusUrl,
                new LiveSnapshotOperationAccepted(
                    OpaqueId.Format("op", operationId),
                    "succeeded",
                    statusUrl,
                    100,
                    snapshotId,
                    resultUrl,
                    snapshot.ExpiresAt));
        }
        catch (RemoteEngineUnavailableException ex)
        {
            await ledger.UpdateOperationAsync(
                operationId, "failed", 100, null, "REMOTE_ENGINE_UNAVAILABLE", cancellationToken);
            return RemoteEngineUnavailable(ex.Message);
        }
    }

    private static async Task<IResult> GetServiceSnapshotAsync(
        string deviceId,
        string snapshotId,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLiveSnapshotStore snapshots,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.view",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        if (!OpaqueId.TryParse(snapshotId, "svs", out var id))
            return SnapshotExpired();

        var snapshot = snapshots.GetServices(context.Device!.Id, id);
        if (snapshot is null)
            return SnapshotExpired();

        return Results.Ok(new ResourceResponse<ServiceSnapshotResponse>(
            new(
                snapshotId,
                deviceId,
                snapshot.ObservedAt,
                snapshot.ExpiresAt,
                snapshot.Source,
                snapshot.Items.Select(ToServiceResponse).ToArray())));
    }

    private static async Task<IResult> ExecuteServiceActionAsync(
        string deviceId,
        string serviceName,
        ServiceActionRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        DeviceLedgerWriter ledger,
        IRemoteDeviceEngine remoteEngine,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var context = await ResolveDeviceAsync(
            deviceId,
            "devices.manage",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (context.Result is not null)
            return context.Result;

        if (string.IsNullOrWhiteSpace(serviceName) || serviceName.Length > 240)
            return Validation("serviceName", "Service name is invalid.");

        if (!TryParseServiceAction(request.Action, out var action))
            return Validation("action", "Action must be start, stop or restart.");

        var device = context.Device!;
        var access = context.Access!;
        if (device.ConnectivityState != "online")
            return ResourceOffline();

        var externalNodeId = await GetMeshCentralNodeIdAsync(db, device.Id, cancellationToken);
        if (externalNodeId is null)
            return RemoteMappingMissing();

        var operationId = Guid.NewGuid();
        var actorId = OpaqueId.Format("user", access.UserId);
        await ledger.CreateOperationAsync(
            operationId,
            "device.service.action",
            "device",
            device.Id,
            actorId,
            "devices.manage",
            cancellationToken);

        try
        {
            await ledger.UpdateOperationAsync(
                operationId, "running", 25, null, null, cancellationToken);

            var verified = await remoteEngine.ExecuteServiceActionAsync(
                externalNodeId,
                serviceName,
                action,
                cancellationToken);

            var status = verified ? "succeeded" : "failed";
            var errorCode = verified ? null : "REMOTE_ACTION_UNVERIFIED";
            await ledger.UpdateOperationAsync(
                operationId, status, 100, null, errorCode, cancellationToken);

            await ledger.AppendAuditAsync(
                "devices.service.action",
                "device",
                deviceId,
                actorId,
                httpContext.TraceIdentifier,
                httpContext.TraceIdentifier,
                new
                {
                    serviceName,
                    action = request.Action.ToLowerInvariant(),
                    executionEngine = "meshcentral",
                    verified
                },
                cancellationToken);

            if (!verified)
                return RemoteActionUnverified("Service action could not be verified.");

            var statusUrl = $"/api/v1/operations/{OpaqueId.Format("op", operationId)}";
            return Results.Accepted(
                statusUrl,
                new ActionOperationAccepted(
                    OpaqueId.Format("op", operationId),
                    "succeeded",
                    statusUrl,
                    100,
                    true));
        }
        catch (RemoteEngineUnavailableException ex)
        {
            await ledger.UpdateOperationAsync(
                operationId, "failed", 100, null, "REMOTE_ENGINE_UNAVAILABLE", cancellationToken);
            return RemoteEngineUnavailable(ex.Message);
        }
    }

    private static ProcessItemResponse ToProcessResponse(RemoteProcessInfo item) =>
        new(
            $"proc_{item.ProcessId}",
            item.ProcessId,
            item.Name,
            item.User,
            item.CommandLine,
            item.CpuPercent,
            item.MemoryBytes,
            "running");

    private static ServiceItemResponse ToServiceResponse(RemoteServiceInfo item) =>
        new(
            item.Name,
            item.DisplayName,
            item.Status,
            item.StartType,
            item.User);

    private static async Task<(Device? Device, EffectiveAccess? Access, IResult? Result)> ResolveDeviceAsync(
        string deviceId,
        string permission,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return (null, null, NotFound());

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            permission,
            cancellationToken);
        if (!access.Allowed)
            return (null, null, Forbidden(access.Reason));

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return (null, null, NotFound());

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
            return (null, null, Forbidden("OUTSIDE_ASSIGNED_SCOPE"));

        return (device, access, null);
    }

    private static async Task<string?> GetMeshCentralNodeIdAsync(
        DevicesDbContext db,
        Guid deviceId,
        CancellationToken cancellationToken) =>
        await db.DeviceExternalMappings.AsNoTracking()
            .Where(x => x.DeviceId == deviceId && x.Provider == "meshcentral")
            .Select(x => x.ExternalId)
            .SingleOrDefaultAsync(cancellationToken);

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
            .AnyAsync(
                x => x.DeviceId == device.Id && groupIds.Contains(x.GroupId),
                cancellationToken);
    }

    private static bool TryParseProcessKey(string processKey, out int processId)
    {
        processId = 0;
        var match = ProcessKeyRegex().Match(processKey);
        return match.Success
            && int.TryParse(match.Groups["pid"].Value, out processId)
            && processId > 0;
    }

    private static bool TryParseServiceAction(string? value, out RemoteServiceAction action)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case "start":
                action = RemoteServiceAction.Start;
                return true;
            case "stop":
                action = RemoteServiceAction.Stop;
                return true;
            case "restart":
                action = RemoteServiceAction.Restart;
                return true;
            default:
                action = default;
                return false;
        }
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Device not found");

    private static IResult ResourceOffline() => Results.Problem(
        statusCode: StatusCodes.Status409Conflict,
        title: "Resource offline",
        detail: "RESOURCE_OFFLINE");

    private static IResult RemoteMappingMissing() => Results.Problem(
        statusCode: StatusCodes.Status409Conflict,
        title: "Remote engine mapping missing",
        detail: "MESH_CENTRAL_MAPPING_MISSING");

    private static IResult RemoteEngineUnavailable(string detail) => Results.Problem(
        statusCode: StatusCodes.Status503ServiceUnavailable,
        title: "Remote engine unavailable",
        detail: detail);

    private static IResult RemoteActionUnverified(string detail) => Results.Problem(
        statusCode: StatusCodes.Status502BadGateway,
        title: "Remote action unverified",
        detail: detail);

    private static IResult SnapshotExpired() => Results.Problem(
        statusCode: StatusCodes.Status410Gone,
        title: "Live snapshot expired",
        detail: "LIVE_SNAPSHOT_EXPIRED");

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    [GeneratedRegex("^proc_(?<pid>[1-9][0-9]{0,9})$", RegexOptions.CultureInvariant)]
    private static partial Regex ProcessKeyRegex();

    private sealed record LiveSnapshotOperationAccepted(
        string OperationId,
        string Status,
        string StatusUrl,
        int Progress,
        string SnapshotId,
        string ResultUrl,
        DateTimeOffset ExpiresAt);

    private sealed record ActionOperationAccepted(
        string OperationId,
        string Status,
        string StatusUrl,
        int Progress,
        bool Verified);

    private sealed record ProcessSnapshotResponse(
        string SnapshotId,
        string DeviceId,
        DateTimeOffset ObservedAt,
        DateTimeOffset ExpiresAt,
        string Source,
        IReadOnlyList<ProcessItemResponse> Items);

    private sealed record ProcessItemResponse(
        string ProcessKey,
        int ProcessId,
        string Name,
        string? User,
        string? CommandLine,
        decimal? CpuPercent,
        long? MemoryBytes,
        string Status);

    private sealed record ServiceSnapshotResponse(
        string SnapshotId,
        string DeviceId,
        DateTimeOffset ObservedAt,
        DateTimeOffset ExpiresAt,
        string Source,
        IReadOnlyList<ServiceItemResponse> Items);

    private sealed record ServiceItemResponse(
        string Name,
        string? DisplayName,
        string? Status,
        string? StartType,
        string? User);

    public sealed record ServiceActionRequest(string Action);
}
