using System.Data;
using System.Text.Json;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static class DeviceActivityEndpoints
{
    public static RouteGroupBuilder MapDeviceActivityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/{deviceId}/activity", ListAsync)
            .WithName("devices.activity.list");
        return api;
    }

    private static async Task<IResult> ListAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader directoryReader,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
            return NotFound();

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
            return Forbidden(access.Reason);

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
            return NotFound();

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        var connection = db.Database.GetDbConnection();
        var closeWhenDone = connection.State != ConnectionState.Open;
        if (closeWhenDone)
            await connection.OpenAsync(cancellationToken);

        try
        {
            long totalItems;
            await using (var countCommand = connection.CreateCommand())
            {
                countCommand.CommandText = """
                    SELECT COUNT(*)
                    FROM audit.audit_records
                    WHERE module = 'devices'
                      AND (
                        (target_type = 'device' AND target_id = @target_id)
                        OR (
                          target_type = 'remote_session'
                          AND target_id IN (
                            SELECT 'rses_' || REPLACE(id::text, '-', '')
                            FROM devices.remote_sessions
                            WHERE device_id = @device_uuid
                          )
                        )
                      )
                    """;
                AddParameter(countCommand, "@target_id", deviceId);
                AddParameter(countCommand, "@device_uuid", id);
                totalItems = Convert.ToInt64(
                    await countCommand.ExecuteScalarAsync(cancellationToken) ?? 0);
            }

            var rows = new List<ActivityRow>();
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    SELECT audit_id,
                           action,
                           actor_id,
                           occurred_at,
                           classification,
                           metadata_json::text
                    FROM audit.audit_records
                    WHERE module = 'devices'
                      AND (
                        (target_type = 'device' AND target_id = @target_id)
                        OR (
                          target_type = 'remote_session'
                          AND target_id IN (
                            SELECT 'rses_' || REPLACE(id::text, '-', '')
                            FROM devices.remote_sessions
                            WHERE device_id = @device_uuid
                          )
                        )
                      )
                    ORDER BY occurred_at DESC, audit_id DESC
                    LIMIT @limit OFFSET @offset
                    """;
                AddParameter(command, "@target_id", deviceId);
                AddParameter(command, "@device_uuid", id);
                AddParameter(command, "@limit", pageSize);
                AddParameter(command, "@offset", offset);

                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    rows.Add(new ActivityRow(
                        reader.GetGuid(0),
                        reader.GetString(1),
                        reader.GetString(2),
                        reader.GetFieldValue<DateTimeOffset>(3),
                        reader.GetString(4),
                        reader.IsDBNull(5) ? "{}" : reader.GetString(5)));
                }
            }

            var actorIds = rows
                .Select(x => TryParseActorId(x.ActorId, out var actorId) ? actorId : (Guid?)null)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .Distinct()
                .ToArray();
            var actors = actorIds.Length == 0
                ? new Dictionary<Guid, DirectoryUserEntry>()
                : await directoryReader.ReadUsersAsync(actorIds, cancellationToken);

            var items = rows.Select(row =>
            {
                var actorName = TryParseActorId(row.ActorId, out var actorId)
                    && actors.TryGetValue(actorId, out var actor)
                        ? actor.FullName
                        : row.ActorId;

                return new DeviceActivityItemResponse(
                    OpaqueId.Format("act", row.Id),
                    row.Action,
                    row.ActorId,
                    actorName,
                    row.OccurredAt,
                    row.Classification,
                    ProjectMetadata(row.Action, row.MetadataJson));
            }).ToArray();

            var totalPages = totalItems == 0
                ? 0
                : (int)Math.Ceiling(totalItems / (double)pageSize);

            return Results.Ok(new PagedResponse<DeviceActivityItemResponse>(
                items,
                page,
                pageSize,
                checked((int)Math.Min(totalItems, int.MaxValue)),
                totalPages));
        }
        finally
        {
            if (closeWhenDone)
                await connection.CloseAsync();
        }
    }

    private static bool TryParseActorId(string actorId, out Guid id)
    {
        if (Guid.TryParse(actorId, out id))
            return true;
        return OpaqueId.TryParse(actorId, "user", out id);
    }

    private static JsonElement ProjectMetadata(string action, string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return JsonSerializer.SerializeToElement(new Dictionary<string, JsonElement>());

            var source = document.RootElement;
            var projected = new Dictionary<string, JsonElement>(StringComparer.Ordinal);

            void Copy(string outputName, params string[] inputNames)
            {
                foreach (var property in source.EnumerateObject())
                {
                    if (!inputNames.Contains(property.Name, StringComparer.OrdinalIgnoreCase))
                        continue;

                    projected[outputName] = property.Value.Clone();
                    return;
                }
            }

            switch (action)
            {
                case "devices.software_inventory.observed":
                    Copy("snapshotId", "snapshotId");
                    Copy("observedAt", "observedAt");
                    Copy("completeness", "completeness");
                    Copy("source", "source");
                    Copy("packageCount", "packageCount");
                    break;
                case "devices.process.terminate":
                    Copy("processKey", "processKey");
                    Copy("processId", "processId");
                    Copy("executionEngine", "executionEngine");
                    Copy("verified", "verified");
                    break;
                case "devices.service.action":
                    Copy("serviceName", "serviceName");
                    Copy("action", "action");
                    Copy("executionEngine", "executionEngine");
                    Copy("verified", "verified");
                    break;
            }

            return JsonSerializer.SerializeToElement(projected);
        }
        catch (JsonException)
        {
            return JsonSerializer.SerializeToElement(new Dictionary<string, JsonElement>());
        }
    }

    private static void AddParameter(
        System.Data.Common.DbCommand command,
        string name,
        object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static async Task<bool> CanAccessDeviceAsync(
        DevicesDbContext db,
        EffectiveAccess access,
        Device device,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
            return true;

        if (device.OrganizationUnitId is Guid orgId && access.OrganizationIds.Contains(orgId))
            return true;
        if (device.LocationId is Guid locationId && access.LocationIds.Contains(locationId))
            return true;

        var groupIds = access.DeviceGroupIds.ToArray();
        return groupIds.Length > 0 && await db.DeviceGroupMembers.AsNoTracking()
            .AnyAsync(x => x.DeviceId == device.Id && groupIds.Contains(x.GroupId), cancellationToken);
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Device not found");

    private sealed record ActivityRow(
        Guid Id,
        string Action,
        string ActorId,
        DateTimeOffset OccurredAt,
        string Classification,
        string MetadataJson);

    private sealed record DeviceActivityItemResponse(
        string Id,
        string Action,
        string ActorId,
        string ActorName,
        DateTimeOffset OccurredAt,
        string Classification,
        JsonElement Metadata);
}
