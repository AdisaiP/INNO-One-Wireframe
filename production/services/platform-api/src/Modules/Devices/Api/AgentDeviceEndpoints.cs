using INNO.One.Contracts.Agent;
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

public static class AgentDeviceEndpoints
{
    public static RouteGroupBuilder MapAgentDeviceEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/agent/device-context/{deviceId}", GetDeviceContextAsync)
            .WithName("agent.device_context.get");
        api.MapGet("/agent/remote-consent/pending", GetPendingConsentAsync)
            .WithName("agent.remote_consent.pending");
        api.MapPost("/agent/remote-consent/requests/{requestId}/decision", DecideConsentAsync)
            .WithName("agent.remote_consent.decision");
        api.MapPost("/devices/{deviceId}/remote-consent-requests", CreateConsentRequestAsync)
            .WithName("devices.remote_consent.request.create");
        api.MapGet("/agent/prompts/pending", GetPendingPromptAsync)
            .WithName("agent.prompts.pending");
        api.MapPost("/agent/prompts/{promptId}/response", RespondToPromptAsync)
            .WithName("agent.prompts.response");
        api.MapPost("/devices/{deviceId}/agent-prompts", CreateAgentPromptAsync)
            .WithName("devices.agent_prompts.create");
        return api;
    }

    private static async Task<IResult> GetDeviceContextAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");

        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        return Results.Ok(new ResourceResponse<AgentDeviceContextResponse>(
            new(
                deviceId,
                device.Hostname,
                device.DeviceType,
                device.ConnectivityState,
                device.OperatingSystem,
                device.IpAddress,
                device.Manufacturer,
                device.Model,
                device.AssetReference,
                device.AgentVersion,
                device.LastSeenAt)));
    }

    private static async Task<IResult> GetPendingConsentAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        var now = DateTimeOffset.UtcNow;
        var expired = await db.RemoteConsentRequests
            .Where(x => x.DeviceId == id && x.Status == "pending" && x.ExpiresAt <= now)
            .ToListAsync(cancellationToken);
        foreach (var item in expired)
        {
            item.Status = "expired";
            item.Version++;
        }
        if (expired.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        var request = await db.RemoteConsentRequests.AsNoTracking()
            .Where(x => x.DeviceId == id && x.Status == "pending" && x.ExpiresAt > now)
            .OrderBy(x => x.RequestedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<AgentRemoteConsentResponse?>(
            request is null ? null : ToResponse(request)));
    }

    private static async Task<IResult> DecideConsentAsync(
        string requestId,
        AgentRemoteConsentDecisionRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(requestId, "consent", out var id))
            return NotFound("Consent request not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var entity = await db.RemoteConsentRequests
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
            return NotFound("Consent request not found.");

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == entity.DeviceId, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        if (entity.Status != "pending")
            return Results.Problem(statusCode: 409, title: "Consent request is no longer pending");

        if (entity.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            entity.Status = "expired";
            entity.Version++;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Problem(statusCode: 409, title: "Consent request expired");
        }

        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision is not ("approved" or "declined"))
            return Validation("decision", "Decision must be approved or declined.");

        entity.Status = decision;
        entity.DecidedAt = DateTimeOffset.UtcNow;
        entity.DecidedByUserId = access.UserId;
        entity.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("consent", entity.Id);
        await ledger.AppendAuditAsync(
            "devices.remote.consent_decided",
            "remote_session",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                requestId = publicId,
                deviceId = OpaqueId.Format("dev", entity.DeviceId),
                decision,
                mode = entity.Mode
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "remote.consent.decided",
            "remote_session",
            publicId,
            new
            {
                requestId = publicId,
                deviceId = OpaqueId.Format("dev", entity.DeviceId),
                decision,
                decidedByActorType = "user"
            },
            CorrelationId(httpContext),
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        return Results.Ok(new ResourceResponse<AgentRemoteConsentResponse>(ToResponse(entity)));
    }

    private static async Task<IResult> CreateConsentRequestAsync(
        string deviceId,
        CreateRemoteConsentRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.remote", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");
        if (device.OwnerUserId is null)
            return Results.Problem(statusCode: 409, title: "Device has no current owner");

        var durationSeconds = Math.Clamp(request.DurationSeconds ?? 60, 15, 300);
        var now = DateTimeOffset.UtcNow;
        var entity = new RemoteConsentRequest
        {
            Id = Guid.NewGuid(),
            DeviceId = id,
            RequestedByUserId = access.UserId,
            OperatorName = string.IsNullOrWhiteSpace(request.OperatorName) ? "IT Support" : request.OperatorName.Trim(),
            OperatorRole = string.IsNullOrWhiteSpace(request.OperatorRole) ? null : request.OperatorRole.Trim(),
            Mode = string.IsNullOrWhiteSpace(request.Mode) ? "remote_control" : request.Mode.Trim().ToLowerInvariant(),
            MessageTh = string.IsNullOrWhiteSpace(request.MessageTh)
                ? "ฝ่าย IT ต้องการเชื่อมต่อเพื่อช่วยตรวจสอบหรือแก้ไขปัญหาบนเครื่องนี้"
                : request.MessageTh.Trim(),
            MessageEn = string.IsNullOrWhiteSpace(request.MessageEn)
                ? "IT Support would like to connect to this computer to troubleshoot or resolve an issue."
                : request.MessageEn.Trim(),
            Status = "pending",
            RequestedAt = now,
            ExpiresAt = now.AddSeconds(durationSeconds),
            Version = 1
        };
        db.RemoteConsentRequests.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("consent", entity.Id);
        await ledger.AppendAuditAsync(
            "devices.remote.consent_requested",
            "remote_session",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { deviceId, entity.Mode, entity.ExpiresAt },
            cancellationToken);

        return Results.Created(
            $"/api/v1/agent/remote-consent/requests/{publicId}",
            new ResourceResponse<AgentRemoteConsentResponse>(ToResponse(entity)));
    }


    private static async Task<IResult> GetPendingPromptAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        var now = DateTimeOffset.UtcNow;
        var expired = await db.AgentPrompts
            .Where(x => x.DeviceId == id && x.Status == "pending" && x.ExpiresAt <= now)
            .ToListAsync(cancellationToken);
        foreach (var item in expired)
        {
            item.Status = "expired";
            item.Version++;
        }
        if (expired.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        var prompt = await db.AgentPrompts.AsNoTracking()
            .Where(x => x.DeviceId == id && x.Status == "pending" && x.ExpiresAt > now)
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<AgentPromptResponse?>(
            prompt is null ? null : ToResponse(prompt)));
    }

    private static async Task<IResult> RespondToPromptAsync(
        string promptId,
        AgentPromptResponseRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(promptId, "prompt", out var id))
            return NotFound("Agent prompt not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "platform.workspace.access", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var prompt = await db.AgentPrompts.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (prompt is null)
            return NotFound("Agent prompt not found.");

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == prompt.DeviceId, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");
        if (device.OwnerUserId != access.UserId)
            return Forbidden("AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER");

        if (prompt.Status != "pending")
            return Results.Problem(statusCode: 409, title: "Agent prompt is no longer pending");

        if (prompt.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            prompt.Status = "expired";
            prompt.Version++;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Problem(statusCode: 409, title: "Agent prompt expired");
        }

        var responseKey = request.ResponseKey?.Trim().ToLowerInvariant();
        var allowed = prompt.PromptType == "notice"
            ? responseKey == "acknowledged"
            : responseKey is "accepted" or "declined";
        if (!allowed)
            return Validation(
                "responseKey",
                prompt.PromptType == "notice"
                    ? "Notice prompts require acknowledged."
                    : "Confirmation prompts require accepted or declined.");

        prompt.Status = "responded";
        prompt.ResponseKey = responseKey;
        prompt.RespondedAt = DateTimeOffset.UtcNow;
        prompt.RespondedByUserId = access.UserId;
        prompt.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("prompt", prompt.Id);
        await ledger.AppendAuditAsync(
            "devices.agent.prompt_responded",
            "agent_prompt",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                prompt.SourceModule,
                prompt.SourceReference,
                prompt.PromptType,
                responseKey,
                deviceId = OpaqueId.Format("dev", prompt.DeviceId)
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "agent.prompt.responded",
            "agent_prompt",
            publicId,
            new
            {
                promptId = publicId,
                prompt.SourceModule,
                prompt.SourceReference,
                prompt.PromptType,
                responseKey,
                deviceId = OpaqueId.Format("dev", prompt.DeviceId)
            },
            CorrelationId(httpContext),
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        return Results.Ok(new ResourceResponse<AgentPromptResponse>(ToResponse(prompt)));
    }

    private static async Task<IResult> CreateAgentPromptAsync(
        string deviceId,
        CreateAgentPromptRequest request,
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IAgentPromptService promptService,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var promptType = request.PromptType?.Trim().ToLowerInvariant();
        if (promptType is not ("notice" or "confirm"))
            return Validation("promptType", "Prompt type must be notice or confirm.");

        try
        {
            var result = await promptService.CreateAsync(
                new AgentPromptCreateRequest(
                    id,
                    access.UserId,
                    "devices",
                    request.SourceReference,
                    promptType,
                    request.TitleTh ?? string.Empty,
                    request.TitleEn ?? string.Empty,
                    request.MessageTh ?? string.Empty,
                    request.MessageEn ?? string.Empty,
                    CorrelationId(httpContext),
                    httpContext.TraceIdentifier,
                    DateTimeOffset.UtcNow.AddSeconds(Math.Clamp(request.DurationSeconds ?? 120, 30, 600))),
                cancellationToken);

            var publicId = OpaqueId.Format("prompt", result.PromptId);
            return Results.Created(
                $"/api/v1/agent/prompts/{publicId}",
                new ResourceResponse<CreateAgentPromptResponse>(
                    new(publicId, result.Status, result.ExpiresAt)));
        }
        catch (ArgumentException ex)
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]> { ["prompt"] = [ex.Message] });
        }
        catch (InvalidOperationException ex)
        {
            return Results.Problem(statusCode: 404, title: "Target device not found", detail: ex.Message);
        }
    }

    private static AgentPromptResponse ToResponse(AgentPrompt x) =>
        new(
            OpaqueId.Format("prompt", x.Id),
            OpaqueId.Format("dev", x.DeviceId),
            x.SourceModule,
            x.SourceReference,
            x.PromptType,
            x.TitleTh,
            x.TitleEn,
            x.MessageTh,
            x.MessageEn,
            x.Status,
            x.CreatedAt,
            x.ExpiresAt,
            x.RespondedAt,
            x.ResponseKey,
            x.Version);

    private static AgentRemoteConsentResponse ToResponse(RemoteConsentRequest x) =>
        new(
            OpaqueId.Format("consent", x.Id),
            OpaqueId.Format("dev", x.DeviceId),
            x.OperatorName,
            x.OperatorRole,
            x.Mode,
            x.MessageTh,
            x.MessageEn,
            x.Status,
            x.RequestedAt,
            x.ExpiresAt,
            x.DecidedAt,
            x.Version);

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers.TryGetValue("X-Correlation-ID", out var value)
            && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : context.TraceIdentifier;

    private static IResult Forbidden(string reason) =>
        Results.Problem(statusCode: 403, title: "Access denied", detail: reason);

    private static IResult NotFound(string detail) =>
        Results.Problem(statusCode: 404, title: "Not found", detail: detail);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record CreateAgentPromptRequest(
        string? SourceReference,
        string? PromptType,
        string? TitleTh,
        string? TitleEn,
        string? MessageTh,
        string? MessageEn,
        int? DurationSeconds);

    public sealed record CreateAgentPromptResponse(
        string Id,
        string Status,
        DateTimeOffset ExpiresAt);

    public sealed record AgentPromptResponseRequest(string? ResponseKey);

    public sealed record AgentPromptResponse(
        string Id,
        string DeviceId,
        string SourceModule,
        string? SourceReference,
        string PromptType,
        string TitleTh,
        string TitleEn,
        string MessageTh,
        string MessageEn,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset ExpiresAt,
        DateTimeOffset? RespondedAt,
        string? ResponseKey,
        long Version);

    public sealed record CreateRemoteConsentRequest(
        string? OperatorName,
        string? OperatorRole,
        string? Mode,
        string? MessageTh,
        string? MessageEn,
        int? DurationSeconds);

    public sealed record AgentRemoteConsentDecisionRequest(string? Decision);

    public sealed record AgentDeviceContextResponse(
        string Id,
        string Hostname,
        string Type,
        string ConnectivityState,
        string? OperatingSystem,
        string? IpAddress,
        string? Manufacturer,
        string? Model,
        string? AssetReference,
        string? AgentVersion,
        DateTimeOffset? LastSeenAt);

    public sealed record AgentRemoteConsentResponse(
        string Id,
        string DeviceId,
        string OperatorName,
        string? OperatorRole,
        string Mode,
        string MessageTh,
        string MessageEn,
        string Status,
        DateTimeOffset RequestedAt,
        DateTimeOffset ExpiresAt,
        DateTimeOffset? DecidedAt,
        long Version);
}
