using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Reports;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Application;

public sealed class DeviceReportSourceReader(
    DevicesDbContext db,
    IAccessEvaluator accessEvaluator,
    IPlatformDirectoryReader directoryReader) : IReportSourceReader
{
    private static readonly ReportSourceColumn[] Columns =
    [
        new("hostname", "Device", "text"),
        new("type", "Type", "text"),
        new("status", "Status", "text"),
        new("operatingSystem", "Operating System", "text"),
        new("ipAddress", "IP Address", "text"),
        new("owner", "Owner", "text"),
        new("organization", "Organization", "text"),
        new("location", "Location", "text"),
        new("manufacturer", "Manufacturer", "text"),
        new("model", "Model", "text"),
        new("agentVersion", "Agent Version", "text"),
        new("lastSeenAt", "Last Seen", "datetime")
    ];

    public ReportSourceDescriptor Descriptor { get; } = new(
        "devices.inventory",
        "Device Inventory",
        "devices.view",
        Columns,
        ["status", "type", "organization", "location", "manufacturer"]);

    public async Task<ReportTabularResult> ReadAsync(
        ClaimsPrincipal principal,
        IReadOnlyList<string> columns,
        IReadOnlyList<ReportFilter> filters,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            principal,
            Descriptor.RequiredPermission,
            cancellationToken);
        if (!access.Allowed)
        {
            throw new ReportSourceAccessException(
                "REPORT_SOURCE_PERMISSION_DENIED",
                access.Reason);
        }

        var devices = await db.Devices.AsNoTracking()
            .OrderBy(x => x.Hostname)
            .ToListAsync(cancellationToken);

        Dictionary<Guid, HashSet<Guid>> groupsByDevice = [];
        if (!access.AllResources && access.DeviceGroupIds.Count > 0)
        {
            groupsByDevice = (await db.DeviceGroupMembers.AsNoTracking()
                    .Where(x => access.DeviceGroupIds.Contains(x.GroupId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.DeviceId)
                .ToDictionary(
                    x => x.Key,
                    x => x.Select(y => y.GroupId).ToHashSet());
        }

        var visible = devices
            .Where(x => CanAccess(access, x, groupsByDevice))
            .ToArray();

        var directory = await directoryReader.ReadAsync(
            visible.Where(x => x.OwnerUserId.HasValue)
                .Select(x => x.OwnerUserId!.Value)
                .Distinct()
                .ToArray(),
            visible.Where(x => x.OrganizationUnitId.HasValue)
                .Select(x => x.OrganizationUnitId!.Value)
                .Distinct()
                .ToArray(),
            visible.Where(x => x.LocationId.HasValue)
                .Select(x => x.LocationId!.Value)
                .Distinct()
                .ToArray(),
            cancellationToken);

        var requested = NormalizeColumns(columns);
        var rows = visible
            .Select(x => CreateRow(x, directory))
            .Where(row => Matches(row, filters))
            .Select(row => requested.ToDictionary(
                key => key,
                key => row.GetValueOrDefault(key),
                StringComparer.OrdinalIgnoreCase))
            .Cast<IReadOnlyDictionary<string, string?>>()
            .ToArray();

        return new ReportTabularResult(requested, rows);
    }

    private static bool CanAccess(
        EffectiveAccess access,
        Device device,
        IReadOnlyDictionary<Guid, HashSet<Guid>> groupsByDevice) =>
        access.AllResources
        || device.OwnerUserId == access.UserId
        || (device.OrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId))
        || (device.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        || (groupsByDevice.TryGetValue(device.Id, out var groups)
            && groups.Any(access.DeviceGroupIds.Contains));

    private static Dictionary<string, string?> CreateRow(
        Device device,
        PlatformDirectorySnapshot directory) =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["hostname"] = device.Hostname,
            ["type"] = device.DeviceType,
            ["status"] = device.ConnectivityState,
            ["operatingSystem"] = device.OperatingSystem,
            ["ipAddress"] = device.IpAddress,
            ["owner"] = device.OwnerUserId is Guid ownerId
                ? directory.Users.GetValueOrDefault(ownerId)
                : null,
            ["organization"] = device.OrganizationUnitId is Guid organizationId
                ? directory.Organizations.GetValueOrDefault(organizationId)
                : null,
            ["location"] = device.LocationId is Guid locationId
                ? directory.Locations.GetValueOrDefault(locationId)
                : null,
            ["manufacturer"] = device.Manufacturer,
            ["model"] = device.Model,
            ["agentVersion"] = device.AgentVersion,
            ["lastSeenAt"] = device.LastSeenAt?.ToUniversalTime().ToString("O")
        };

    private static string[] NormalizeColumns(IReadOnlyList<string> columns)
    {
        var allowed = Columns.Select(x => x.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var selected = columns.Where(allowed.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return selected.Length > 0 ? selected : Columns.Select(x => x.Key).ToArray();
    }

    private static bool Matches(
        IReadOnlyDictionary<string, string?> row,
        IReadOnlyList<ReportFilter> filters) =>
        filters.All(filter =>
        {
            if (!row.TryGetValue(filter.Field, out var value))
            {
                return false;
            }
            var left = value ?? "";
            var right = filter.Value ?? "";
            return filter.Operator.Trim().ToLowerInvariant() switch
            {
                "contains" => left.Contains(right, StringComparison.OrdinalIgnoreCase),
                "not_equals" => !string.Equals(left, right, StringComparison.OrdinalIgnoreCase),
                _ => string.Equals(left, right, StringComparison.OrdinalIgnoreCase)
            };
        });
}
