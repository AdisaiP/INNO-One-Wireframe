using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Assets.Domain;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Assets.Api;

public static class SoftwareLicenseEndpoints
{
    public static RouteGroupBuilder MapSoftwareLicenseEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/assets/software-licenses", ListSoftwareLicensesAsync)
            .WithName("assets.licenses.list");
        api.MapPatch(
                "/assets/software-licenses/{licenseId}",
                UpdateSoftwareLicenseAsync)
            .WithName("assets.licenses.update");
        return api;
    }

    private static async Task<IResult> ListSoftwareLicensesAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        string? search,
        string? compliance,
        string? vendor,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.license.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var licenses = await db.SoftwareLicenses
            .AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Vendor)
            .ThenBy(x => x.ProductName)
            .ToListAsync(cancellationToken);

        var ids = licenses.Select(x => x.Id).ToArray();
        var allocations = await db.LicenseAllocations
            .AsNoTracking()
            .Where(x => ids.Contains(x.SoftwareLicenseId))
            .OrderByDescending(x => x.LastUsedAt)
            .ToListAsync(cancellationToken);

        var allocationsByLicense = allocations
            .GroupBy(x => x.SoftwareLicenseId)
            .ToDictionary(x => x.Key, x => x.ToArray());
        var usedByLicense = allocations
            .GroupBy(x => x.SoftwareLicenseId)
            .ToDictionary(x => x.Key, x => x.Sum(y => y.SeatCount));

        var allItems = licenses
            .Select(x => ToResponse(
                x,
                usedByLicense.GetValueOrDefault(x.Id),
                allocationsByLicense.GetValueOrDefault(
                    x.Id,
                    Array.Empty<LicenseAllocation>())))
            .ToArray();

        IEnumerable<SoftwareLicenseResponse> filtered = allItems;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            filtered = filtered.Where(x =>
                x.ProductName.Contains(q, StringComparison.OrdinalIgnoreCase)
                || x.Vendor.Contains(q, StringComparison.OrdinalIgnoreCase)
                || x.LicenseModel.Contains(q, StringComparison.OrdinalIgnoreCase)
                || (x.ContractReference?.Contains(
                        q,
                        StringComparison.OrdinalIgnoreCase)
                    ?? false));
        }

        if (!string.IsNullOrWhiteSpace(vendor)
            && !string.Equals(vendor, "all", StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(x =>
                string.Equals(
                    x.Vendor,
                    vendor,
                    StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(compliance)
            && !string.Equals(
                compliance,
                "all",
                StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(x =>
                string.Equals(
                    x.Compliance,
                    compliance,
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

        var summary = new SoftwareLicenseSummaryResponse(
            allItems.Length,
            allItems.Sum(x => x.EntitledSeats),
            allItems.Sum(x => x.UsedSeats),
            allItems.Count(x => x.Compliance == "overused"),
            allItems.Sum(x => x.EstimatedGapCost));

        var vendors = allItems
            .Select(x => x.Vendor)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return Results.Ok(new SoftwareLicenseListResponse(
            pageItems,
            page,
            pageSize,
            totalItems,
            totalPages,
            summary,
            vendors));
    }
    private static async Task<IResult> UpdateSoftwareLicenseAsync(
        string licenseId,
        UpdateSoftwareLicenseRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(licenseId, "license", out var id))
        {
            return NotFound();
        }

        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "assets.license.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var license = await db.SoftwareLicenses.SingleOrDefaultAsync(
            x => x.Id == id && x.Status == "active",
            cancellationToken);
        if (license is null)
        {
            return NotFound();
        }

        var precondition = ValidateIfMatch(httpContext, license.Version);
        if (precondition is not null)
        {
            return precondition;
        }

        var validation = Validate(request);
        if (validation is not null)
        {
            return validation;
        }

        var allocations = await db.LicenseAllocations
            .Where(x => x.SoftwareLicenseId == license.Id)
            .OrderByDescending(x => x.LastUsedAt)
            .ToListAsync(cancellationToken);
        var usedSeats = allocations.Sum(x => x.SeatCount);
        var previousEntitledSeats = license.EntitledSeats;
        var wasCompliant = usedSeats <= previousEntitledSeats;

        license.EntitledSeats = request.EntitledSeats;
        license.UnitPrice = request.UnitPrice;
        license.RenewalAt = request.RenewalAt;
        license.ContractReference = NormalizeOptional(request.ContractReference);
        license.LicenseModel = request.LicenseModel.Trim();
        license.Version++;
        license.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("license", license.Id);
        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await ledger.AppendAuditAsync(
            "assets.license.updated",
            "software_license",
            publicId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                license.ProductName,
                previousEntitledSeats,
                entitledSeats = license.EntitledSeats,
                usedSeats,
                license.UnitPrice,
                license.RenewalAt,
                license.ContractReference
            },
            cancellationToken,
            classification: "internal");

        if (wasCompliant && usedSeats > license.EntitledSeats)
        {
            await ledger.AppendOutboxAsync(
                "license.overused",
                "software_license",
                publicId,
                new
                {
                    licenseId = publicId,
                    entitledSeats = license.EntitledSeats,
                    usedSeats,
                    detectedAt = license.UpdatedAt
                },
                correlationId,
                null,
                httpContext.TraceIdentifier,
                cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        var response = ToResponse(license, usedSeats, allocations);
        httpContext.Response.Headers.ETag = response.ETag;
        return Results.Ok(new ResourceResponse<SoftwareLicenseResponse>(
            response));
    }

    private static SoftwareLicenseResponse ToResponse(
        SoftwareLicense license,
        int usedSeats,
        IReadOnlyCollection<LicenseAllocation> allocations)
    {
        var gap = Math.Max(usedSeats - license.EntitledSeats, 0);
        var estimatedGapCost = gap * (license.UnitPrice ?? 0m);

        return new SoftwareLicenseResponse(
            OpaqueId.Format("license", license.Id),
            license.ProductName,
            license.Vendor,
            license.LicenseModel,
            license.EntitledSeats,
            usedSeats,
            usedSeats > license.EntitledSeats ? "overused" : "compliant",
            license.EntitledSeats - usedSeats,
            license.UnitPrice,
            license.Currency,
            estimatedGapCost,
            license.RenewalAt,
            license.ContractReference,
            allocations.Select(x => new LicenseAllocationResponse(
                OpaqueId.Format("allocation", x.Id),
                x.AssetId.HasValue
                    ? OpaqueId.Format("asset", x.AssetId.Value)
                    : null,
                x.EndpointName,
                x.AssignedTo,
                x.SeatCount,
                x.LastUsedAt,
                x.UsageStatus,
                x.Source)).ToArray(),
            license.UpdatedAt,
            Etag(license.Version));
    }
    private static IResult? Validate(UpdateSoftwareLicenseRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (request.EntitledSeats < 0 || request.EntitledSeats > 1_000_000)
        {
            errors["entitledSeats"] =
                ["Entitled seats must be between 0 and 1,000,000."];
        }

        if (request.UnitPrice is < 0 or > 1_000_000_000m)
        {
            errors["unitPrice"] =
                ["Unit price must be between 0 and 1,000,000,000."];
        }

        if (string.IsNullOrWhiteSpace(request.LicenseModel)
            || request.LicenseModel.Trim().Length > 120)
        {
            errors["licenseModel"] =
                ["License model is required and must be 120 characters or fewer."];
        }

        if (request.ContractReference?.Trim().Length > 120)
        {
            errors["contractReference"] =
                ["Contract reference must be 120 characters or fewer."];
        }

        return errors.Count == 0
            ? null
            : Results.ValidationProblem(
                errors,
                title: "Validation failed");
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
                title: "Software license changed",
                detail: "Refresh the license record and retry the save.");
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
        title: "Software license not found",
        detail: "The requested software license does not exist.");

    public sealed record UpdateSoftwareLicenseRequest(
        int EntitledSeats,
        decimal? UnitPrice,
        DateTimeOffset? RenewalAt,
        string? ContractReference,
        string LicenseModel);

    private sealed record SoftwareLicenseListResponse(
        IReadOnlyList<SoftwareLicenseResponse> Items,
        int Page,
        int PageSize,
        int TotalItems,
        int TotalPages,
        SoftwareLicenseSummaryResponse Summary,
        IReadOnlyList<string> Vendors);

    private sealed record SoftwareLicenseSummaryResponse(
        int Products,
        int PurchasedSeats,
        int InstalledSeats,
        int OverusedProducts,
        decimal EstimatedGapCost);

    private sealed record SoftwareLicenseResponse(
        string Id,
        string ProductName,
        string Vendor,
        string LicenseModel,
        int EntitledSeats,
        int UsedSeats,
        string Compliance,
        int SeatBalance,
        decimal? UnitPrice,
        string Currency,
        decimal EstimatedGapCost,
        DateTimeOffset? RenewalAt,
        string? ContractReference,
        IReadOnlyList<LicenseAllocationResponse> Allocations,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record LicenseAllocationResponse(
        string Id,
        string? AssetId,
        string EndpointName,
        string? AssignedTo,
        int SeatCount,
        DateTimeOffset? LastUsedAt,
        string Status,
        string Source);
}
