using System.Net;

namespace INNO.One.Platform.IntegrationTests;

[Collection(PlatformDatabaseCollection.CollectionName)]
public sealed class RequestContextIntegrationTests(PlatformDatabaseFixture database)
{
    [Fact]
    public async Task CorrelationId_IsPreservedAndReturned()
    {
        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("X-Correlation-Id", "core-test-123");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.TryGetValues("X-Correlation-Id", out var values));
        Assert.Equal("core-test-123", Assert.Single(values));
        Assert.True(response.Headers.TryGetValues("X-Trace-Id", out var traceValues));
        var traceId = Assert.Single(traceValues);
        Assert.Equal(32, traceId.Length);
        Assert.All(traceId, character => Assert.True(char.IsAsciiHexDigit(character)));
    }

    [Fact]
    public async Task UnsafeCorrelationId_IsReplaced()
    {
        using var factory = new PlatformApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.TryAddWithoutValidation("X-Correlation-Id", "not safe value");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.TryGetValues("X-Correlation-Id", out var values));
        var correlationId = Assert.Single(values);
        Assert.NotEqual("not safe value", correlationId);
        Assert.Equal(32, correlationId.Length);
        Assert.All(correlationId, character => Assert.True(char.IsAsciiHexDigit(character)));
    }
}
