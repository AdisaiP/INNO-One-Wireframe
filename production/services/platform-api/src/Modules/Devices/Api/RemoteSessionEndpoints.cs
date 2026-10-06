using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Integrations;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class RemoteSessionEndpoints
{
    public static RouteGroupBuilder MapRemoteSessionEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/remote-sessions", ListAsync)
            .WithName("devices.remote_sessions.list");
        api.MapPost("/devices/{deviceId}/remote-sessions", CreateAsync)
            .WithName("devices.remote_sessions.create");
        api.MapGet("/devices/remote-sessions/{sessionId}", GetAsync)
            .WithName("devices.remote_sessions.get");
        api.MapPost("/devices/remote-sessions/{sessionId}/disconnect", DisconnectAsync)
            .WithName("devices.remote_sessions.disconnect");
        api.MapGet("/devices/remote-consent/history", ConsentHistoryAsync)
            .WithName("devices.consent_history.list");
        return api;
    }

    private static async Task<IResult> CreateAsync(
        string deviceId,
        CreateRemoteSessionRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveDeviceAsync(
            deviceId, "devices.remote", httpContext, db, accessEvaluator, cancellationToken);
        if (resolved.Result is not null)
            return resolved.Result;

        var device = resolved.Device!;
        var access = resolved.Access!;
        if (!string.Equals(device.ConnectivityState, "online", StringComparison.OrdinalIgnoreCase))
            return Problem(409, "Resource offline", "RESOURCE_OFFLINE");
        if (device.OwnerUserId is null)
            return Problem(409, "Remote consent unavailable", "DEVICE_HAS_NO_CURRENT_OWNER");

        var externalNodeId = await MeshNodeIdAsync(db, device.Id, cancellationToken);
        if (externalNodeId is null)
            return Problem(409, "Remote engine mapping missing", "MESH_CENTRAL_MAPPING_MISSING");

        var mode = request.Mode?.Trim().ToLowerInvariant() switch
        {
            null or "" or "control" or "remote_control" => "control",
            "view_only" or "view-only" => "view_only",
            _ => null
        };
        if (mode is null)
            return Validation("mode", "Mode must be control or view_only.");

        var existing = await db.RemoteSessions.AsNoTracking()
            .AnyAsync(x => x.DeviceId == device.Id
                && (x.Status == "awaiting_consent" || x.Status == "launching" || x.Status == "active"),
                cancellationToken);
        if (existing)
            return Problem(409, "Remote session already in progress", "REMOTE_SESSION_ALREADY_ACTIVE");

        var now = DateTimeOffset.UtcNow;
        var consentSeconds = Math.Clamp(request.ConsentTimeoutSeconds ?? 60, 15, 300);
        var durationMinutes = Math.Clamp(request.DurationMinutes ?? 60, 5, 480);
        var sessionId = Guid.NewGuid();
        var consentId = Guid.NewGuid();
        var operationId = Guid.NewGuid();
        var actorId = OpaqueId.Format("user", access.UserId);

        var consent = new RemoteConsentRequest
        {
            Id = consentId,
            DeviceId = device.Id,
            RemoteSessionId = sessionId,
            RequestedByUserId = access.UserId,
            OperatorName = string.IsNullOrWhiteSpace(request.OperatorName)
                ? "INNO.One IT Support"
                : request.OperatorName.Trim(),
            OperatorRole = string.IsNullOrWhiteSpace(request.OperatorRole)
                ? null
                : request.OperatorRole.Trim(),
            Mode = mode == "view_only" ? "view_only" : "remote_control",
            MessageTh = string.IsNullOrWhiteSpace(request.MessageTh)
                ? "เจ้าหน้าที่ IT ขออนุญาตเชื่อมต่อเครื่องนี้เพื่อช่วยตรวจสอบหรือแก้ไขปัญหา"
                : request.MessageTh.Trim(),
            MessageEn = string.IsNullOrWhiteSpace(request.MessageEn)
                ? "IT Support would like to connect to this computer to troubleshoot or resolve an issue."
                : request.MessageEn.Trim(),
            Status = "pending",
            RequestedAt = now,
            ExpiresAt = now.AddSeconds(consentSeconds),
            Version = 1
        };

        var session = new RemoteSession
        {
            Id = sessionId,
            DeviceId = device.Id,
            OperatorUserId = access.UserId,
            ConsentRequestId = consentId,
            OperationId = operationId,
            Mode = mode,
            RequestedDurationMinutes = durationMinutes,
            Status = "awaiting_consent",
            RequestedAt = now,
            Version = 1
        };

        db.RemoteConsentRequests.Add(consent);
        db.RemoteSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        await ledger.CreateOperationAsync(
            operationId,
            "remote.session.create",
            "remote_session",
            sessionId,
            actorId,
            "devices.remote",
            cancellationToken);
        var sessionPublicId = OpaqueId.Format("rses", sessionId);
        var resultUrl = $"/api/v1/devices/remote-sessions/{sessionPublicId}";
        await ledger.UpdateOperationAsync(
            operationId, "running", 25, resultUrl, null, cancellationToken);

        await ledger.AppendAuditAsync(
            "devices.remote.session_requested",
            "remote_session",
            sessionPublicId,
            actorId,
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                deviceId,
                mode,
                consentRequestId = OpaqueId.Format("consent", consentId),
                consentExpiresAt = consent.ExpiresAt,
                executionEngine = "meshcentral"
            },
            cancellationToken,
            "restricted");

        await ledger.AppendAuditAsync(
            "devices.remote.consent_requested",
            "remote_session",
            sessionPublicId,
            actorId,
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                deviceId,
                requestId = OpaqueId.Format("consent", consentId),
                consent.Mode,
                consent.ExpiresAt
            },
            cancellationToken,
            "restricted");

        return Results.Accepted(
            resultUrl,
            new RemoteSessionAccepted(
                OpaqueId.Format("op", operationId),
                "running",
                $"/api/v1/operations/{OpaqueId.Format("op", operationId)}",
                25,
                sessionPublicId,
                resultUrl,
                OpaqueId.Format("consent", consentId),
                consent.ExpiresAt));
    }

    private static async Task<IResult> ListAsync(
        int page,
        int pageSize,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.remote", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        await ExpirePendingAsync(db, cancellationToken);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);

        var query = db.RemoteSessions.AsNoTracking()
            .Join(db.Devices.AsNoTracking(),
                session => session.DeviceId,
                device => device.Id,
                (session, device) => new { session, device });

        if (!access.AllResources)
        {
            var orgIds = access.OrganizationIds.ToArray();
            var locationIds = access.LocationIds.ToArray();
            var groupIds = access.DeviceGroupIds.ToArray();
            var groupDeviceIds = db.DeviceGroupMembers.AsNoTracking()
                .Where(x => groupIds.Contains(x.GroupId))
                .Select(x => x.DeviceId);
            query = query.Where(x =>
                (x.device.OrganizationUnitId != null && orgIds.Contains(x.device.OrganizationUnitId.Value))
                || (x.device.LocationId != null && locationIds.Contains(x.device.LocationId.Value))
                || groupDeviceIds.Contains(x.device.Id));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.session.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var consentIds = rows.Select(x => x.session.ConsentRequestId).ToArray();
        var consents = await db.RemoteConsentRequests.AsNoTracking()
            .Where(x => consentIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = rows.Select(x =>
            ToResponse(x.session, x.device, consents.GetValueOrDefault(x.session.ConsentRequestId))).ToArray();

        return Results.Ok(new
        {
            items,
            page,
            pageSize,
            totalItems,
            totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize))
        });
    }

    private static async Task<IResult> GetAsync(
        string sessionId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(sessionId, "rses", out var id))
            return NotFound();

        await ExpirePendingAsync(db, cancellationToken);
        var session = await db.RemoteSessions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (session is null)
            return NotFound();

        var resolved = await ResolveDeviceAsync(
            OpaqueId.Format("dev", session.DeviceId),
            "devices.remote",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (resolved.Result is not null)
            return resolved.Result;

        var consent = await db.RemoteConsentRequests.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == session.ConsentRequestId, cancellationToken);

        return Results.Ok(new ResourceResponse<RemoteSessionResponse>(
            ToResponse(session, resolved.Device!, consent)));
    }

    private static async Task<IResult> DisconnectAsync(
        string sessionId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        IRemoteDeviceEngine remoteEngine,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(sessionId, "rses", out var id))
            return NotFound();

        var session = await db.RemoteSessions
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (session is null)
            return NotFound();

        var resolved = await ResolveDeviceAsync(
            OpaqueId.Format("dev", session.DeviceId),
            "devices.remote",
            httpContext,
            db,
            accessEvaluator,
            cancellationToken);
        if (resolved.Result is not null)
            return resolved.Result;

        if (session.Status is "ended" or "declined" or "expired")
            return Results.Ok(new ResourceResponse<RemoteSessionResponse>(
                ToResponse(
                    session,
                    resolved.Device!,
                    await db.RemoteConsentRequests.AsNoTracking()
                        .SingleOrDefaultAsync(x => x.Id == session.ConsentRequestId, cancellationToken))));

        if (session.Status != "active" || string.IsNullOrWhiteSpace(session.ExternalShareId))
            return Problem(409, "Remote session is not active", "REMOTE_SESSION_NOT_ACTIVE");

        var externalNodeId = await MeshNodeIdAsync(db, session.DeviceId, cancellationToken);
        if (externalNodeId is null)
            return Problem(409, "Remote engine mapping missing", "MESH_CENTRAL_MAPPING_MISSING");

        try
        {
            await remoteEngine.RemoveDesktopShareAsync(
                externalNodeId, session.ExternalShareId, cancellationToken);
        }
        catch (RemoteEngineUnavailableException ex)
        {
            return Problem(503, "Remote engine unavailable", ex.Message);
        }

        session.Status = "ended";
        session.EndedAt = DateTimeOffset.UtcNow;
        session.EndReason = "operator_disconnected";
        session.LaunchUrl = null;
        session.ExternalShareId = null;
        session.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var actorId = OpaqueId.Format("user", resolved.Access!.UserId);
        await ledger.AppendAuditAsync(
            "devices.remote.session_ended",
            "remote_session",
            sessionId,
            actorId,
            httpContext.TraceIdentifier,
            httpContext.TraceIdentifier,
            new
            {
                deviceId = OpaqueId.Format("dev", session.DeviceId),
                reason = session.EndReason,
                executionEngine = "meshcentral"
            },
            cancellationToken,
            "restricted");
        await ledger.AppendOutboxAsync(
            "remote.ended",
            "remote_session",
            sessionId,
            new
            {
                sessionId,
                deviceId = OpaqueId.Format("dev", session.DeviceId),
                operatorUserId = OpaqueId.Format("user", session.OperatorUserId),
                endedAt = session.EndedAt,
                reason = session.EndReason
            },
            httpContext.TraceIdentifier,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        var consent = await db.RemoteConsentRequests.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == session.ConsentRequestId, cancellationToken);
        return Results.Ok(new ResourceResponse<RemoteSessionResponse>(
            ToResponse(session, resolved.Device!, consent)));
    }

    private static async Task<IResult> ConsentHistoryAsync(
        int page,
        int pageSize,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);
        var query = db.RemoteConsentRequests.AsNoTracking()
            .Join(db.Devices.AsNoTracking(),
                consent => consent.DeviceId,
                device => device.Id,
                (consent, device) => new { consent, device });

        if (!access.AllResources)
        {
            var orgIds = access.OrganizationIds.ToArray();
            var locationIds = access.LocationIds.ToArray();
            var groupIds = access.DeviceGroupIds.ToArray();
            var groupDeviceIds = db.DeviceGroupMembers.AsNoTracking()
                .Where(x => groupIds.Contains(x.GroupId))
                .Select(x => x.DeviceId);
            query = query.Where(x =>
                (x.device.OrganizationUnitId != null && orgIds.Contains(x.device.OrganizationUnitId.Value))
                || (x.device.LocationId != null && locationIds.Contains(x.device.LocationId.Value))
                || groupDeviceIds.Contains(x.device.Id));
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.consent.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            items = rows.Select(x => new RemoteConsentHistoryItem(
                OpaqueId.Format("consent", x.consent.Id),
                x.consent.RemoteSessionId is Guid rs ? OpaqueId.Format("rses", rs) : null,
                OpaqueId.Format("dev", x.device.Id),
                x.device.Hostname,
                x.consent.OperatorName,
                x.consent.OperatorRole,
                x.consent.Mode,
                x.consent.Status,
                x.consent.RequestedAt,
                x.consent.ExpiresAt,
                x.consent.DecidedAt)).ToArray(),
            page,
            pageSize,
            totalItems,
            totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize))
        });
    }

    private static async Task ExpirePendingAsync(
        DevicesDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var expiredConsents = await db.RemoteConsentRequests
            .Where(x => x.Status == "pending" && x.ExpiresAt <= now)
            .ToListAsync(cancellationToken);
        if (expiredConsents.Count == 0)
            return;

        var sessionIds = expiredConsents
            .Where(x => x.RemoteSessionId != null)
            .Select(x => x.RemoteSessionId!.Value)
            .ToArray();
        var sessions = await db.RemoteSessions
            .Where(x => sessionIds.Contains(x.Id) && x.Status == "awaiting_consent")
            .ToListAsync(cancellationToken);

        foreach (var consent in expiredConsents)
        {
            consent.Status = "expired";
            consent.Version++;
        }

        foreach (var session in sessions)
        {
            session.Status = "expired";
            session.EndedAt = now;
            session.EndReason = "consent_timeout";
            session.FailureCode = "CONSENT_TIMEOUT";
            session.Version++;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static RemoteSessionResponse ToResponse(
        RemoteSession session,
        Device device,
        RemoteConsentRequest? consent) =>
        new(
            OpaqueId.Format("rses", session.Id),
            OpaqueId.Format("dev", device.Id),
            device.Hostname,
            OpaqueId.Format("user", session.OperatorUserId),
            consent?.OperatorName ?? "INNO.One IT Support",
            session.Mode,
            session.Status,
            consent?.Status ?? "unknown",
            consent is null ? null : OpaqueId.Format("consent", consent.Id),
            session.Status == "active" ? session.LaunchUrl : null,
            session.RequestedAt,
            session.StartedAt,
            session.EndedAt,
            session.ExpiresAt,
            session.EndReason,
            session.FailureCode);

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
            httpContext.User, permission, cancellationToken);
        if (!access.Allowed)
            return (null, null, Forbidden(access.Reason));

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return (null, null, NotFound());

        if (!access.AllResources)
        {
            var direct = (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
                || (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId));
            if (!direct)
            {
                var groupIds = access.DeviceGroupIds.ToArray();
                var inGroup = groupIds.Length > 0 && await db.DeviceGroupMembers.AsNoTracking()
                    .AnyAsync(x => x.DeviceId == device.Id && groupIds.Contains(x.GroupId), cancellationToken);
                if (!inGroup)
                    return (null, null, Forbidden("OUTSIDE_ASSIGNED_SCOPE"));
            }
        }

        return (device, access, null);
    }

    private static Task<string?> MeshNodeIdAsync(
        DevicesDbContext db,
        Guid deviceId,
        CancellationToken cancellationToken) =>
        db.DeviceExternalMappings.AsNoTracking()
            .Where(x => x.DeviceId == deviceId && x.Provider == "meshcentral")
            .Select(x => x.ExternalId)
            .SingleOrDefaultAsync(cancellationToken);

    private static IResult Forbidden(string reason) => Problem(403, "Access denied", reason);
    private static IResult NotFound() => Problem(404, "Remote session not found", "REMOTE_SESSION_NOT_FOUND");
    private static IResult Problem(int status, string title, string detail) =>
        Results.Problem(statusCode: status, title: title, detail: detail);
    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record CreateRemoteSessionRequest(
        string? Mode,
        int? DurationMinutes,
        int? ConsentTimeoutSeconds,
        string? OperatorName,
        string? OperatorRole,
        string? MessageTh,
        string? MessageEn);

    private sealed record RemoteSessionAccepted(
        string OperationId,
        string Status,
        string StatusUrl,
        int Progress,
        string SessionId,
        string ResultUrl,
        string ConsentRequestId,
        DateTimeOffset ConsentExpiresAt);

    public sealed record RemoteSessionResponse(
        string Id,
        string DeviceId,
        string DeviceName,
        string OperatorUserId,
        string OperatorName,
        string Mode,
        string Status,
        string ConsentStatus,
        string? ConsentRequestId,
        string? LaunchUrl,
        DateTimeOffset RequestedAt,
        DateTimeOffset? StartedAt,
        DateTimeOffset? EndedAt,
        DateTimeOffset? ExpiresAt,
        string? EndReason,
        string? FailureCode);

    private sealed record RemoteConsentHistoryItem(
        string Id,
        string? SessionId,
        string DeviceId,
        string DeviceName,
        string OperatorName,
        string? OperatorRole,
        string Mode,
        string Status,
        DateTimeOffset RequestedAt,
        DateTimeOffset ExpiresAt,
        DateTimeOffset? DecidedAt);
}
