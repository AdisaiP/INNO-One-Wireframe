namespace INNO.One.Contracts.Security;

public interface ISecurityPostureProvider
{
    string Id { get; }

    Task<SecurityPostureSnapshot> CheckAsync(
        CancellationToken cancellationToken = default);
}

public sealed record SecurityPostureSnapshot(
    string Id,
    string Name,
    string Category,
    string OwnerModule,
    string Status,
    DateTimeOffset CheckedAt,
    long DurationMs,
    string Message,
    IReadOnlyList<SecurityControlSnapshot> Controls);

public sealed record SecurityControlSnapshot(
    string Id,
    string Name,
    string Status,
    string Value,
    string Detail);
