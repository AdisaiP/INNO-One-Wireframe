using System.Text.Json;
using INNO.One.Contracts.Operations;
using INNO.One.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Infrastructure.Operations;

public sealed class OperationReader(InfrastructureDbContext db) : IOperationReader
{
    public async Task<OperationSnapshot?> ReadAsync(
        Guid operationId,
        CancellationToken cancellationToken = default)
    {
        var record = await db.Operations
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.OperationId == operationId,
                cancellationToken);

        if (record is null)
        {
            return null;
        }

        return new OperationSnapshot(
            record.OperationId,
            record.OperationType,
            record.OriginModule,
            record.RequestedByActorType,
            record.RequestedByActorId,
            ReadPermission(record.PermissionContext),
            record.Status,
            Math.Clamp(record.Progress, 0, 100),
            record.ErrorCode,
            record.CreatedAt,
            record.UpdatedAt,
            record.ExpiresAt);
    }

    private static string? ReadPermission(string permissionContext)
    {
        try
        {
            using var document = JsonDocument.Parse(permissionContext);
            return document.RootElement.TryGetProperty("permission", out var permission)
                && permission.ValueKind == JsonValueKind.String
                ? permission.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
