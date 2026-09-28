using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace INNO.One.Modules.Platform.Api;

public static class AdminSecurityEndpoints
{
    public static RouteGroupBuilder MapAdminSecurityEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/admin/security", GetSecurityPostureAsync)
            .WithName("admin.security.get");
        return api;
    }

    private static async Task<IResult> GetSecurityPostureAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IEnumerable<ISecurityPostureProvider> providers,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.security.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var items = new List<SecurityPostureSnapshot>();
        foreach (var provider in providers.OrderBy(x => x.Id, StringComparer.Ordinal))
        {
            items.Add(await provider.CheckAsync(cancellationToken));
        }

        var controls = items.SelectMany(x => x.Controls).ToArray();

        return Results.Ok(new
        {
            configurationMode = "deployment-managed",
            mutablePolicies = false,
            checkedAt = items.Count == 0
                ? DateTimeOffset.UtcNow
                : items.Max(x => x.CheckedAt),
            summary = new
            {
                providers = items.Count,
                healthy = controls.Count(x => x.Status == "healthy"),
                attention = controls.Count(x => x.Status == "attention"),
                unavailable = controls.Count(x => x.Status == "unavailable"),
                informational = controls.Count(x => x.Status == "informational")
            },
            items = items
                .OrderBy(x => x.Category, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .ToArray()
        });
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);
}
