using System.Diagnostics;
using INNO.One.Contracts.Integrations;
using Microsoft.Extensions.Configuration;

namespace INNO.One.Integrations.Keycloak;

public sealed class KeycloakIntegrationHealthProvider(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory) : IIntegrationHealthProvider
{
    public string Id => "keycloak";

    public async Task<IntegrationHealthSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;
        var authority = configuration["Authentication:Authority"]?.Trim().TrimEnd('/');
        var configured = !string.IsNullOrWhiteSpace(authority);
        var endpoint = configured ? SanitizeEndpoint(authority!) : "Not configured";

        if (!configured)
        {
            return Snapshot(
                "not-configured",
                false,
                false,
                checkedAt,
                started,
                "Keycloak authority is not configured.",
                endpoint);
        }

        try
        {
            var client = httpClientFactory.CreateClient("inno-keycloak-health");
            using var response = await client.GetAsync(
                authority + "/.well-known/openid-configuration",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Snapshot(
                    "degraded",
                    true,
                    true,
                    checkedAt,
                    started,
                    "Keycloak discovery endpoint returned an unhealthy response.",
                    endpoint);
            }

            return Snapshot(
                "connected",
                true,
                true,
                checkedAt,
                started,
                "OIDC discovery endpoint is reachable.",
                endpoint);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Snapshot(
                "degraded",
                true,
                true,
                checkedAt,
                started,
                "Keycloak health check timed out.",
                endpoint);
        }
        catch
        {
            return Snapshot(
                "degraded",
                true,
                true,
                checkedAt,
                started,
                "Keycloak discovery endpoint is unavailable.",
                endpoint);
        }
    }

    private static IntegrationHealthSnapshot Snapshot(
        string status,
        bool enabled,
        bool canTest,
        DateTimeOffset checkedAt,
        long started,
        string message,
        string endpoint) =>
        new(
            "keycloak",
            "Keycloak",
            "Identity",
            "Keycloak",
            "platform",
            endpoint,
            status,
            enabled,
            enabled,
            canTest,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            message,
            ["authentication", "oidc", "health-check"]);

    private static string SanitizeEndpoint(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
            ? uri.GetLeftPart(UriPartial.Path)
            : "Configured endpoint";
}
