using System.Security.Claims;

namespace INNO.One.Contracts.Search;

public sealed record GlobalSearchResult(
    string Type,
    string Id,
    string Title,
    string Subtitle,
    string Route);

public interface IGlobalSearchProvider
{
    string ProviderId { get; }

    Task<IReadOnlyList<GlobalSearchResult>> SearchAsync(
        ClaimsPrincipal principal,
        string query,
        int limit,
        CancellationToken cancellationToken = default);
}
