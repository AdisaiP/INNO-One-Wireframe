namespace INNO.One.Contracts.Operations;

public sealed record OperationSnapshot(
    Guid OperationId,
    string OperationType,
    string OriginModule,
    string RequestedByActorType,
    string RequestedByActorId,
    string? RequiredPermission,
    string Status,
    int Progress,
    string? ErrorCode,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ExpiresAt);

public interface IOperationReader
{
    Task<OperationSnapshot?> ReadAsync(
        Guid operationId,
        CancellationToken cancellationToken = default);
}
