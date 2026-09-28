using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Platform.Application;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class WorkspaceEndpoints
{
    public static RouteGroupBuilder MapWorkspaceEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/platform/workspace", GetWorkspaceAsync)
            .WithName("platform.workspace.get");
        api.MapGet("/platform/workspace/continue", GetContinueAsync)
            .WithName("platform.workspace.continue");
        api.MapGet("/platform/workspace/attention", GetAttentionAsync)
            .WithName("platform.workspace.attention");
        api.MapGet("/platform/activity", GetActivityAsync)
            .WithName("platform.activity.get");
        return api;
    }
    private static async Task<IResult> GetWorkspaceAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        ModuleManifestCatalog catalog,
        IEnumerable<IWorkspaceAttentionProvider> attentionProviders,
        IEnumerable<IWorkspaceResourceVisibilityProvider> visibilityProviders,
        CancellationToken cancellationToken)
    {
        var access = await RequireWorkspaceAsync(httpContext, accessEvaluator, cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var profile = await db.UserProfiles.AsNoTracking()
            .SingleAsync(x => x.Id == access.UserId, cancellationToken);
        var apps = await GetEffectiveAppsAsync(
            httpContext,
            db,
            accessEvaluator,
            catalog,
            cancellationToken);
        var recent = await GetVisibleActivityAsync(
            httpContext,
            db,
            visibilityProviders,
            access.UserId,
            12,
            cancellationToken);
        var continueItems = recent
            .GroupBy(x => new { x.ResourceType, x.ResourceId })
            .Select(x => x.First())
            .Take(5)
            .ToArray();
        var attention = await CollectAttentionAsync(
            httpContext,
            attentionProviders,
            cancellationToken);

        return Results.Ok(new WorkspaceHomeResponse(
            profile.FullName,
            apps,
            continueItems,
            attention.Items,
            recent.Take(5).ToArray(),
            attention.Items.Sum(x => x.Count),
            attention.Failures,
            DateTimeOffset.UtcNow));
    }
    private static async Task<IResult> GetContinueAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IWorkspaceResourceVisibilityProvider> visibilityProviders,
        CancellationToken cancellationToken)
    {
        var access = await RequireWorkspaceAsync(httpContext, accessEvaluator, cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var items = await GetVisibleActivityAsync(
            httpContext,
            db,
            visibilityProviders,
            access.UserId,
            50,
            cancellationToken);
        var distinct = items
            .GroupBy(x => new { x.ResourceType, x.ResourceId })
            .Select(x => x.First())
            .Take(25)
            .ToArray();

        return Results.Ok(new WorkspaceContinueResponse(distinct));
    }
    private static async Task<IResult> GetAttentionAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IWorkspaceAttentionProvider> attentionProviders,
        CancellationToken cancellationToken)
    {
        var access = await RequireWorkspaceAsync(httpContext, accessEvaluator, cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var attention = await CollectAttentionAsync(
            httpContext,
            attentionProviders,
            cancellationToken);
        return Results.Ok(new WorkspaceAttentionResponse(
            attention.Items,
            attention.Items.Sum(x => x.Count),
            attention.Failures));
    }

    private static async Task<IResult> GetActivityAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IWorkspaceResourceVisibilityProvider> visibilityProviders,
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var access = await RequireWorkspaceAsync(httpContext, accessEvaluator, cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        limit = Math.Clamp(limit, 1, 100);
        var items = await GetVisibleActivityAsync(
            httpContext,
            db,
            visibilityProviders,
            access.UserId,
            limit,
            cancellationToken);
        return Results.Ok(new WorkspaceActivityResponse(items));
    }

    private static async Task<EffectiveAccess> RequireWorkspaceAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken) =>
        await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.workspace.access",
            cancellationToken);
    private static async Task<IReadOnlyList<WorkspaceAppResponse>> GetEffectiveAppsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        ModuleManifestCatalog catalog,
        CancellationToken cancellationToken)
    {
        var appAccess = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.apps.view",
            cancellationToken);
        if (!appAccess.Allowed)
        {
            return Array.Empty<WorkspaceAppResponse>();
        }

        var states = await db.AppModules.AsNoTracking()
            .ToDictionaryAsync(x => x.AppId, StringComparer.Ordinal, cancellationToken);
        var enabled = states.Values
            .Where(x => x.Installed && x.Enabled)
            .Select(x => x.AppId)
            .ToHashSet(StringComparer.Ordinal);
        var items = new List<WorkspaceAppResponse>();
        foreach (var manifest in catalog.Modules.Where(x => x.Launcher))
        {
            if (!states.TryGetValue(manifest.Id, out var state)
                || !state.Installed
                || !state.Enabled
                || !DependenciesAvailable(manifest, enabled))
            {
                continue;
            }

            var entryAccess = await accessEvaluator.EvaluateAsync(
                httpContext.User,
                manifest.EntryPermission,
                cancellationToken);
            if (entryAccess.Allowed)
            {
                items.Add(new WorkspaceAppResponse(
                    manifest.Id,
                    manifest.Name,
                    manifest.Icon,
                    manifest.Route));
            }
        }

        return items.Take(5).ToArray();
    }
    private static async Task<IReadOnlyList<WorkspaceActivityItemResponse>> GetVisibleActivityAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IEnumerable<IWorkspaceResourceVisibilityProvider> visibilityProviders,
        Guid userId,
        int limit,
        CancellationToken cancellationToken)
    {
        var rows = await db.ActivityItems.AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.OccurredAt)
            .Take(Math.Max(limit * 3, 25))
            .ToListAsync(cancellationToken);

        var providers = visibilityProviders
            .GroupBy(x => x.ProviderId, StringComparer.Ordinal)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.Ordinal);
        var visible = new List<WorkspaceActivityItemResponse>(limit);

        foreach (var row in rows)
        {
            if (!providers.TryGetValue(row.SourceModule, out var provider))
            {
                continue;
            }

            try
            {
                if (await provider.CanAccessAsync(
                    httpContext.User,
                    row.ResourceType,
                    row.ResourceId,
                    cancellationToken))
                {
                    visible.Add(ToActivityResponse(row));
                    if (visible.Count >= limit)
                    {
                        break;
                    }
                }
            }
            catch
            {
                // Read models fail closed: unavailable providers do not expose stale resources.
            }
        }

        return visible;
    }

    private static async Task<AttentionCollection> CollectAttentionAsync(
        HttpContext httpContext,
        IEnumerable<IWorkspaceAttentionProvider> providers,
        CancellationToken cancellationToken)
    {
        var items = new List<WorkspaceAttentionItem>();
        var failures = new List<string>();

        foreach (var provider in providers.OrderBy(x => x.ProviderId, StringComparer.Ordinal))
        {
            try
            {
                items.AddRange(await provider.GetAttentionAsync(
                    httpContext.User,
                    cancellationToken));
            }
            catch
            {
                failures.Add(provider.ProviderId);
            }
        }

        return new AttentionCollection(
            items
                .OrderBy(x => SeverityRank(x.Severity))
                .ThenByDescending(x => x.Count)
                .ThenBy(x => x.Module, StringComparer.Ordinal)
                .ToArray(),
            failures);
    }
    private static WorkspaceActivityItemResponse ToActivityResponse(PlatformActivityItem item) =>
        new(
            item.SourceModule,
            item.ResourceType,
            item.ResourceId,
            item.Title,
            item.Activity,
            item.DestinationPath,
            item.OccurredAt);

    private static int SeverityRank(string severity) =>
        severity switch
        {
            "danger" => 0,
            "warning" => 1,
            "info" => 2,
            _ => 3
        };

    private static bool DependenciesAvailable(
        ModuleManifest manifest,
        IReadOnlySet<string> enabled) =>
        manifest.Dependencies.All(x =>
            string.Equals(x, "platform", StringComparison.Ordinal)
            || enabled.Contains(x));
    private static IResult Forbidden(string reason) =>
        Results.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "Access denied",
            detail: reason);

    private sealed record WorkspaceAppResponse(
        string Id,
        string Name,
        string Icon,
        string Route);

    private sealed record WorkspaceActivityItemResponse(
        string SourceModule,
        string ResourceType,
        string ResourceId,
        string Title,
        string Activity,
        string DestinationPath,
        DateTimeOffset OccurredAt);

    private sealed record WorkspaceHomeResponse(
        string FullName,
        IReadOnlyList<WorkspaceAppResponse> Apps,
        IReadOnlyList<WorkspaceActivityItemResponse> ContinueItems,
        IReadOnlyList<WorkspaceAttentionItem> AttentionItems,
        IReadOnlyList<WorkspaceActivityItemResponse> RecentItems,
        int AttentionTotal,
        IReadOnlyList<string> PartialFailures,
        DateTimeOffset GeneratedAt);

    private sealed record WorkspaceContinueResponse(
        IReadOnlyList<WorkspaceActivityItemResponse> Items);

    private sealed record WorkspaceAttentionResponse(
        IReadOnlyList<WorkspaceAttentionItem> Items,
        int TotalCount,
        IReadOnlyList<string> PartialFailures);

    private sealed record WorkspaceActivityResponse(
        IReadOnlyList<WorkspaceActivityItemResponse> Items);

    private sealed record AttentionCollection(
        IReadOnlyList<WorkspaceAttentionItem> Items,
        IReadOnlyList<string> Failures);
}
