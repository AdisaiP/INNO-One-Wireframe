using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Operations;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class OperationEndpoints
{
    private static readonly HashSet<string> PublicStates =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "queued",
            "running",
            "succeeded",
            "failed",
            "partial"
        };

    public static RouteGroupBuilder MapOperationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/operations/{operationId}", GetOperationAsync)
            .WithName("platform.operations.get");

        return api;
    }

    private static async Task<IResult> GetOperationAsync(
        string operationId,
        HttpContext httpContext,
        PlatformDbContext platformDb,
        IOperationReader operationReader,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(operationId, "op", out var id))
        {
            return NotFound();
        }

        var subject = httpContext.User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Results.Unauthorized();
        }

        var caller = await platformDb.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.KeycloakSubject == subject,
                cancellationToken);

        if (caller is null
            || !string.Equals(caller.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return Forbidden("PROFILE_NOT_ACTIVE");
        }

        var operation = await operationReader.ReadAsync(id, cancellationToken);
        if (operation is null)
        {
            return NotFound();
        }

        var callerId = OpaqueId.Format("user", caller.Id);
        if (!string.Equals(operation.RequestedByActorType, "user", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(operation.RequestedByActorId, callerId, StringComparison.Ordinal))
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(operation.RequiredPermission))
        {
            return Forbidden("OPERATION_AUTHORIZATION_CONTEXT_INVALID");
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            operation.RequiredPermission,
            cancellationToken);

        if (!access.Allowed || access.UserId != caller.Id)
        {
            return Forbidden(access.Reason);
        }

        if (!PublicStates.Contains(operation.Status))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Operation state unavailable",
                detail: "The stored operation state cannot be represented by the public contract.");
        }

        var statusUrl = $"/api/v1/operations/{operationId}";
        return Results.Ok(new ResourceResponse<OperationResourceResponse>(
            new OperationResourceResponse(
                operationId,
                operation.OperationType,
                operation.OriginModule,
                operation.Status.ToLowerInvariant(),
                operation.Progress,
                operation.ErrorCode,
                statusUrl,
                operation.CreatedAt,
                operation.UpdatedAt,
                operation.ExpiresAt)));
    }

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Operation not found",
        detail: "The requested operation was not found.");

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private sealed record OperationResourceResponse(
        string OperationId,
        string OperationType,
        string OriginModule,
        string Status,
        int Progress,
        string? ErrorCode,
        string StatusUrl,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        DateTimeOffset? ExpiresAt);
}
