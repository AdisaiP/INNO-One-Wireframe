using System.Diagnostics;
using INNO.One.Contracts.Security;
using Microsoft.Extensions.Options;

namespace INNO.One.Integrations.MeshCentral;

public sealed class MeshCentralSecurityPostureProvider(
    IOptions<MeshCentralOptions> options) : ISecurityPostureProvider
{
    private readonly MeshCentralOptions _options = options.Value;

    public string Id => "remote-management";

    public Task<SecurityPostureSnapshot> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var started = Stopwatch.GetTimestamp();
        var checkedAt = DateTimeOffset.UtcNow;
        var controls = new List<SecurityControlSnapshot>();

        var endpointUri = Uri.TryCreate(_options.BaseUrl, UriKind.Absolute, out var parsed)
            ? parsed
            : null;
        var configured = !string.IsNullOrWhiteSpace(_options.BaseUrl)
            && !string.IsNullOrWhiteSpace(_options.Username)
            && !string.IsNullOrWhiteSpace(_options.Password);

        controls.Add(new SecurityControlSnapshot(
            "remote-management.enabled",
            "Remote management integration",
            "informational",
            _options.Enabled ? "Enabled" : "Disabled",
            _options.Enabled
                ? "Remote management is enabled in runtime configuration."
                : "Remote management is disabled; transport controls are not active."));

        if (!_options.Enabled)
        {
            controls.Add(new SecurityControlSnapshot(
                "remote-management.credentials",
                "Control credentials",
                "informational",
                configured ? "Configured" : "Not configured",
                "Credential values are never returned by the Security API."));

            controls.Add(new SecurityControlSnapshot(
                "remote-management.tls-validation",
                "TLS certificate validation",
                "informational",
                _options.AllowInvalidTls ? "Override configured" : "Default validation",
                "The integration is disabled, so this setting is not currently exercised."));

            return Task.FromResult(Snapshot(
                "informational",
                controls,
                checkedAt,
                started,
                "Remote management is disabled by runtime configuration."));
        }

        var secureTransport = endpointUri?.Scheme.Equals(
            "wss",
            StringComparison.OrdinalIgnoreCase) == true;

        controls.Add(new SecurityControlSnapshot(
            "remote-management.transport",
            "Control channel transport",
            secureTransport ? "healthy" : "attention",
            endpointUri?.Scheme.ToUpperInvariant() ?? "Not configured",
            secureTransport
                ? "The remote management control endpoint uses WSS."
                : "The remote management control endpoint is missing or does not use WSS."));

        controls.Add(new SecurityControlSnapshot(
            "remote-management.tls-validation",
            "TLS certificate validation",
            _options.AllowInvalidTls ? "attention" : "healthy",
            _options.AllowInvalidTls ? "Invalid certificates allowed" : "Validation enforced",
            _options.AllowInvalidTls
                ? "Runtime configuration allows invalid TLS certificates for the remote management connection."
                : "Invalid TLS certificates are rejected by the remote management connection."));

        controls.Add(new SecurityControlSnapshot(
            "remote-management.credentials",
            "Control credentials",
            configured ? "healthy" : "attention",
            configured ? "Configured" : "Incomplete",
            configured
                ? "Remote management credentials are configured; values remain server-side."
                : "Remote management is enabled but its connection credentials are incomplete."));

        var status = controls.Any(x => x.Status == "attention")
            ? "attention"
            : "healthy";

        return Task.FromResult(Snapshot(
            status,
            controls,
            checkedAt,
            started,
            "Remote management posture is derived from sanitized runtime transport and certificate-validation settings."));
    }

    private static SecurityPostureSnapshot Snapshot(
        string status,
        IReadOnlyList<SecurityControlSnapshot> controls,
        DateTimeOffset checkedAt,
        long started,
        string message) =>
        new(
            "remote-management",
            "Remote Management Transport",
            "Remote Access",
            "devices",
            status,
            checkedAt,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            message,
            controls);
}
