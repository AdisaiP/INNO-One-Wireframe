using System.Diagnostics;
using System.Text.Json;
using INNO.One.Contracts.Security;
using Microsoft.Extensions.Configuration;

namespace INNO.One.Integrations.Keycloak;

public sealed class KeycloakSecurityPostureProvider(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) : ISecurityPostureProvider
{
    public string Id => "identity";

    public async Task<SecurityPostureSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;
        var controls = new List<SecurityControlSnapshot>();

        var authority = configuration["Authentication:Authority"]?.Trim().TrimEnd('/');
        var audience = configuration["Authentication:Audience"]?.Trim();
        var requireHttpsMetadata = configuration.GetValue<bool>("Authentication:RequireHttpsMetadata");

        var authorityUri = Uri.TryCreate(authority, UriKind.Absolute, out var parsedAuthority)
            ? parsedAuthority
            : null;

        controls.Add(new SecurityControlSnapshot(
            "identity.authority.transport",
            "Identity authority transport",
            authorityUri?.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) == true
                ? "healthy"
                : "attention",
            authorityUri?.Scheme.ToUpperInvariant() ?? "Not configured",
            authorityUri is null
                ? "OIDC authority is missing or invalid."
                : authorityUri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)
                    ? "The configured identity authority uses HTTPS."
                    : "The configured identity authority does not use HTTPS."));

        controls.Add(new SecurityControlSnapshot(
            "identity.metadata.https",
            "HTTPS metadata validation",
            requireHttpsMetadata ? "healthy" : "attention",
            requireHttpsMetadata ? "Required" : "Not required",
            requireHttpsMetadata
                ? "OIDC metadata must be retrieved over HTTPS."
                : "HTTPS metadata validation is disabled by runtime configuration."));

        controls.Add(new SecurityControlSnapshot(
            "identity.api.audience",
            "API audience",
            string.IsNullOrWhiteSpace(audience) ? "attention" : "healthy",
            string.IsNullOrWhiteSpace(audience) ? "Missing" : "Configured",
            string.IsNullOrWhiteSpace(audience)
                ? "No API audience is configured for bearer-token validation."
                : "A bearer-token audience is configured."));

        if (authorityUri is null)
        {
            controls.Add(new SecurityControlSnapshot(
                "identity.discovery",
                "OIDC discovery",
                "unavailable",
                "Unavailable",
                "Discovery cannot be checked until the authority is configured."));

            return Snapshot(
                controls,
                checkedAt,
                started,
                "Identity security posture cannot be fully evaluated because the OIDC authority is unavailable.");
        }

        try
        {
            var client = httpClientFactory.CreateClient("inno-keycloak-health");
            using var response = await client.GetAsync(
                authority + "/.well-known/openid-configuration",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                controls.Add(new SecurityControlSnapshot(
                    "identity.discovery",
                    "OIDC discovery",
                    "unavailable",
                    $"HTTP {(int)response.StatusCode}",
                    "The identity discovery document did not return a successful response."));

                return Snapshot(
                    controls,
                    checkedAt,
                    started,
                    "Identity discovery is unavailable; protocol capabilities could not be verified.");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;

            var issuer = root.TryGetProperty("issuer", out var issuerValue)
                ? issuerValue.GetString()
                : null;
            var issuerMatches = !string.IsNullOrWhiteSpace(issuer)
                && string.Equals(
                    issuer!.TrimEnd('/'),
                    authority,
                    StringComparison.OrdinalIgnoreCase);

            controls.Add(new SecurityControlSnapshot(
                "identity.discovery",
                "OIDC discovery",
                "healthy",
                "Reachable",
                "The OpenID Connect discovery document is reachable."));

            controls.Add(new SecurityControlSnapshot(
                "identity.issuer.match",
                "OIDC issuer match",
                issuerMatches ? "healthy" : "attention",
                issuerMatches ? "Matches authority" : "Mismatch",
                issuerMatches
                    ? "The advertised issuer matches the configured authority."
                    : "The advertised issuer does not match the configured authority."));

            var grantTypes = StringArray(root, "grant_types_supported");
            var authorizationCode = grantTypes.Contains(
                "authorization_code",
                StringComparer.OrdinalIgnoreCase);
            controls.Add(new SecurityControlSnapshot(
                "identity.authorization-code",
                "Authorization Code flow",
                authorizationCode ? "healthy" : "attention",
                authorizationCode ? "Supported" : "Not advertised",
                authorizationCode
                    ? "The identity provider advertises Authorization Code flow support."
                    : "Authorization Code flow is not advertised by the discovery document."));

            var challengeMethods = StringArray(root, "code_challenge_methods_supported");
            var s256 = challengeMethods.Contains("S256", StringComparer.OrdinalIgnoreCase);
            controls.Add(new SecurityControlSnapshot(
                "identity.pkce.s256",
                "PKCE S256",
                s256 ? "healthy" : "attention",
                s256 ? "Supported" : "Not advertised",
                s256
                    ? "The identity provider advertises PKCE S256 support."
                    : "PKCE S256 is not advertised by the discovery document."));
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            controls.Add(new SecurityControlSnapshot(
                "identity.discovery",
                "OIDC discovery",
                "unavailable",
                "Timed out",
                "The identity discovery request timed out."));
        }
        catch
        {
            controls.Add(new SecurityControlSnapshot(
                "identity.discovery",
                "OIDC discovery",
                "unavailable",
                "Unavailable",
                "The identity discovery document could not be retrieved."));
        }

        return Snapshot(
            controls,
            checkedAt,
            started,
            "Identity posture is derived from runtime authentication configuration and the public OIDC discovery document.");
    }

    private static SecurityPostureSnapshot Snapshot(
        IReadOnlyList<SecurityControlSnapshot> controls,
        DateTimeOffset checkedAt,
        long started,
        string message)
    {
        var status = controls.Any(x => x.Status is "attention" or "unavailable")
            ? controls.Any(x => x.Status == "unavailable")
                ? "attention"
                : "attention"
            : "healthy";

        return new SecurityPostureSnapshot(
            "identity",
            "Identity & Authentication",
            "Authentication",
            "platform",
            status,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            message,
            controls);
    }

    private static IReadOnlyList<string> StringArray(
        JsonElement root,
        string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var value)
            || value.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return value
            .EnumerateArray()
            .Where(x => x.ValueKind == JsonValueKind.String)
            .Select(x => x.GetString())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Cast<string>()
            .ToArray();
    }
}
