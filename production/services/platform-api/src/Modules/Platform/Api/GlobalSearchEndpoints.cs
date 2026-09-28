using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Search;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace INNO.One.Modules.Platform.Api;

public static class GlobalSearchEndpoints
{
    public static RouteGroupBuilder MapGlobalSearchEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/search", SearchAsync)
            .WithName("platform.search");

        return api;
    }

    private static async Task<IResult> SearchAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IGlobalSearchProvider> providers,
        string? q,
        int limit = 30,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "platform.search.use",
            cancellationToken);

        if (!access.Allowed)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Access denied",
                detail: access.Reason);
        }

        var query = q?.Trim();
        if (string.IsNullOrWhiteSpace(query))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Search query is required",
                detail: "Provide a non-empty q value.");
        }

        limit = Math.Clamp(limit, 1, 50);
        var providerArray = providers.ToArray();
        var collected = new List<GlobalSearchResult>();

        foreach (var provider in providerArray)
        {
            var providerResults = await provider.SearchAsync(
                httpContext.User,
                query,
                Math.Min(limit, 20),
                cancellationToken);

            collected.AddRange(providerResults);
        }

        var items = collected
            .OrderBy(result => MatchRank(result.Title, query))
            .ThenBy(result => TypeRank(result.Type))
            .ThenBy(result => result.Title, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToArray();

        return Results.Ok(new GlobalSearchResponse(
            query,
            items,
            items.Length,
            providerArray.Length));
    }

    private static int MatchRank(string title, string query)
    {
        if (title.Equals(query, StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (title.StartsWith(query, StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        return 2;
    }

    private static int TypeRank(string type) =>
        type switch
        {
            "device" => 0,
            "asset" => 1,
            "ticket" => 2,
            _ => 9
        };

    private sealed record GlobalSearchResponse(
        string Query,
        IReadOnlyList<GlobalSearchResult> Items,
        int TotalItems,
        int ProviderCount);
}
