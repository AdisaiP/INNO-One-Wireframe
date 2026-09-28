using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Authorization;
using INNO.One.Modules.Platform.Application;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class PlatformNotificationEndpoints
{
    public static RouteGroupBuilder MapPlatformNotificationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/platform/notifications", GetNotificationsAsync)
            .WithName("platform.notifications.get");

        api.MapPatch("/platform/notifications/{notificationId}", PatchNotificationAsync)
            .WithName("platform.notifications.patch");

        api.MapPost("/platform/notifications/mark-all-read", MarkAllReadAsync)
            .WithName("platform.notifications.mark-all-read");

        return api;
    }

    private static async Task<IResult> GetNotificationsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        int page = 1,
        int pageSize = 25,
        string? state = null,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.notifications.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Notifications.AsNoTracking()
            .Where(x => x.UserId == access.UserId);

        if (string.Equals(state, "unread", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.ReadAt == null);
        }
        else if (!string.IsNullOrWhiteSpace(state)
            && !string.Equals(state, "all", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid notification state",
                detail: "State must be all or unread.");
        }

        var totalItems = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize));
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new NotificationItemResponse(
                OpaqueId.Format("notification", x.Id),
                x.SourceModule,
                x.NotificationType,
                x.Title,
                x.Message,
                x.DestinationPath,
                x.IsImportant,
                x.ReadAt != null,
                x.ReadAt,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        var allForUser = db.Notifications.AsNoTracking()
            .Where(x => x.UserId == access.UserId);
        var unreadCount = await allForUser.CountAsync(x => x.ReadAt == null, cancellationToken);
        var importantCount = await allForUser.CountAsync(x => x.IsImportant, cancellationToken);
        var allCount = await allForUser.CountAsync(cancellationToken);

        return Results.Ok(new NotificationListResponse(
            items,
            page,
            pageSize,
            totalItems,
            totalPages,
            unreadCount,
            importantCount,
            allCount));
    }

    private static async Task<IResult> PatchNotificationAsync(
        string notificationId,
        NotificationPatchRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.notifications.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!OpaqueId.TryParse(notificationId, "notification", out var id))
        {
            return Results.NotFound();
        }

        var notification = await db.Notifications.SingleOrDefaultAsync(
            x => x.Id == id && x.UserId == access.UserId,
            cancellationToken);

        if (notification is null)
        {
            return Results.NotFound();
        }

        notification.ReadAt = request.IsRead ? DateTimeOffset.UtcNow : null;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(notification));
    }

    private static async Task<IResult> MarkAllReadAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.notifications.view",
            cancellationToken);

        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var now = DateTimeOffset.UtcNow;
        var updated = await db.Notifications
            .Where(x => x.UserId == access.UserId && x.ReadAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(x => x.ReadAt, now),
                cancellationToken);

        return Results.Ok(new MarkAllReadResponse(updated, now));
    }

    private static NotificationItemResponse ToResponse(PlatformNotification notification) =>
        new(
            OpaqueId.Format("notification", notification.Id),
            notification.SourceModule,
            notification.NotificationType,
            notification.Title,
            notification.Message,
            notification.DestinationPath,
            notification.IsImportant,
            notification.ReadAt != null,
            notification.ReadAt,
            notification.CreatedAt);

    private static IResult Forbidden(string reason) =>
        Results.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "Access denied",
            detail: reason);

    private sealed record NotificationPatchRequest(bool IsRead);

    private sealed record NotificationItemResponse(
        string Id,
        string SourceModule,
        string NotificationType,
        string Title,
        string Message,
        string DestinationPath,
        bool IsImportant,
        bool IsRead,
        DateTimeOffset? ReadAt,
        DateTimeOffset CreatedAt);

    private sealed record NotificationListResponse(
        IReadOnlyList<NotificationItemResponse> Items,
        int Page,
        int PageSize,
        int TotalItems,
        int TotalPages,
        int UnreadCount,
        int ImportantCount,
        int AllCount);

    private sealed record MarkAllReadResponse(int UpdatedCount, DateTimeOffset ReadAt);
}
