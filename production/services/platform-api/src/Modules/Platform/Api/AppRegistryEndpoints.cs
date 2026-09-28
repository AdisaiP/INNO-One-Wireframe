using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Application;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class AppRegistryEndpoints
{
    public static RouteGroupBuilder MapAppRegistryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/platform/apps", ListEffectiveAppsAsync)
            .WithName("platform.apps.list");

        api.MapGet("/admin/apps", ListAdminAppsAsync)
            .WithName("admin.apps.list");

        api.MapPatch("/admin/apps/{appId}", UpdateAvailabilityAsync)
            .WithName("admin.apps.update");

        return api;
    }
    private static async Task<IResult> ListEffectiveAppsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        ModuleManifestCatalog catalog,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.apps.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var states = await db.AppModules.AsNoTracking()
            .ToDictionaryAsync(x => x.AppId, StringComparer.Ordinal, cancellationToken);
        var enabled = states.Values
            .Where(x => x.Installed && x.Enabled)
            .Select(x => x.AppId)
            .ToHashSet(StringComparer.Ordinal);

        var items = new List<AppLauncherItemResponse>();
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
            if (!entryAccess.Allowed)
            {
                continue;
            }
            var navigation = new List<ModuleNavigationResponse>();
            foreach (var item in manifest.Navigation)
            {
                var itemAccess = await accessEvaluator.EvaluateAsync(
                    httpContext.User,
                    item.Permission,
                    cancellationToken);
                if (itemAccess.Allowed)
                {
                    navigation.Add(new ModuleNavigationResponse(
                        item.Id,
                        item.Label,
                        item.Route));
                }
            }

            items.Add(new AppLauncherItemResponse(
                manifest.Id,
                manifest.Name,
                manifest.Icon,
                manifest.Route,
                navigation));
        }

        return Results.Ok(new { items });
    }

    private static async Task<IResult> ListAdminAppsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        ModuleManifestCatalog catalog,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.apps.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var states = await db.AppModules.AsNoTracking()
            .ToDictionaryAsync(x => x.AppId, StringComparer.Ordinal, cancellationToken);
        var enabled = states.Values
            .Where(x => x.Installed && x.Enabled)
            .Select(x => x.AppId)
            .ToHashSet(StringComparer.Ordinal);
        var items = catalog.Modules.Select(manifest =>
        {
            states.TryGetValue(manifest.Id, out var state);
            return ToAdminResponse(manifest, state, enabled);
        }).ToArray();

        return Results.Ok(new
        {
            schemaVersion = catalog.SchemaVersion,
            items
        });
    }

    private static async Task<IResult> UpdateAvailabilityAsync(
        string appId,
        UpdateAppAvailabilityRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        ModuleManifestCatalog catalog,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.apps.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!catalog.TryGet(appId, out var manifest))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Application not found");
        }

        var state = await db.AppModules
            .SingleOrDefaultAsync(x => x.AppId == appId, cancellationToken);
        if (state is null || !state.Installed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Application is not installed",
                detail: "Install workflow is not available in this release.");
        }

        var stale = ValidateIfMatch(httpContext, state.Version);
        if (stale is not null)
        {
            return stale;
        }
        var enabledStates = await db.AppModules.AsNoTracking()
            .Where(x => x.Installed && x.Enabled)
            .ToDictionaryAsync(x => x.AppId, StringComparer.Ordinal, cancellationToken);
        var enabledIds = enabledStates.Keys.ToHashSet(StringComparer.Ordinal);

        if (request.Enabled)
        {
            var missingDependencies = manifest.Dependencies
                .Where(x => !string.Equals(x, "platform", StringComparison.Ordinal))
                .Where(x => !enabledIds.Contains(x))
                .ToArray();
            if (missingDependencies.Length > 0)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Module dependency unavailable",
                    detail: "Enable required modules first: "
                        + string.Join(", ", missingDependencies));
            }
        }
        else
        {
            var blockingDependents = catalog.Modules
                .Where(x => x.Dependencies.Contains(appId, StringComparer.Ordinal))
                .Where(x => enabledIds.Contains(x.Id))
                .Select(x => x.Name)
                .OrderBy(x => x)
                .ToArray();
            if (blockingDependents.Length > 0)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Module is required by enabled applications",
                    detail: "Disable dependent modules first: "
                        + string.Join(", ", blockingDependents));
            }
        }

        if (state.Enabled == request.Enabled)
        {
            httpContext.Response.Headers.ETag = Etag(state.Version);
            return Results.Ok(new ResourceResponse<AdminAppResponse>(
                ToAdminResponse(manifest, state, enabledIds)));
        }

        var previousEnabled = state.Enabled;
        state.Enabled = request.Enabled;
        state.Version++;
        state.UpdatedAt = DateTimeOffset.UtcNow;
        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "platform.app.availability_changed",
            "app_module",
            appId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                previousEnabled,
                enabled = state.Enabled,
                installed = state.Installed,
                state.Version
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        if (state.Enabled)
        {
            enabledIds.Add(appId);
        }
        else
        {
            enabledIds.Remove(appId);
        }

        httpContext.Response.Headers.ETag = Etag(state.Version);
        return Results.Ok(new ResourceResponse<AdminAppResponse>(
            ToAdminResponse(manifest, state, enabledIds)));
    }

    private static AdminAppResponse ToAdminResponse(
        ModuleManifest manifest,
        AppModule? state,
        IReadOnlySet<string> enabled)
    {
        var installed = state?.Installed ?? false;
        var isEnabled = installed && (state?.Enabled ?? false);
        var status = !installed
            ? "not-installed"
            : isEnabled ? "enabled" : "disabled";
        return new AdminAppResponse(
            manifest.Id,
            manifest.Name,
            manifest.Icon,
            manifest.Route,
            manifest.EntryPermission,
            status,
            installed,
            isEnabled,
            DependenciesAvailable(manifest, enabled),
            manifest.Dependencies,
            manifest.Permissions,
            manifest.Events,
            manifest.Capabilities,
            state?.UpdatedAt,
            state is null ? null : Etag(state.Version));
    }

    private static bool DependenciesAvailable(
        ModuleManifest manifest,
        IReadOnlySet<string> enabled) =>
        manifest.Dependencies.All(x =>
            string.Equals(x, "platform", StringComparison.Ordinal)
            || enabled.Contains(x));

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (!TryReadVersion(raw, out var expected)
            || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Application availability changed",
                detail: "Refresh Apps & Modules and retry the save.");
        }

        return null;
    }
    private static bool TryReadVersion(string raw, out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private sealed record UpdateAppAvailabilityRequest(bool Enabled);

    private sealed record ModuleNavigationResponse(
        string Id,
        string Label,
        string Route);

    private sealed record AppLauncherItemResponse(
        string Id,
        string Name,
        string Icon,
        string Route,
        IReadOnlyList<ModuleNavigationResponse> Navigation);
    private sealed record AdminAppResponse(
        string Id,
        string Name,
        string Icon,
        string Route,
        string EntryPermission,
        string Status,
        bool Installed,
        bool Enabled,
        bool DependenciesAvailable,
        IReadOnlyList<string> Dependencies,
        IReadOnlyList<string> Permissions,
        IReadOnlyList<string> Events,
        IReadOnlyList<string> Capabilities,
        DateTimeOffset? UpdatedAt,
        string? ETag);
}
