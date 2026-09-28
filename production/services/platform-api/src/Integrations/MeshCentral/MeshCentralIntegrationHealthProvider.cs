using System.Diagnostics;
using INNO.One.Contracts.Integrations;
using Microsoft.Extensions.Options;

namespace INNO.One.Integrations.MeshCentral;

public sealed class MeshCentralIntegrationHealthProvider(
    IOptions<MeshCentralOptions> options,
    IRemoteDeviceEngine remoteDeviceEngine) : IIntegrationHealthProvider
{
    private readonly MeshCentralOptions _options = options.Value;

    public string Id => "meshcentral";

    public async Task<IntegrationHealthSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;
        var endpoint = SanitizeEndpoint(_options.BaseUrl);
        var configured = !string.IsNullOrWhiteSpace(_options.BaseUrl)
            && !string.IsNullOrWhiteSpace(_options.Username)
            && !string.IsNullOrWhiteSpace(_options.Password);

        if (!_options.Enabled)
        {
            return Snapshot(
                "disabled",
                false,
                configured,
                false,
                checkedAt,
                started,
                "MeshCentral integration is disabled.",
                endpoint);
        }

        if (!configured)
        {
            return Snapshot(
                "not-configured",
                true,
                false,
                false,
                checkedAt,
                started,
                "MeshCentral credentials are not configured.",
                endpoint);
        }

        try
        {
            var groups = await remoteDeviceEngine.ListGroupsAsync(cancellationToken);
            return Snapshot(
                "connected",
                true,
                true,
                true,
                checkedAt,
                started,
                $"Authenticated control connection is healthy. {groups.Count} device groups are visible.",
                endpoint);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Snapshot(
                "degraded",
                true,
                true,
                true,
                checkedAt,
                started,
                "MeshCentral health check timed out.",
                endpoint);
        }
        catch
        {
            return Snapshot(
                "degraded",
                true,
                true,
                true,
                checkedAt,
                started,
                "MeshCentral control connection is unavailable or rejected the request.",
                endpoint);
        }
    }

    private static IntegrationHealthSnapshot Snapshot(
        string status,
        bool enabled,
        bool configured,
        bool canTest,
        DateTimeOffset checkedAt,
        long started,
        string message,
        string endpoint) =>
        new(
            "meshcentral",
            "MeshCentral",
            "Remote Management",
            "MeshCentral",
            "devices",
            endpoint,
            status,
            enabled,
            configured,
            canTest,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            message,
            ["remote-device-management", "device-sync", "health-check"]);

    private static string SanitizeEndpoint(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
            ? uri.GetLeftPart(UriPartial.Authority)
            : string.IsNullOrWhiteSpace(value) ? "Not configured" : "Configured endpoint";
}
