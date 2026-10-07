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

public static class DeviceEnrollmentEndpoints
{
    public static RouteGroupBuilder MapDeviceEnrollmentEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/devices/agent-enrollment-tokens", CreateTokenAsync)
            .WithName("devices.agentEnrollmentTokens.create");

        api.MapPost("/agent/enroll", EnrollAsync)
            .AllowAnonymous()
            .WithName("agent.enroll");

        api.MapGet("/agent/machine/context", GetMachineContextAsync)
            .AllowAnonymous()
            .WithName("agent.machine.context");

        api.MapGet("/devices/{deviceId}/ownership-assignment", GetOwnershipAssignmentAsync)
            .WithName("devices.ownershipAssignment.get");

        api.MapPost("/devices/{deviceId}/ownership-assignment/confirm", ConfirmOwnershipAsync)
            .WithName("devices.ownershipAssignment.confirm");

        api.MapPost("/devices/{deviceId}/ownership-assignment/reject", RejectOwnershipAsync)
            .WithName("devices.ownershipAssignment.reject");

        return api;
    }

    private static async Task<IResult> CreateTokenAsync(
        CreateEnrollmentTokenRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        Guid? groupId = null;
        if (!string.IsNullOrWhiteSpace(request.GroupId))
        {
            if (!OpaqueId.TryParse(request.GroupId, "grp", out var parsedGroupId))
                return Validation("groupId", "Invalid device group id.");
            if (!await db.DeviceGroups.AnyAsync(x => x.Id == parsedGroupId && x.Status == "active", cancellationToken))
                return NotFound("Device group not found.");
            groupId = parsedGroupId;
        }

        Guid? intendedOwnerUserId = null;
        DirectoryUserEntry? intendedOwner = null;
        if (!string.IsNullOrWhiteSpace(request.IntendedOwnerUserId))
        {
            if (!OpaqueId.TryParse(request.IntendedOwnerUserId, "user", out var parsedUserId))
                return Validation("intendedOwnerUserId", "Invalid user id.");

            var users = await directoryReader.ReadUsersAsync([parsedUserId], cancellationToken);
            if (!users.TryGetValue(parsedUserId, out intendedOwner) || intendedOwner.Status != "active")
                return NotFound("Intended owner not found.");
            intendedOwnerUserId = parsedUserId;
        }

        var token = DeviceMachineAuthenticator.GenerateToken("enr");
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddHours(Math.Clamp(request.ExpiresHours ?? 24, 1, 168));
        var entity = new DeviceEnrollmentToken
        {
            Id = Guid.NewGuid(),
            TokenHash = DeviceMachineAuthenticator.HashSecret(token),
            GroupId = groupId,
            IntendedOwnerUserId = intendedOwnerUserId,
            CreatedByUserId = access.UserId,
            Label = Normalize(request.Label, 200),
            Status = "active",
            ExpiresAt = expiresAt,
            CreatedAt = now
        };
        db.DeviceEnrollmentTokens.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("enroll", entity.Id);
        await ledger.AppendAuditAsync(
            "devices.agent_enrollment_token.created",
            "device_enrollment_token",
            publicId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                groupId = groupId is Guid gid ? OpaqueId.Format("grp", gid) : null,
                intendedOwnerUserId = intendedOwnerUserId is Guid uid ? OpaqueId.Format("user", uid) : null,
                expiresAt
            },
            cancellationToken);

        return Results.Created(
            $"/api/v1/devices/agent-enrollment-tokens/{publicId}",
            new ResourceResponse<CreateEnrollmentTokenResponse>(
                new(
                    publicId,
                    token,
                    expiresAt,
                    groupId is Guid resolvedGroupId ? OpaqueId.Format("grp", resolvedGroupId) : null,
                    intendedOwner is null
                        ? null
                        : new OwnershipUserResponse(
                            OpaqueId.Format("user", intendedOwner.Id),
                            intendedOwner.FullName,
                            intendedOwner.Email))));
    }

    private static async Task<IResult> EnrollAsync(
        AgentEnrollmentRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IPlatformDirectoryReader directoryReader,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return Validation("token", "Enrollment token is required.");
        if (string.IsNullOrWhiteSpace(request.Hostname))
            return Validation("hostname", "Hostname is required.");

        var now = DateTimeOffset.UtcNow;
        var tokenHash = DeviceMachineAuthenticator.HashSecret(request.Token.Trim());
        var token = await db.DeviceEnrollmentTokens
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (token is null || token.Status != "active" || token.ExpiresAt <= now || token.UsedAt is not null)
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Enrollment token is invalid or expired",
                extensions: new Dictionary<string, object?> { ["code"] = "ENROLLMENT_TOKEN_INVALID" });

        var hostname = request.Hostname.Trim();
        var device = await db.Devices
            .SingleOrDefaultAsync(x => x.Hostname.ToLower() == hostname.ToLower(), cancellationToken);
        if (device is null)
        {
            device = new Device
            {
                Id = Guid.NewGuid(),
                Hostname = hostname,
                DeviceType = Normalize(request.DeviceType, 32) ?? "desktop",
                ConnectivityState = "online",
                OperatingSystem = Normalize(request.OperatingSystem, 200),
                LoggedOnUser = Normalize(request.WindowsIdentity, 320),
                AgentVersion = Normalize(request.AgentVersion, 160),
                LastSeenAt = now,
                Version = 1,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Devices.Add(device);
        }
        else
        {
            device.DeviceType = Normalize(request.DeviceType, 32) ?? device.DeviceType;
            device.ConnectivityState = "online";
            device.OperatingSystem = Normalize(request.OperatingSystem, 200) ?? device.OperatingSystem;
            device.LoggedOnUser = Normalize(request.WindowsIdentity, 320) ?? device.LoggedOnUser;
            device.AgentVersion = Normalize(request.AgentVersion, 160) ?? device.AgentVersion;
            device.LastSeenAt = now;
            device.UpdatedAt = now;
            device.Version++;
        }

        if (token.GroupId is Guid groupId
            && !await db.DeviceGroupMembers.AnyAsync(
                x => x.GroupId == groupId && x.DeviceId == device.Id,
                cancellationToken))
        {
            db.DeviceGroupMembers.Add(new DeviceGroupMember
            {
                GroupId = groupId,
                DeviceId = device.Id,
                ResolvedAt = now
            });
        }

        var machineSecret = DeviceMachineAuthenticator.GenerateToken("dsec");
        var existingCredential = await db.DeviceAgentCredentials
            .SingleOrDefaultAsync(x => x.DeviceId == device.Id, cancellationToken);
        if (existingCredential is null)
        {
            existingCredential = new DeviceAgentCredential
            {
                Id = Guid.NewGuid(),
                DeviceId = device.Id,
                SecretHash = DeviceMachineAuthenticator.HashSecret(machineSecret),
                Status = "active",
                EnrolledAt = now,
                LastAuthenticatedAt = now,
                Version = 1
            };
            db.DeviceAgentCredentials.Add(existingCredential);
        }
        else
        {
            existingCredential.SecretHash = DeviceMachineAuthenticator.HashSecret(machineSecret);
            existingCredential.Status = "active";
            existingCredential.EnrolledAt = now;
            existingCredential.LastAuthenticatedAt = now;
            existingCredential.RevokedAt = null;
            existingCredential.Version++;
        }

        var candidate = await ResolveOwnerCandidateAsync(
            token.IntendedOwnerUserId,
            request.WindowsUpn,
            directoryReader,
            cancellationToken);
        var suggestion = await db.DeviceOwnershipSuggestions
            .SingleOrDefaultAsync(x => x.DeviceId == device.Id, cancellationToken);
        var matchReason = token.IntendedOwnerUserId.HasValue
            ? "deployment_assignment"
            : candidate is not null
                ? "windows_upn_exact"
                : "unmatched";

        if (suggestion is null)
        {
            suggestion = new DeviceOwnershipSuggestion
            {
                Id = Guid.NewGuid(),
                DeviceId = device.Id,
                CandidateUserId = device.OwnerUserId ?? candidate?.Id,
                DetectedIdentity = Normalize(request.WindowsIdentity, 320),
                DetectedUpn = Normalize(request.WindowsUpn, 320),
                MatchReason = device.OwnerUserId.HasValue ? "existing_owner" : matchReason,
                Status = device.OwnerUserId.HasValue
                    ? "confirmed"
                    : candidate is null
                        ? "unmatched"
                        : "pending",
                CreatedAt = now,
                Version = 1
            };
            db.DeviceOwnershipSuggestions.Add(suggestion);
        }
        else
        {
            suggestion.CandidateUserId = device.OwnerUserId ?? candidate?.Id;
            suggestion.DetectedIdentity = Normalize(request.WindowsIdentity, 320);
            suggestion.DetectedUpn = Normalize(request.WindowsUpn, 320);
            suggestion.MatchReason = device.OwnerUserId.HasValue ? "existing_owner" : matchReason;
            suggestion.Status = device.OwnerUserId.HasValue
                ? "confirmed"
                : candidate is null
                    ? "unmatched"
                    : "pending";
            suggestion.CreatedAt = now;
            suggestion.ConfirmedAt = device.OwnerUserId.HasValue ? suggestion.ConfirmedAt : null;
            suggestion.ConfirmedByUserId = device.OwnerUserId.HasValue ? suggestion.ConfirmedByUserId : null;
            suggestion.Version++;
        }

        token.Status = "used";
        token.UsedAt = now;
        token.UsedByDeviceId = device.Id;
        await db.SaveChangesAsync(cancellationToken);

        var deviceId = OpaqueId.Format("dev", device.Id);
        await ledger.AppendAuditAsync(
            "devices.agent.enrolled",
            "device",
            deviceId,
            deviceId,
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                tokenId = OpaqueId.Format("enroll", token.Id),
                groupId = token.GroupId is Guid gid ? OpaqueId.Format("grp", gid) : null,
                ownershipStatus = suggestion.Status,
                ownershipMatchReason = suggestion.MatchReason
            },
            cancellationToken,
            actorType: "agent");

        return Results.Ok(new ResourceResponse<AgentEnrollmentResponse>(
            new(
                deviceId,
                machineSecret,
                suggestion.Status,
                candidate is null
                    ? null
                    : new OwnershipUserResponse(
                        OpaqueId.Format("user", candidate.Id),
                        candidate.FullName,
                        candidate.Email))));
    }

    private static async Task<IResult> GetMachineContextAsync(
        HttpContext httpContext,
        DevicesDbContext db,
        IPlatformDirectoryReader directoryReader,
        DeviceMachineAuthenticator authenticator,
        CancellationToken cancellationToken)
    {
        var auth = await authenticator.AuthenticateAsync(
            httpContext, db, expectedDeviceId: null, cancellationToken);
        if (!auth.Success || auth.Device is null)
            return MachineUnauthorized(auth.FailureCode);

        var device = auth.Device;
        var suggestion = await db.DeviceOwnershipSuggestions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.DeviceId == device.Id, cancellationToken);

        var userIds = new HashSet<Guid>();
        if (device.OwnerUserId is Guid ownerId) userIds.Add(ownerId);
        if (suggestion?.CandidateUserId is Guid candidateId) userIds.Add(candidateId);
        var users = await directoryReader.ReadUsersAsync(userIds.ToArray(), cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<AgentMachineContextResponse>(
            new(
                OpaqueId.Format("dev", device.Id),
                device.Hostname,
                device.DeviceType,
                device.ConnectivityState,
                device.OperatingSystem,
                device.IpAddress,
                device.Manufacturer,
                device.Model,
                device.AgentVersion,
                device.LastSeenAt,
                device.OwnerUserId is Guid currentOwnerId && users.TryGetValue(currentOwnerId, out var owner)
                    ? new OwnershipUserResponse(OpaqueId.Format("user", owner.Id), owner.FullName, owner.Email)
                    : null,
                suggestion is null
                    ? null
                    : new OwnershipSuggestionResponse(
                        suggestion.Status,
                        suggestion.MatchReason,
                        suggestion.DetectedIdentity,
                        suggestion.DetectedUpn,
                        suggestion.CandidateUserId is Guid suggestedId && users.TryGetValue(suggestedId, out var suggested)
                            ? new OwnershipUserResponse(OpaqueId.Format("user", suggested.Id), suggested.FullName, suggested.Email)
                            : null))));
    }

    private static async Task<IResult> GetOwnershipAssignmentAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");

        var suggestion = await db.DeviceOwnershipSuggestions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.DeviceId == id, cancellationToken);

        var userIds = new HashSet<Guid>();
        if (device.OwnerUserId is Guid ownerId) userIds.Add(ownerId);
        if (suggestion?.CandidateUserId is Guid candidateId) userIds.Add(candidateId);
        var users = await directoryReader.ReadUsersAsync(userIds.ToArray(), cancellationToken);

        return Results.Ok(new ResourceResponse<DeviceOwnershipAssignmentResponse>(
            new(
                device.OwnerUserId is Guid currentOwnerId && users.TryGetValue(currentOwnerId, out var owner)
                    ? new OwnershipUserResponse(OpaqueId.Format("user", owner.Id), owner.FullName, owner.Email)
                    : null,
                suggestion is null
                    ? null
                    : new OwnershipSuggestionResponse(
                        suggestion.Status,
                        suggestion.MatchReason,
                        suggestion.DetectedIdentity,
                        suggestion.DetectedUpn,
                        suggestion.CandidateUserId is Guid suggestedId && users.TryGetValue(suggestedId, out var suggested)
                            ? new OwnershipUserResponse(OpaqueId.Format("user", suggested.Id), suggested.FullName, suggested.Email)
                            : null))));
    }

    private static async Task<IResult> ConfirmOwnershipAsync(
        string deviceId,
        ConfirmOwnershipRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound("Device not found.");

        var suggestion = await db.DeviceOwnershipSuggestions
            .SingleOrDefaultAsync(x => x.DeviceId == id, cancellationToken);

        Guid? candidateId = null;
        if (!string.IsNullOrWhiteSpace(request.UserId))
        {
            if (!OpaqueId.TryParse(request.UserId, "user", out var parsed))
                return Validation("userId", "Invalid user id.");
            candidateId = parsed;
        }
        else
        {
            candidateId = suggestion?.CandidateUserId;
        }

        if (candidateId is not Guid ownerId)
            return Validation("userId", "No ownership candidate is available.");

        var users = await directoryReader.ReadUsersAsync([ownerId], cancellationToken);
        if (!users.TryGetValue(ownerId, out var owner) || owner.Status != "active")
            return NotFound("User not found.");

        device.OwnerUserId = ownerId;
        device.OrganizationUnitId ??= owner.OrganizationUnitId;
        device.LocationId ??= owner.LocationId;
        device.UpdatedAt = DateTimeOffset.UtcNow;
        device.Version++;

        if (suggestion is null)
        {
            suggestion = new DeviceOwnershipSuggestion
            {
                Id = Guid.NewGuid(),
                DeviceId = id,
                CandidateUserId = ownerId,
                MatchReason = "manual_assignment",
                Status = "confirmed",
                CreatedAt = DateTimeOffset.UtcNow,
                ConfirmedAt = DateTimeOffset.UtcNow,
                ConfirmedByUserId = access.UserId,
                Version = 1
            };
            db.DeviceOwnershipSuggestions.Add(suggestion);
        }
        else
        {
            suggestion.CandidateUserId = ownerId;
            suggestion.Status = "confirmed";
            suggestion.ConfirmedAt = DateTimeOffset.UtcNow;
            suggestion.ConfirmedByUserId = access.UserId;
            suggestion.Version++;
        }

        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "devices.ownership.confirmed",
            "device",
            deviceId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                ownerUserId = OpaqueId.Format("user", ownerId),
                owner.FullName,
                owner.Email,
                suggestion.MatchReason
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "device.ownership.confirmed",
            "device",
            deviceId,
            new
            {
                deviceId,
                ownerUserId = OpaqueId.Format("user", ownerId),
                owner.FullName,
                owner.Email
            },
            CorrelationId(httpContext),
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        return Results.Ok(new ResourceResponse<OwnershipUserResponse>(
            new(OpaqueId.Format("user", owner.Id), owner.FullName, owner.Email)));
    }

    private static async Task<IResult> RejectOwnershipAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound("Device not found.");

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var suggestion = await db.DeviceOwnershipSuggestions
            .SingleOrDefaultAsync(x => x.DeviceId == id, cancellationToken);
        if (suggestion is null)
            return NotFound("Ownership suggestion not found.");

        suggestion.Status = "rejected";
        suggestion.ConfirmedAt = DateTimeOffset.UtcNow;
        suggestion.ConfirmedByUserId = access.UserId;
        suggestion.Version++;
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "devices.ownership.rejected",
            "device",
            deviceId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { suggestion.MatchReason, suggestion.DetectedIdentity, suggestion.DetectedUpn },
            cancellationToken);

        return Results.NoContent();
    }

    private static async Task<DirectoryUserEntry?> ResolveOwnerCandidateAsync(
        Guid? intendedOwnerUserId,
        string? windowsUpn,
        IPlatformDirectoryReader directoryReader,
        CancellationToken cancellationToken)
    {
        if (intendedOwnerUserId is Guid intendedId)
        {
            var users = await directoryReader.ReadUsersAsync([intendedId], cancellationToken);
            if (users.TryGetValue(intendedId, out var intended) && intended.Status == "active")
                return intended;
        }

        if (string.IsNullOrWhiteSpace(windowsUpn) || !windowsUpn.Contains('@'))
            return null;

        var upn = windowsUpn.Trim();
        var matches = await directoryReader.SearchUsersAsync(upn, null, 10, cancellationToken);
        return matches.FirstOrDefault(x =>
            string.Equals(x.Email, upn, StringComparison.OrdinalIgnoreCase));
    }

    private static string? Normalize(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult MachineUnauthorized(string? code) => Results.Problem(
        statusCode: StatusCodes.Status401Unauthorized,
        title: "Device authentication failed",
        detail: code ?? "DEVICE_CREDENTIAL_INVALID",
        extensions: new Dictionary<string, object?> { ["code"] = code });

    private static IResult NotFound(string title) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: title);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public sealed record CreateEnrollmentTokenRequest(
        string? GroupId,
        string? IntendedOwnerUserId,
        string? Label,
        int? ExpiresHours);

    public sealed record CreateEnrollmentTokenResponse(
        string Id,
        string Token,
        DateTimeOffset ExpiresAt,
        string? GroupId,
        OwnershipUserResponse? IntendedOwner);

    public sealed record AgentEnrollmentRequest(
        string Token,
        string Hostname,
        string? DeviceType,
        string? OperatingSystem,
        string? WindowsIdentity,
        string? WindowsUpn,
        string? AgentVersion);

    public sealed record AgentEnrollmentResponse(
        string DeviceId,
        string DeviceSecret,
        string OwnershipStatus,
        OwnershipUserResponse? SuggestedOwner);

    public sealed record OwnershipUserResponse(
        string Id,
        string FullName,
        string Email);

    public sealed record OwnershipSuggestionResponse(
        string Status,
        string MatchReason,
        string? DetectedIdentity,
        string? DetectedUpn,
        OwnershipUserResponse? Candidate);

    public sealed record AgentMachineContextResponse(
        string Id,
        string Hostname,
        string Type,
        string ConnectivityState,
        string? OperatingSystem,
        string? IpAddress,
        string? Manufacturer,
        string? Model,
        string? AgentVersion,
        DateTimeOffset? LastSeenAt,
        OwnershipUserResponse? Owner,
        OwnershipSuggestionResponse? OwnershipSuggestion);

    public sealed record DeviceOwnershipAssignmentResponse(
        OwnershipUserResponse? Owner,
        OwnershipSuggestionResponse? Suggestion);

    public sealed record ConfirmOwnershipRequest(string? UserId);
}
