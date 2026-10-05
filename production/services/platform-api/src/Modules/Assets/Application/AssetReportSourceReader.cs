using System.Security.Claims;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Reports;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Application;

public sealed class AssetReportSourceReader(
    AssetsDbContext db,
    IAccessEvaluator accessEvaluator,
    IPlatformDirectoryReader directoryReader,
    IDeviceDirectoryReader deviceReader) : IReportSourceReader
{
    private static readonly ReportSourceColumn[] Columns =
    [
        new("assetTag", "Asset Tag", "text"),
        new("name", "Asset", "text"),
        new("category", "Category", "text"),
        new("status", "Lifecycle Status", "text"),
        new("brand", "Brand", "text"),
        new("model", "Model", "text"),
        new("serialNumber", "Serial Number", "text"),
        new("owner", "Owner", "text"),
        new("organization", "Organization", "text"),
        new("location", "Location", "text"),
        new("warrantyEndAt", "Warranty End", "datetime"),
        new("registeredAt", "Registered", "datetime")
    ];

    public ReportSourceDescriptor Descriptor { get; } = new(
        "assets.inventory",
        "Asset Inventory",
        "assets.view",
        Columns,
        ["status", "category", "brand", "organization", "location"]);

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

        var assets = await db.Assets.AsNoTracking()
            .OrderBy(x => x.AssetTag)
            .ToListAsync(cancellationToken);
        var visible = await FilterVisibleAsync(assets, access, cancellationToken);

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

    private async Task<Asset[]> FilterVisibleAsync(
        IReadOnlyList<Asset> assets,
        EffectiveAccess access,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
        {
            return assets.ToArray();
        }

        var visible = assets
            .Where(x =>
                (x.OrganizationUnitId is Guid organizationId
                    && access.OrganizationIds.Contains(organizationId))
                || (x.LocationId is Guid locationId
                    && access.LocationIds.Contains(locationId)))
            .ToDictionary(x => x.Id);

        if (access.DeviceGroupIds.Count == 0)
        {
            return visible.Values.ToArray();
        }

        var remaining = assets
            .Where(x => !visible.ContainsKey(x.Id) && x.LinkedDeviceId.HasValue)
            .ToArray();
        var deviceIds = remaining
            .Select(x => x.LinkedDeviceId!.Value)
            .Distinct()
            .ToArray();
        var devices = await deviceReader.ReadAsync(deviceIds, cancellationToken);

        foreach (var asset in remaining)
        {
            if (asset.LinkedDeviceId is Guid deviceId
                && devices.TryGetValue(deviceId, out var device)
                && device.GroupIds.Any(access.DeviceGroupIds.Contains))
            {
                visible[asset.Id] = asset;
            }
        }

        return visible.Values.OrderBy(x => x.AssetTag).ToArray();
    }

    private static Dictionary<string, string?> CreateRow(
        Asset asset,
        PlatformDirectorySnapshot directory) =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["assetTag"] = asset.AssetTag,
            ["name"] = asset.Name,
            ["category"] = asset.Category,
            ["status"] = asset.LifecycleStatus,
            ["brand"] = asset.Brand,
            ["model"] = asset.Model,
            ["serialNumber"] = asset.SerialNumber,
            ["owner"] = asset.OwnerUserId is Guid ownerId
                ? directory.Users.GetValueOrDefault(ownerId)
                : null,
            ["organization"] = asset.OrganizationUnitId is Guid organizationId
                ? directory.Organizations.GetValueOrDefault(organizationId)
                : null,
            ["location"] = asset.LocationId is Guid locationId
                ? directory.Locations.GetValueOrDefault(locationId)
                : null,
            ["warrantyEndAt"] = asset.WarrantyEndAt?.ToUniversalTime().ToString("O"),
            ["registeredAt"] = asset.RegisteredAt.ToUniversalTime().ToString("O")
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
