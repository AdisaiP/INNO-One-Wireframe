using System.Text.RegularExpressions;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Devices.Domain;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Devices.Api;

public static partial class DeviceSoftwareInventoryEndpoints
{
    private static readonly string[] AllowedCompleteness = ["complete", "partial"];
    private static readonly string[] AllowedSources = ["endpoint_agent", "meshcentral", "manual_import"];
    private static readonly string[] AllowedArchitectures = ["x86", "x64", "arm", "arm64", "universal", "unknown"];

    public static RouteGroupBuilder MapDeviceSoftwareInventoryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/devices/{deviceId}/software-inventory", GetAsync)
            .WithName("devices.software_inventory.get");

        api.MapPut("/devices/{deviceId}/software-inventory", PutAsync)
            .WithName("devices.software_inventory.put");

        return api;
    }

    private static async Task<IResult> GetAsync(
        string deviceId,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceSoftwareInventoryReader inventoryReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
        {
            return NotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.view", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var device = await db.Devices.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
        {
            return NotFound();
        }

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var inventories = await inventoryReader.ReadLatestAsync([id], cancellationToken);
        if (!inventories.TryGetValue(id, out var inventory))
        {
            return Results.Ok(new ResourceResponse<SoftwareInventoryResponse>(
                new SoftwareInventoryResponse(
                    deviceId, "not_reported", null, null, null, null, null, 0, [])));
        }

        return Results.Ok(new ResourceResponse<SoftwareInventoryResponse>(
            ToResponse(deviceId, inventory)));
    }

    private static async Task<IResult> PutAsync(
        string deviceId,
        SoftwareInventoryRequest request,
        HttpContext httpContext,
        DevicesDbContext db,
        IAccessEvaluator accessEvaluator,
        DeviceLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(deviceId, "dev", out var id))
        {
            return NotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User, "devices.manage", cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var device = await db.Devices.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (device is null)
        {
            return NotFound();
        }

        if (!await CanAccessDeviceAsync(db, access, device, cancellationToken))
        {
            return Forbidden("OUTSIDE_ASSIGNED_SCOPE");
        }

        var completeness = request.Completeness?.Trim().ToLowerInvariant();
        if (!AllowedCompleteness.Contains(completeness))
        {
            return Validation("completeness", "Completeness must be complete or partial.");
        }

        var source = request.Source?.Trim().ToLowerInvariant();
        if (!AllowedSources.Contains(source))
        {
            return Validation("source", "Source must be endpoint_agent, meshcentral or manual_import.");
        }

        var now = DateTimeOffset.UtcNow;
        if (request.ObservedAt > now.AddMinutes(5))
        {
            return Validation("observedAt", "Observed time cannot be more than five minutes in the future.");
        }
        if (request.ObservedAt < now.AddDays(-30))
        {
            return Validation("observedAt", "Observed time cannot be older than 30 days.");
        }

        if (request.Packages is null || request.Packages.Count > 2000)
        {
            return Validation("packages", "Packages must contain between 0 and 2,000 items.");
        }

        var normalized = new List<NormalizedPackage>(request.Packages.Count);
        foreach (var package in request.Packages)
        {
            if (string.IsNullOrWhiteSpace(package.DisplayName)
                || package.DisplayName.Trim().Length > 300)
            {
                return Validation("packages", "Every package requires a displayName of at most 300 characters.");
            }

            var key = NormalizeProductKey(package.ProductKey, package.Publisher, package.DisplayName);
            if (key.Length > 240)
            {
                return Validation("packages", "A normalized productKey cannot exceed 240 characters.");
            }

            var architecture = NullIfWhiteSpace(package.Architecture)?.ToLowerInvariant();
            if (architecture is not null && !AllowedArchitectures.Contains(architecture))
            {
                return Validation("packages", "Architecture must be x86, x64, arm, arm64, universal or unknown.");
            }

            normalized.Add(new NormalizedPackage(
                key,
                package.DisplayName.Trim(),
                Limit(package.Version, 120),
                Limit(package.Publisher, 200),
                architecture));
        }

        var duplicate = normalized.GroupBy(x => x.ProductKey, StringComparer.Ordinal)
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
        {
            return Validation("packages", "Duplicate productKey: " + duplicate.Key);
        }

        var latestObservedAt = await db.SoftwareInventorySnapshots.AsNoTracking()
            .Where(x => x.DeviceId == id)
            .MaxAsync(x => (DateTimeOffset?)x.ObservedAt, cancellationToken);
        if (latestObservedAt is not null && request.ObservedAt <= latestObservedAt)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Stale software inventory",
                detail: "The reported observedAt must be newer than the current snapshot.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var snapshot = new DeviceSoftwareInventorySnapshot
        {
            Id = Guid.NewGuid(),
            DeviceId = id,
            ObservedAt = request.ObservedAt,
            ReceivedAt = now,
            Completeness = completeness!,
            Source = source!,
            SourceInstance = Limit(request.SourceInstance, 160),
            PackageCount = normalized.Count
        };
        db.SoftwareInventorySnapshots.Add(snapshot);
        db.InstalledSoftware.AddRange(normalized.Select(package => new DeviceInstalledSoftware
        {
            Id = Guid.NewGuid(),
            SnapshotId = snapshot.Id,
            ProductKey = package.ProductKey,
            DisplayName = package.DisplayName,
            Version = package.Version,
            Publisher = package.Publisher,
            Architecture = package.Architecture
        }));

        device.UpdatedAt = now;
        device.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);
        await ledger.AppendAuditAsync(
            "devices.software_inventory.observed",
            "device",
            deviceId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                snapshotId = OpaqueId.Format("swi", snapshot.Id),
                snapshot.ObservedAt,
                snapshot.Completeness,
                snapshot.Source,
                snapshot.PackageCount
            },
            cancellationToken);
        await ledger.AppendOutboxAsync(
            "device.software_inventory.observed",
            "device",
            deviceId,
            new
            {
                deviceId,
                snapshotId = OpaqueId.Format("swi", snapshot.Id),
                snapshot.ObservedAt,
                snapshot.Completeness,
                snapshot.Source,
                snapshot.PackageCount
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var entry = new DeviceSoftwareInventoryEntry(
            snapshot.Id,
            snapshot.DeviceId,
            snapshot.ObservedAt,
            snapshot.ReceivedAt,
            snapshot.Completeness,
            snapshot.Source,
            snapshot.SourceInstance,
            normalized.Select(x => new DeviceSoftwarePackage(
                x.ProductKey, x.DisplayName, x.Version, x.Publisher, x.Architecture)).ToArray());

        return Results.Ok(new ResourceResponse<SoftwareInventoryResponse>(
            ToResponse(deviceId, entry)));
    }

    private static SoftwareInventoryResponse ToResponse(
        string deviceId,
        DeviceSoftwareInventoryEntry inventory) =>
        new(
            deviceId,
            inventory.Completeness,
            OpaqueId.Format("swi", inventory.SnapshotId),
            inventory.ObservedAt,
            inventory.ReceivedAt,
            inventory.Source,
            inventory.SourceInstance,
            inventory.Packages.Count,
            inventory.Packages.Select(x => new SoftwarePackageResponse(
                x.ProductKey, x.DisplayName, x.Version, x.Publisher, x.Architecture)).ToArray());

    private static async Task<bool> CanAccessDeviceAsync(
        DevicesDbContext db,
        EffectiveAccess access,
        Device device,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
        {
            return true;
        }

        if (device.OrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId))
        {
            return true;
        }

        if (device.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        {
            return true;
        }

        var groupIds = access.DeviceGroupIds.ToArray();
        return await db.DeviceGroupMembers.AsNoTracking().AnyAsync(
            x => x.DeviceId == device.Id && groupIds.Contains(x.GroupId),
            cancellationToken);
    }

    private static string NormalizeProductKey(string? value, string? publisher, string displayName)
    {
        var raw = string.IsNullOrWhiteSpace(value)
            ? string.Join(":", new[] { publisher, displayName }.Where(x => !string.IsNullOrWhiteSpace(x)))
            : value;
        var normalized = ProductKeyPattern().Replace(raw!.Trim().ToLowerInvariant(), "-").Trim('-');
        return string.IsNullOrWhiteSpace(normalized) ? "unknown-product" : normalized;
    }

    private static string? Limit(string? value, int length)
    {
        var normalized = NullIfWhiteSpace(value);
        return normalized is null || normalized.Length <= length ? normalized : normalized[..length];
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Device not found");

    private static IResult Validation(string field, string detail) => Results.ValidationProblem(
        new Dictionary<string, string[]> { [field] = [detail] },
        title: "Validation failed");

    [GeneratedRegex("[^a-z0-9._:+-]+")]
    private static partial Regex ProductKeyPattern();

    private sealed record SoftwareInventoryRequest(
        DateTimeOffset ObservedAt,
        string? Completeness,
        string? Source,
        string? SourceInstance,
        IReadOnlyList<SoftwarePackageRequest>? Packages);

    private sealed record SoftwarePackageRequest(
        string? ProductKey,
        string? DisplayName,
        string? Version,
        string? Publisher,
        string? Architecture);

    private sealed record SoftwareInventoryResponse(
        string DeviceId,
        string InventoryStatus,
        string? SnapshotId,
        DateTimeOffset? ObservedAt,
        DateTimeOffset? ReceivedAt,
        string? Source,
        string? SourceInstance,
        int PackageCount,
        IReadOnlyList<SoftwarePackageResponse> Packages);

    private sealed record SoftwarePackageResponse(
        string ProductKey,
        string DisplayName,
        string? Version,
        string? Publisher,
        string? Architecture);

    private sealed record NormalizedPackage(
        string ProductKey,
        string DisplayName,
        string? Version,
        string? Publisher,
        string? Architecture);
}
