namespace INNO.One.Contracts.Integrations;

public interface IIntegrationHealthProvider
{
    string Id { get; }

    Task<IntegrationHealthSnapshot> CheckAsync(
        CancellationToken cancellationToken = default);
}

public sealed record IntegrationHealthSnapshot(
    string Id,
    string Name,
    string Category,
    string Provider,
    string OwnerModule,
    string Endpoint,
    string Status,
    bool Enabled,
    bool Configured,
    bool CanTest,
    DateTimeOffset CheckedAt,
    long DurationMs,
    string Message,
    IReadOnlyList<string> Capabilities);
