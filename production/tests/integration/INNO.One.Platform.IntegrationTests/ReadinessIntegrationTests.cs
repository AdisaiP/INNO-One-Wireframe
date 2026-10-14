using System.Net;
using System.Text.Json;
using INNO.One.Contracts.Integrations;

namespace INNO.One.Platform.IntegrationTests;

public sealed class ReadinessIntegrationTests
{
    private const string UnusedDatabase =
        "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Password=unused";

    [Fact]
    public async Task RequiredDependenciesConnected_AndDisabledOptionalDependency_ReturnsReady()
    {
        using var factory = new PlatformApiFactory(
            UnusedDatabase,
            [
                Snapshot("core-database", "PostgreSQL", "connected", enabled: true),
                Snapshot("keycloak", "Keycloak", "connected", enabled: true),
                Snapshot("meshcentral", "MeshCentral", "disconnected", enabled: false)
            ]);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ready", json.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RequiredDependencyDisconnected_ReturnsDegraded()
    {
        using var factory = new PlatformApiFactory(
            UnusedDatabase,
            [
                Snapshot("core-database", "PostgreSQL", "connected", enabled: true),
                Snapshot("keycloak", "Keycloak", "disconnected", enabled: true)
            ]);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("degraded", json.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task EnabledOptionalDependencyDisconnected_ReturnsDegraded()
    {
        using var factory = new PlatformApiFactory(
            UnusedDatabase,
            [
                Snapshot("core-database", "PostgreSQL", "connected", enabled: true),
                Snapshot("keycloak", "Keycloak", "connected", enabled: true),
                Snapshot("meshcentral", "MeshCentral", "disconnected", enabled: true)
            ]);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("degraded", json.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task MissingRequiredDependency_ReturnsDegraded()
    {
        using var factory = new PlatformApiFactory(
            UnusedDatabase,
            [
                Snapshot("core-database", "PostgreSQL", "connected", enabled: true)
            ]);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("degraded", json.RootElement.GetProperty("status").GetString());
    }

    private static IntegrationHealthSnapshot Snapshot(
        string id,
        string name,
        string status,
        bool enabled) =>
        new(
            id,
            name,
            "integration",
            name,
            "platform",
            "test://dependency",
            status,
            enabled,
            true,
            true,
            DateTimeOffset.UtcNow,
            1,
            status,
            Array.Empty<string>());
}
