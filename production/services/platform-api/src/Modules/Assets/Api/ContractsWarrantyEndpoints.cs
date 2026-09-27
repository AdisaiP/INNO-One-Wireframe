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

public static class ContractsWarrantyEndpoints
{
    public static RouteGroupBuilder MapContractsWarrantyEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/assets/contracts", ListContractsAsync)
            .WithName("assets.contracts.list");
        api.MapPatch("/assets/contracts/{contractId}", UpdateContractAsync)
            .WithName("assets.contracts.update");
        return api;
    }

    private static async Task<IResult> ListContractsAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        string? search,
        string? status,
        string? fiscalYear,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var assets = await db.Assets.AsNoTracking().ToListAsync(cancellationToken);
        var devices = await ReadLinkedDevicesAsync(
            assets,
            deviceReader,
            cancellationToken);
        var visibleAssets = assets
            .Where(x => CanAccessAsset(access, x, devices))
            .ToArray();
        var visibleAssetIds = visibleAssets.Select(x => x.Id).ToHashSet();

        var links = await db.AssetContractLinks.AsNoTracking()
            .Where(x => visibleAssetIds.Contains(x.AssetId))
            .ToListAsync(cancellationToken);
        var linkedContractIds = links.Select(x => x.ContractId).ToHashSet();

        var contracts = await db.Contracts.AsNoTracking()
            .Where(x => x.RecordStatus == "active")
            .OrderBy(x => x.EndAt)
            .ThenBy(x => x.ContractNumber)
            .ToListAsync(cancellationToken);

        if (!access.AllResources)
        {
            contracts = contracts
                .Where(x => linkedContractIds.Contains(x.Id))
                .ToList();
        }

        var ownerIds = visibleAssets
            .Where(x => x.OwnerUserId.HasValue)
            .Select(x => x.OwnerUserId!.Value)
            .Distinct()
            .ToArray();
        var directory = await platformReader.ReadAsync(
            ownerIds,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);

        var assetById = visibleAssets.ToDictionary(x => x.Id);
        var linksByContract = links
            .GroupBy(x => x.ContractId)
            .ToDictionary(x => x.Key, x => x.ToArray());
        var now = DateTimeOffset.UtcNow;

        var allItems = contracts.Select(contract => ToResponse(
            contract,
            linksByContract.GetValueOrDefault(
                contract.Id,
                Array.Empty<AssetContractLink>()),
            assetById,
            directory,
            now)).ToArray();

        IEnumerable<ContractResponse> filtered = allItems;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            filtered = filtered.Where(x =>
                x.ContractNumber.Contains(q, StringComparison.OrdinalIgnoreCase)
                || x.Vendor.Contains(q, StringComparison.OrdinalIgnoreCase)
                || x.ServiceType.Contains(q, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(x =>
                string.Equals(x.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(fiscalYear)
            && !string.Equals(fiscalYear, "all", StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(x =>
                string.Equals(
                    x.FiscalYear,
                    fiscalYear,
                    StringComparison.OrdinalIgnoreCase));
        }

        var filteredItems = filtered.ToArray();
        var totalItems = filteredItems.Length;
        var totalPages = totalItems == 0
            ? 0
            : (int)Math.Ceiling(totalItems / (double)pageSize);
        var pageItems = filteredItems
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArray();

        var activeCoverageContractIds = allItems
            .Where(x => x.Status is "active" or "expiring")
            .Select(x => x.Id)
            .ToHashSet(StringComparer.Ordinal);
        var coveredAssetIds = links
            .Where(x => activeCoverageContractIds.Contains(
                OpaqueId.Format("contract", x.ContractId)))
            .Select(x => x.AssetId)
            .Distinct()
            .ToHashSet();

        var summary = new ContractSummaryResponse(
            allItems.Count(x => x.Status == "active"),
            allItems.Count(x => x.Status == "expiring"),
            coveredAssetIds.Count,
            Math.Max(visibleAssets.Length - coveredAssetIds.Count, 0));

        var fiscalYears = allItems
            .Select(x => x.FiscalYear)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderDescending()
            .ToArray();

        return Results.Ok(new ContractListResponse(
            pageItems,
            page,
            pageSize,
            totalItems,
            totalPages,
            summary,
            fiscalYears));
    }
    private static async Task<IResult> UpdateContractAsync(
        string contractId,
        UpdateContractRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(contractId, "contract", out var id))
        {
            return NotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.contract.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var contract = await db.Contracts.SingleOrDefaultAsync(
            x => x.Id == id && x.RecordStatus == "active",
            cancellationToken);
        if (contract is null)
        {
            return NotFound();
        }

        var links = await db.AssetContractLinks
            .Where(x => x.ContractId == contract.Id)
            .ToListAsync(cancellationToken);
        var linkedAssetIds = links.Select(x => x.AssetId).ToArray();
        var linkedAssets = await db.Assets
            .Where(x => linkedAssetIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var devices = await ReadLinkedDevicesAsync(
            linkedAssets,
            deviceReader,
            cancellationToken);

        if (!access.AllResources
            && !linkedAssets.Any(x => CanAccessAsset(access, x, devices)))
        {
            return Forbidden("CONTRACT_OUTSIDE_SCOPE");
        }

        var precondition = ValidateIfMatch(httpContext, contract.Version);
        if (precondition is not null)
        {
            return precondition;
        }

        var validation = Validate(request);
        if (validation is not null)
        {
            return validation;
        }

        var now = DateTimeOffset.UtcNow;
        var previousStatus = DisplayStatus(contract.EndAt, now);
        var previousEndAt = contract.EndAt;

        contract.FiscalYear = request.FiscalYear.Trim();
        contract.Vendor = request.Vendor.Trim();
        contract.StartAt = request.StartAt.ToUniversalTime();
        contract.EndAt = request.EndAt.ToUniversalTime();
        contract.ServiceType = request.ServiceType.Trim();
        contract.ServiceCondition = NormalizeOptional(request.ServiceCondition);
        contract.WarrantyTerms = NormalizeOptional(request.WarrantyTerms);
        contract.ContactName = NormalizeOptional(request.ContactName);
        contract.ContactPhone = NormalizeOptional(request.ContactPhone);
        contract.ContactEmail = NormalizeOptional(request.ContactEmail);
        contract.Version++;
        contract.UpdatedAt = now;

        var newStatus = DisplayStatus(contract.EndAt, now);
        var publicId = OpaqueId.Format("contract", contract.Id);
        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await ledger.AppendAuditAsync(
            "assets.contract.updated",
            "contract",
            publicId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                contract.ContractNumber,
                contract.Vendor,
                previousEndAt,
                endAt = contract.EndAt,
                previousStatus,
                status = newStatus,
                coveredAssets = links.Count
            },
            cancellationToken,
            classification: "internal");

        if (previousStatus != "expiring" && newStatus == "expiring")
        {
            var daysRemaining = Math.Max(
                0,
                (int)Math.Ceiling((contract.EndAt - now).TotalDays));
            foreach (var link in links)
            {
                await ledger.AppendOutboxAsync(
                    "contract.expiring",
                    "contract",
                    publicId,
                    new
                    {
                        contractId = publicId,
                        assetId = OpaqueId.Format("asset", link.AssetId),
                        expiresAt = contract.EndAt,
                        daysRemaining
                    },
                    correlationId,
                    null,
                    httpContext.TraceIdentifier,
                    cancellationToken);
            }
        }

        await transaction.CommitAsync(cancellationToken);

        var response = ToResponse(
            contract,
            links,
            linkedAssets.ToDictionary(x => x.Id),
            new PlatformDirectorySnapshot(
                new Dictionary<Guid, string>(),
                new Dictionary<Guid, string>(),
                new Dictionary<Guid, string>()),
            now);
        httpContext.Response.Headers.ETag = response.ETag;
        return Results.Ok(new ResourceResponse<ContractResponse>(response));
    }
    private static ContractResponse ToResponse(
        AssetContract contract,
        IReadOnlyCollection<AssetContractLink> links,
        IReadOnlyDictionary<Guid, Asset> assetById,
        PlatformDirectorySnapshot directory,
        DateTimeOffset now)
    {
        var status = DisplayStatus(contract.EndAt, now);
        var daysRemaining = status == "expired"
            ? 0
            : Math.Max(0, (int)Math.Ceiling((contract.EndAt - now).TotalDays));

        return new ContractResponse(
            OpaqueId.Format("contract", contract.Id),
            contract.ContractNumber,
            contract.FiscalYear,
            contract.Vendor,
            contract.StartAt,
            contract.EndAt,
            contract.ServiceType,
            contract.ServiceCondition,
            contract.WarrantyTerms,
            contract.ContactName,
            contract.ContactPhone,
            contract.ContactEmail,
            status,
            daysRemaining,
            links
                .Where(x => assetById.ContainsKey(x.AssetId))
                .Select(x =>
                {
                    var asset = assetById[x.AssetId];
                    return new CoveredAssetResponse(
                        OpaqueId.Format("asset", asset.Id),
                        asset.AssetTag,
                        asset.Name,
                        string.Join(
                            " ",
                            new[] { asset.Brand, asset.Model }
                                .Where(y => !string.IsNullOrWhiteSpace(y))),
                        asset.OwnerUserId.HasValue
                            ? directory.Users.GetValueOrDefault(
                                asset.OwnerUserId.Value)
                            : null,
                        x.CoverageStatus);
                })
                .OrderBy(x => x.AssetTag)
                .ToArray(),
            contract.UpdatedAt,
            Etag(contract.Version));
    }

    private static async Task<IReadOnlyDictionary<Guid, DeviceDirectoryEntry>>
        ReadLinkedDevicesAsync(
            IReadOnlyCollection<Asset> assets,
            IDeviceDirectoryReader deviceReader,
            CancellationToken cancellationToken)
    {
        var ids = assets
            .Where(x => x.LinkedDeviceId.HasValue)
            .Select(x => x.LinkedDeviceId!.Value)
            .Distinct()
            .ToArray();
        return ids.Length == 0
            ? new Dictionary<Guid, DeviceDirectoryEntry>()
            : await deviceReader.ReadAsync(ids, cancellationToken);
    }

    private static bool CanAccessAsset(
        EffectiveAccess access,
        Asset asset,
        IReadOnlyDictionary<Guid, DeviceDirectoryEntry> devices)
    {
        if (access.AllResources)
        {
            return true;
        }

        if (asset.OrganizationUnitId is Guid organizationId
            && access.OrganizationIds.Contains(organizationId))
        {
            return true;
        }

        if (asset.LocationId is Guid locationId
            && access.LocationIds.Contains(locationId))
        {
            return true;
        }

        return asset.LinkedDeviceId is Guid deviceId
            && devices.TryGetValue(deviceId, out var device)
            && device.GroupIds.Any(access.DeviceGroupIds.Contains);
    }

    private static string DisplayStatus(
        DateTimeOffset endAt,
        DateTimeOffset now)
    {
        if (endAt < now)
        {
            return "expired";
        }

        return endAt <= now.AddDays(90)
            ? "expiring"
            : "active";
    }
    private static IResult? Validate(UpdateContractRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.FiscalYear)
            || request.FiscalYear.Trim().Length > 20)
        {
            errors["fiscalYear"] =
                ["Fiscal year is required and must be 20 characters or fewer."];
        }

        if (string.IsNullOrWhiteSpace(request.Vendor)
            || request.Vendor.Trim().Length > 180)
        {
            errors["vendor"] =
                ["Vendor is required and must be 180 characters or fewer."];
        }

        if (request.EndAt <= request.StartAt)
        {
            errors["endAt"] = ["End date must be after the start date."];
        }

        if (string.IsNullOrWhiteSpace(request.ServiceType)
            || request.ServiceType.Trim().Length > 180)
        {
            errors["serviceType"] =
                ["Service type is required and must be 180 characters or fewer."];
        }

        AddMax(errors, "serviceCondition", request.ServiceCondition, 500);
        AddMax(errors, "warrantyTerms", request.WarrantyTerms, 500);
        AddMax(errors, "contactName", request.ContactName, 160);
        AddMax(errors, "contactPhone", request.ContactPhone, 80);
        AddMax(errors, "contactEmail", request.ContactEmail, 180);

        if (!string.IsNullOrWhiteSpace(request.ContactEmail)
            && !request.ContactEmail.Contains('@'))
        {
            errors["contactEmail"] = ["Enter a valid support email."];
        }

        return errors.Count == 0
            ? null
            : Results.ValidationProblem(errors, title: "Validation failed");
    }

    private static void AddMax(
        IDictionary<string, string[]> errors,
        string key,
        string? value,
        int maximum)
    {
        if (value?.Trim().Length > maximum)
        {
            errors[key] = [$"Value must be {maximum} characters or fewer."];
        }
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        int currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (!TryReadVersion(raw, out var expected)
            || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Contract changed",
                detail: "Refresh the contract record and retry the save.");
        }

        return null;
    }

    private static bool TryReadVersion(string raw, out int version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal)
            && value.EndsWith('"'))
        {
            value = value[3..^1];
        }
        else if (value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        return int.TryParse(value, out version);
    }

    private static string Etag(int version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound() => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Contract not found",
        detail: "The requested contract does not exist.");

    public sealed record UpdateContractRequest(
        string FiscalYear,
        string Vendor,
        DateTimeOffset StartAt,
        DateTimeOffset EndAt,
        string ServiceType,
        string? ServiceCondition,
        string? WarrantyTerms,
        string? ContactName,
        string? ContactPhone,
        string? ContactEmail);

    private sealed record ContractListResponse(
        IReadOnlyList<ContractResponse> Items,
        int Page,
        int PageSize,
        int TotalItems,
        int TotalPages,
        ContractSummaryResponse Summary,
        IReadOnlyList<string> FiscalYears);

    private sealed record ContractSummaryResponse(
        int ActiveContracts,
        int ExpiringWithin90Days,
        int CoveredAssets,
        int UncoveredAssets);

    private sealed record ContractResponse(
        string Id,
        string ContractNumber,
        string FiscalYear,
        string Vendor,
        DateTimeOffset StartAt,
        DateTimeOffset EndAt,
        string ServiceType,
        string? ServiceCondition,
        string? WarrantyTerms,
        string? ContactName,
        string? ContactPhone,
        string? ContactEmail,
        string Status,
        int DaysRemaining,
        IReadOnlyList<CoveredAssetResponse> CoveredAssets,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record CoveredAssetResponse(
        string Id,
        string AssetTag,
        string Name,
        string BrandModel,
        string? Owner,
        string CoverageStatus);
}
