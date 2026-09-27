using System.Security.Cryptography;
using System.Text;
using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Api;

public static class AssetsQrEndpoints
{
    private const string TokenPrefix = "inno1_qr_";

    public static RouteGroupBuilder MapAssetsQrEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/assets/{assetId}/qr-label", CreateQrLabelAsync)
            .WithName("assets.qr_label.create");
        api.MapPost("/assets/qr/resolve", ResolveQrAsync)
            .WithName("assets.qr_resolve");
        return api;
    }

    private static async Task<IResult> CreateQrLabelAsync(
        string assetId,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(assetId, "asset", out var id))
        {
            return NotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.qr.print",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var asset = await db.Assets.SingleOrDefaultAsync(
            x => x.Id == id,
            cancellationToken);
        if (asset is null)
        {
            return NotFound();
        }

        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var now = DateTimeOffset.UtcNow;
        var activeLabels = await db.QrLabels
            .Where(x => x.AssetId == asset.Id && x.Status == "active")
            .ToListAsync(cancellationToken);

        foreach (var previous in activeLabels)
        {
            previous.Status = "revoked";
            previous.RevokedAt = now;
        }

        var token = CreateOpaqueToken();
        var label = new AssetQrLabel
        {
            Id = Guid.NewGuid(),
            AssetId = asset.Id,
            TokenFingerprint = Fingerprint(token),
            Status = "active",
            CreatedByUserId = access.UserId,
            CreatedAt = now
        };
        db.QrLabels.Add(label);

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var publicAssetId = OpaqueId.Format("asset", asset.Id);
        await ledger.AppendAuditAsync(
            "assets.qr.generated",
            "asset",
            publicAssetId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                labelId = OpaqueId.Format("qr", label.Id),
                replacedActiveLabels = activeLabels.Count
            },
            cancellationToken,
            classification: "internal");

        await transaction.CommitAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<QrLabelResponse>(
            new QrLabelResponse(
                OpaqueId.Format("qr", label.Id),
                publicAssetId,
                asset.AssetTag,
                asset.Name,
                BrandModel(asset),
                asset.SerialNumber,
                token,
                label.CreatedAt,
                label.ExpiresAt,
                activeLabels.Count > 0)));
    }
    private static async Task<IResult> ResolveQrAsync(
        ResolveQrRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        AssetCustomFieldValueService customFieldService,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.qr.scan",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var token = request.Token?.Trim() ?? string.Empty;
        if (!IsPlausibleToken(token))
        {
            return NotFound();
        }

        var fingerprint = Fingerprint(token);
        var now = DateTimeOffset.UtcNow;
        var label = await db.QrLabels.SingleOrDefaultAsync(
            x => x.TokenFingerprint == fingerprint,
            cancellationToken);

        if (label is null
            || label.Status != "active"
            || label.RevokedAt.HasValue
            || (label.ExpiresAt.HasValue && label.ExpiresAt <= now))
        {
            return NotFound();
        }

        var asset = await db.Assets.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == label.AssetId,
            cancellationToken);
        if (asset is null)
        {
            return NotFound();
        }

        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var directory = await platformReader.ReadAsync(
            asset.OwnerUserId.HasValue ? new[] { asset.OwnerUserId.Value } : Array.Empty<Guid>(),
            asset.OrganizationUnitId.HasValue ? new[] { asset.OrganizationUnitId.Value } : Array.Empty<Guid>(),
            asset.LocationId.HasValue ? new[] { asset.LocationId.Value } : Array.Empty<Guid>(),
            cancellationToken);

        DeviceDirectoryEntry? linkedDevice = null;
        if (asset.LinkedDeviceId.HasValue)
        {
            var devices = await deviceReader.ReadAsync(
                new[] { asset.LinkedDeviceId.Value },
                cancellationToken);
            linkedDevice = devices.GetValueOrDefault(asset.LinkedDeviceId.Value);
        }

        var customFields = await customFieldService.ReadForAssetAsync(
            asset.Id,
            cancellationToken);

        var scan = new AssetQrScan
        {
            Id = Guid.NewGuid(),
            AssetId = asset.Id,
            LabelId = label.Id,
            ScannerUserId = access.UserId,
            ScannedAt = now,
            Outcome = "resolved"
        };
        db.QrScans.Add(scan);

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var publicAssetId = OpaqueId.Format("asset", asset.Id);
        await ledger.AppendAuditAsync(
            "assets.qr.scanned",
            "asset",
            publicAssetId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                labelId = OpaqueId.Format("qr", label.Id),
                scanId = OpaqueId.Format("qrscan", scan.Id),
                outcome = scan.Outcome
            },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Results.Ok(new ResourceResponse<QrResolvedAssetResponse>(
            new QrResolvedAssetResponse(
                publicAssetId,
                asset.AssetTag,
                asset.Name,
                asset.Category,
                asset.Brand,
                asset.Model,
                asset.SerialNumber,
                asset.LifecycleStatus,
                asset.OwnerUserId.HasValue
                    ? new ReferenceResponse(
                        OpaqueId.Format("user", asset.OwnerUserId.Value),
                        directory.Users.GetValueOrDefault(asset.OwnerUserId.Value)
                            ?? "Unknown user")
                    : null,
                asset.OrganizationUnitId.HasValue
                    ? new ReferenceResponse(
                        OpaqueId.Format("org", asset.OrganizationUnitId.Value),
                        directory.Organizations.GetValueOrDefault(asset.OrganizationUnitId.Value)
                            ?? "Unknown organization")
                    : null,
                asset.LocationId.HasValue
                    ? new ReferenceResponse(
                        OpaqueId.Format("loc", asset.LocationId.Value),
                        directory.Locations.GetValueOrDefault(asset.LocationId.Value)
                            ?? "Unknown location")
                    : null,
                linkedDevice is null
                    ? null
                    : new LinkedDeviceResponse(
                        OpaqueId.Format("dev", linkedDevice.Id),
                        linkedDevice.Name,
                        linkedDevice.Status,
                        linkedDevice.OperatingSystem),
                asset.WarrantyEndAt,
                customFields.Select(x => new CustomFieldResponse(
                    x.FieldKey,
                    x.Label,
                    x.FieldType,
                    x.Value)).ToArray(),
                scan.ScannedAt,
                asset.UpdatedAt)));
    }
    private static async Task<bool> CanAccessAssetAsync(
        EffectiveAccess access,
        Asset asset,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        if (access.AllResources)
        {
            return true;
        }

        if (asset.OrganizationUnitId is Guid orgId
            && access.OrganizationIds.Contains(orgId))
        {
            return true;
        }

        if (asset.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        {
            return true;
        }

        if (asset.LinkedDeviceId is Guid deviceId
            && access.DeviceGroupIds.Count > 0)
        {
            var devices = await deviceReader.ReadAsync(
                new[] { deviceId },
                cancellationToken);
            return devices.TryGetValue(deviceId, out var device)
                && device.GroupIds.Any(access.DeviceGroupIds.Contains);
        }

        return false;
    }

    private static string CreateOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var value = Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return TokenPrefix + value;
    }

    private static bool IsPlausibleToken(string token) =>
        token.StartsWith(TokenPrefix, StringComparison.Ordinal)
        && token.Length is >= 50 and <= 80;

    private static string Fingerprint(string token) =>
        Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(token)))
            .ToLowerInvariant();

    private static string BrandModel(Asset asset) =>
        string.Join(
            " ",
            new[] { asset.Brand, asset.Model }
                .Where(x => !string.IsNullOrWhiteSpace(x)));

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "QR code not found",
        detail: "The QR code is invalid or is no longer active.");

    public sealed record ResolveQrRequest(string? Token);

    private sealed record QrLabelResponse(
        string Id,
        string AssetId,
        string AssetTag,
        string AssetName,
        string BrandModel,
        string? SerialNumber,
        string QrValue,
        DateTimeOffset GeneratedAt,
        DateTimeOffset? ExpiresAt,
        bool ReplacedPrevious);

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record LinkedDeviceResponse(
        string Id,
        string Name,
        string Status,
        string? OperatingSystem);

    private sealed record CustomFieldResponse(
        string FieldKey,
        string Label,
        string FieldType,
        System.Text.Json.JsonElement? Value);

    private sealed record QrResolvedAssetResponse(
        string Id,
        string AssetTag,
        string Name,
        string Category,
        string? Brand,
        string? Model,
        string? SerialNumber,
        string Status,
        ReferenceResponse? Owner,
        ReferenceResponse? Organization,
        ReferenceResponse? Location,
        LinkedDeviceResponse? LinkedDevice,
        DateTimeOffset? WarrantyEndAt,
        IReadOnlyList<CustomFieldResponse> CustomFields,
        DateTimeOffset ScannedAt,
        DateTimeOffset UpdatedAt);
}
