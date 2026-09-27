using System.Text.Json;
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

public static class AssetsEndpoints
{
    public static RouteGroupBuilder MapAssetsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/assets/overview", GetOverviewAsync)
            .WithName("assets.overview.get");
        api.MapGet("/assets", ListAssetsAsync)
            .WithName("assets.list");
        api.MapGet("/assets/{assetId}", GetAssetAsync)
            .WithName("assets.get");
        api.MapPatch("/assets/{assetId}", UpdateAssetAsync)
            .WithName("assets.update");
        api.MapGet("/assets/ownership", GetOwnershipAsync)
            .WithName("assets.ownership.list");
        api.MapPost("/assets/{assetId}/ownership", ChangeOwnershipAsync)
            .WithName("assets.ownership.change");
        api.MapGet("/assets/owners", ListOwnersAsync)
            .WithName("assets.owners.list");
        api.MapGet("/assets/owners/{userId}", GetOwnerAsync)
            .WithName("assets.owners.get");
        api.MapGet("/assets/ownership-submissions", ListOwnershipSubmissionsAsync)
            .WithName("assets.ownership_submissions.list");
        api.MapPost(
                "/assets/ownership-submissions/{submissionId}/decision",
                DecideOwnershipSubmissionAsync)
            .WithName("assets.ownership_submissions.decide");
        return api;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var visible = await GetVisibleAssetsAsync(
            db.Assets.AsNoTracking(),
            access,
            deviceReader,
            cancellationToken);
        var now = DateTimeOffset.UtcNow;

        var recent = visible
            .OrderByDescending(x => x.UpdatedAt)
            .Take(5)
            .Select(x => new AssetOverviewRecent(
                OpaqueId.Format("asset", x.Id),
                x.AssetTag,
                x.Name,
                x.Category,
                x.LifecycleStatus,
                x.UpdatedAt))
            .ToArray();

        return Results.Ok(new ResourceResponse<AssetOverviewResponse>(
            new AssetOverviewResponse(
                visible.Count,
                visible.Count(x => x.LifecycleStatus == "in_use"),
                visible.Count(x => x.LifecycleStatus == "stock"),
                visible.Count(x => x.LifecycleStatus == "repair"),
                visible.Count(x => !x.OwnerUserId.HasValue),
                visible.Count(x => x.WarrantyEndAt.HasValue
                    && x.WarrantyEndAt > now
                    && x.WarrantyEndAt <= now.AddDays(90)),
                recent)));
    }

    private static async Task<IResult> ListAssetsAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        string? search,
        string? category,
        string? status,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<Asset> query = db.Assets.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.AssetTag.ToLower().Contains(term)
                || x.Name.ToLower().Contains(term)
                || (x.SerialNumber != null && x.SerialNumber.ToLower().Contains(term))
                || (x.Brand != null && x.Brand.ToLower().Contains(term))
                || (x.Model != null && x.Model.ToLower().Contains(term)));
        }
        if (!string.IsNullOrWhiteSpace(category)
            && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.Category == category);
        }
        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.LifecycleStatus == status);
        }

        var visible = await GetVisibleAssetsAsync(
            query.OrderBy(x => x.AssetTag),
            access,
            deviceReader,
            cancellationToken);
        var total = visible.Count;
        var pageItems = visible
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArray();

        var directory = await ReadDirectoryAsync(
            pageItems,
            platformReader,
            cancellationToken);

        var items = pageItems
            .Select(x => ToListItem(x, directory))
            .ToArray();

        return Results.Ok(new PagedResponse<AssetListItemResponse>(
            items,
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static async Task<IResult> GetAssetAsync(
        string assetId,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        AssetCustomFieldValueService customFieldService,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(assetId, "asset", out var id))
        {
            return NotFound("Asset not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var asset = await db.Assets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (asset is null)
        {
            return NotFound("Asset not found.");
        }

        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var directory = await ReadDirectoryAsync(
            new[] { asset },
            platformReader,
            cancellationToken);
        var linkedDevice = await ReadLinkedDeviceAsync(
            asset,
            deviceReader,
            cancellationToken);
        var history = await db.AssetOwnershipHistory.AsNoTracking()
            .Where(x => x.AssetId == asset.Id)
            .OrderByDescending(x => x.EffectiveAt)
            .Take(20)
            .ToListAsync(cancellationToken);
        var historyUsers = history
            .SelectMany(x => new[] { x.PreviousOwnerUserId, x.OwnerUserId, (Guid?)x.ChangedByUserId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();
        var historyDirectory = await platformReader.ReadAsync(
            historyUsers,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);
        var customFields = await customFieldService.ReadForAssetAsync(
            asset.Id,
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(asset.Version);
        return Results.Ok(new ResourceResponse<AssetDetailResponse>(
            ToDetail(
                asset,
                directory,
                linkedDevice,
                history,
                historyDirectory,
                customFields)));
    }

    private static async Task<IResult> UpdateAssetAsync(
        string assetId,
        UpdateAssetRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        AssetCustomFieldValueService customFieldService,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(assetId, "asset", out var id))
        {
            return NotFound("Asset not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.manage",
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
            return NotFound("Asset not found.");
        }

        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var stale = ValidateIfMatch(httpContext, asset.Version, "Asset changed");
        if (stale is not null)
        {
            return stale;
        }

        if (request.LinkedDeviceId is not null)
        {
            if (request.LinkedDeviceId.Length == 0)
            {
                asset.LinkedDeviceId = null;
            }
            else if (!OpaqueId.TryParse(
                         request.LinkedDeviceId,
                         "dev",
                         out var linkedDeviceId))
            {
                return Validation(
                    "linkedDeviceId",
                    "Select a valid managed Device.");
            }
            else
            {
                var devices = await deviceReader.ReadAsync(
                    new[] { linkedDeviceId },
                    cancellationToken);
                if (!devices.ContainsKey(linkedDeviceId))
                {
                    return Validation(
                        "linkedDeviceId",
                        "Linked Device was not found.");
                }
                asset.LinkedDeviceId = linkedDeviceId;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            asset.Name = request.Name.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            asset.Category = request.Category.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.LifecycleStatus))
        {
            asset.LifecycleStatus = NormalizeStatus(request.LifecycleStatus);
        }
        if (request.PurchasePrice.HasValue)
        {
            if (request.PurchasePrice.Value < 0)
            {
                return Validation(
                    "purchasePrice",
                    "Purchase price cannot be negative.");
            }
            asset.PurchasePrice = request.PurchasePrice;
        }
        if (request.WarrantyEndAt.HasValue)
        {
            asset.WarrantyEndAt = request.WarrantyEndAt.Value.ToUniversalTime();
        }

        IReadOnlyList<string> changedCustomFields = Array.Empty<string>();
        if (request.CustomFields is not null)
        {
            var customFieldResult = await customFieldService.ApplyAsync(
                asset.Id,
                request.CustomFields,
                cancellationToken);
            if (!customFieldResult.IsValid)
            {
                return Results.ValidationProblem(
                    customFieldResult.Errors,
                    title: "Validation failed");
            }
            changedCustomFields = customFieldResult.ChangedKeys;
        }

        asset.Version++;
        asset.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var publicId = OpaqueId.Format("asset", asset.Id);
        var actorId = OpaqueId.Format("user", access.UserId);
        var correlationId = CorrelationId(httpContext);

        await ledger.AppendAuditAsync(
            "assets.asset.updated",
            "asset",
            publicId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                asset.AssetTag,
                asset.Category,
                status = asset.LifecycleStatus,
                linkedDeviceId = asset.LinkedDeviceId.HasValue
                    ? OpaqueId.Format("dev", asset.LinkedDeviceId.Value)
                    : null,
                customFieldKeys = changedCustomFields
            },
            cancellationToken,
            classification: "internal");
        await ledger.AppendOutboxAsync(
            "asset.changed",
            "asset",
            publicId,
            new
            {
                assetId = publicId,
                changeType = "asset_updated"
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var directory = await ReadDirectoryAsync(
            new[] { asset },
            platformReader,
            cancellationToken);
        var linkedDevice = await ReadLinkedDeviceAsync(
            asset,
            deviceReader,
            cancellationToken);
        var customFields = await customFieldService.ReadForAssetAsync(
            asset.Id,
            cancellationToken);

        httpContext.Response.Headers.ETag = Etag(asset.Version);
        return Results.Ok(new ResourceResponse<AssetDetailResponse>(
            ToDetail(
                asset,
                directory,
                linkedDevice,
                Array.Empty<AssetOwnershipHistory>(),
                new PlatformDirectorySnapshot(
                    new Dictionary<Guid, string>(),
                    new Dictionary<Guid, string>(),
                    new Dictionary<Guid, string>()),
                customFields)));
    }

    private static async Task<IResult> GetOwnershipAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var visible = await GetVisibleAssetsAsync(
            db.Assets.AsNoTracking(),
            access,
            deviceReader,
            cancellationToken);
        var visibleIds = visible.Select(x => x.Id).ToArray();
        var history = await db.AssetOwnershipHistory.AsNoTracking()
            .Where(x => visibleIds.Contains(x.AssetId))
            .OrderByDescending(x => x.EffectiveAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        var userIds = history
            .SelectMany(x => new[] { x.PreviousOwnerUserId, x.OwnerUserId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();
        var users = await platformReader.ReadAsync(
            userIds,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);
        var assets = visible.ToDictionary(x => x.Id);

        var pendingIds = await db.OwnershipSubmissions.AsNoTracking()
            .Where(x => x.Status == "pending")
            .Select(x => x.AssetId)
            .ToListAsync(cancellationToken);
        var visiblePending = pendingIds.Count(id => assets.ContainsKey(id));

        return Results.Ok(new ResourceResponse<OwnershipOverviewResponse>(
            new OwnershipOverviewResponse(
                visible.Count(x => x.OwnerUserId.HasValue),
                visible.Count(x => x.OwnerUserId.HasValue),
                visiblePending,
                visible.Count(x => !x.OwnerUserId.HasValue),
                history.Select(x => new OwnershipChangeResponse(
                    OpaqueId.Format("asset", x.AssetId),
                    assets.GetValueOrDefault(x.AssetId)?.AssetTag ?? "Asset",
                    x.PreviousOwnerUserId.HasValue
                        ? users.Users.GetValueOrDefault(x.PreviousOwnerUserId.Value)
                        : null,
                    x.OwnerUserId.HasValue
                        ? users.Users.GetValueOrDefault(x.OwnerUserId.Value)
                        : null,
                    x.ReasonCode,
                    x.EffectiveAt)).ToArray())));
    }

    private static async Task<IResult> ChangeOwnershipAsync(
        string assetId,
        ChangeOwnershipRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(assetId, "asset", out var id))
        {
            return NotFound("Asset not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.manage",
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
            return NotFound("Asset not found.");
        }
        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var stale = ValidateIfMatch(httpContext, asset.Version, "Asset changed");
        if (stale is not null)
        {
            return stale;
        }

        Guid? newOwnerId = null;
        DirectoryUserEntry? newOwner = null;
        if (!string.IsNullOrWhiteSpace(request.OwnerUserId))
        {
            if (!OpaqueId.TryParse(
                    request.OwnerUserId,
                    "user",
                    out var parsedOwner))
            {
                return Validation("ownerUserId", "Select a valid user.");
            }
            var users = await platformReader.ReadUsersAsync(
                new[] { parsedOwner },
                cancellationToken);
            if (!users.TryGetValue(parsedOwner, out newOwner)
                || !string.Equals(
                    newOwner.Status,
                    "active",
                    StringComparison.OrdinalIgnoreCase))
            {
                return Validation("ownerUserId", "Select an active user.");
            }
            newOwnerId = parsedOwner;
        }

        var previousOwner = asset.OwnerUserId;
        if (previousOwner == newOwnerId)
        {
            return Validation(
                "ownerUserId",
                "The selected owner is already assigned to this asset.");
        }

        var now = DateTimeOffset.UtcNow;
        asset.OwnerUserId = newOwnerId;
        if (newOwner is not null)
        {
            asset.OrganizationUnitId = newOwner.OrganizationUnitId
                ?? asset.OrganizationUnitId;
            asset.LocationId = newOwner.LocationId ?? asset.LocationId;
        }
        asset.Version++;
        asset.UpdatedAt = now;

        db.AssetOwnershipHistory.Add(new AssetOwnershipHistory
        {
            Id = Guid.NewGuid(),
            AssetId = asset.Id,
            PreviousOwnerUserId = previousOwner,
            OwnerUserId = newOwnerId,
            ChangedByUserId = access.UserId,
            ReasonCode = string.IsNullOrWhiteSpace(request.ReasonCode)
                ? "manual_assignment"
                : request.ReasonCode.Trim(),
            Note = string.IsNullOrWhiteSpace(request.Note)
                ? null
                : request.Note.Trim(),
            EffectiveAt = now
        });

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await WriteOwnershipLedgerAsync(
            asset,
            previousOwner,
            newOwnerId,
            access.UserId,
            request.ReasonCode ?? "manual_assignment",
            httpContext,
            ledger,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(asset.Version);
        return Results.Ok(new ResourceResponse<OwnershipChangeResult>(
            new OwnershipChangeResult(
                OpaqueId.Format("asset", asset.Id),
                newOwnerId.HasValue
                    ? OpaqueId.Format("user", newOwnerId.Value)
                    : null,
                now,
                Etag(asset.Version))));
    }

    private static async Task<IResult> ListOwnersAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        string? search,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var visible = await GetVisibleAssetsAsync(
            db.Assets.AsNoTracking(),
            access,
            deviceReader,
            cancellationToken);
        var grouped = visible
            .Where(x => x.OwnerUserId.HasValue)
            .GroupBy(x => x.OwnerUserId!.Value)
            .ToDictionary(x => x.Key, x => x.ToArray());

        var users = await platformReader.ReadUsersAsync(
            grouped.Keys.ToArray(),
            cancellationToken);
        var orgIds = users.Values
            .Where(x => x.OrganizationUnitId.HasValue)
            .Select(x => x.OrganizationUnitId!.Value)
            .Distinct()
            .ToArray();
        var directory = await platformReader.ReadAsync(
            users.Keys.ToArray(),
            orgIds,
            Array.Empty<Guid>(),
            cancellationToken);

        var rows = users.Values
            .Where(x => string.IsNullOrWhiteSpace(search)
                || x.FullName.Contains(search, StringComparison.OrdinalIgnoreCase)
                || x.EmployeeId.Contains(search, StringComparison.OrdinalIgnoreCase)
                || x.Email.Contains(search, StringComparison.OrdinalIgnoreCase))
            .Select(x =>
            {
                var owned = grouped.GetValueOrDefault(x.Id) ?? Array.Empty<Asset>();
                return new OwnerSummaryResponse(
                    OpaqueId.Format("user", x.Id),
                    x.FullName,
                    x.EmployeeId,
                    x.Email,
                    x.OrganizationUnitId.HasValue
                        ? directory.Organizations.GetValueOrDefault(x.OrganizationUnitId.Value)
                        : null,
                    owned.Length,
                    owned.MaxBy(a => a.UpdatedAt)?.UpdatedAt);
            })
            .OrderBy(x => x.FullName)
            .ToArray();

        var total = rows.Length;
        return Results.Ok(new PagedResponse<OwnerSummaryResponse>(
            rows.Skip((page - 1) * pageSize).Take(pageSize).ToArray(),
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static async Task<IResult> GetOwnerAsync(
        string userId,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(userId, "user", out var id))
        {
            return NotFound("Owner not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var visible = await GetVisibleAssetsAsync(
            db.Assets.AsNoTracking().Where(x => x.OwnerUserId == id),
            access,
            deviceReader,
            cancellationToken);
        if (visible.Count == 0)
        {
            return NotFound("Owner not found in your Asset scope.");
        }

        var users = await platformReader.ReadUsersAsync(
            new[] { id },
            cancellationToken);
        if (!users.TryGetValue(id, out var user))
        {
            return NotFound("Owner profile not found.");
        }

        var directory = await platformReader.ReadAsync(
            new[] { id },
            user.OrganizationUnitId.HasValue
                ? new[] { user.OrganizationUnitId.Value }
                : Array.Empty<Guid>(),
            user.LocationId.HasValue
                ? new[] { user.LocationId.Value }
                : Array.Empty<Guid>(),
            cancellationToken);

        return Results.Ok(new ResourceResponse<OwnerDetailResponse>(
            new OwnerDetailResponse(
                OpaqueId.Format("user", user.Id),
                user.FullName,
                user.EmployeeId,
                user.Email,
                user.OrganizationUnitId.HasValue
                    ? directory.Organizations.GetValueOrDefault(
                        user.OrganizationUnitId.Value)
                    : null,
                user.LocationId.HasValue
                    ? directory.Locations.GetValueOrDefault(user.LocationId.Value)
                    : null,
                visible.OrderBy(x => x.AssetTag)
                    .Select(x => new OwnerAssetResponse(
                        OpaqueId.Format("asset", x.Id),
                        x.AssetTag,
                        x.Name,
                        BrandModel(x),
                        x.LifecycleStatus,
                        x.UpdatedAt))
                    .ToArray())));
    }

    private static async Task<IResult> ListOwnershipSubmissionsAsync(
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        string? status,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var visible = await GetVisibleAssetsAsync(
            db.Assets.AsNoTracking(),
            access,
            deviceReader,
            cancellationToken);
        var assetMap = visible.ToDictionary(x => x.Id);
        var visibleIds = assetMap.Keys.ToArray();

        var query = db.OwnershipSubmissions.AsNoTracking()
            .Where(x => visibleIds.Contains(x.AssetId));
        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.Status == status);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(cancellationToken);
        var submissions = await query
            .OrderByDescending(x => x.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var userIds = submissions.Select(x => x.UserId).Distinct().ToArray();
        var users = await platformReader.ReadAsync(
            userIds,
            Array.Empty<Guid>(),
            Array.Empty<Guid>(),
            cancellationToken);

        return Results.Ok(new PagedResponse<OwnershipSubmissionResponse>(
            submissions.Select(x => new OwnershipSubmissionResponse(
                OpaqueId.Format("submission", x.Id),
                OpaqueId.Format("asset", x.AssetId),
                assetMap.GetValueOrDefault(x.AssetId)?.AssetTag ?? "Asset",
                OpaqueId.Format("user", x.UserId),
                users.Users.GetValueOrDefault(x.UserId) ?? "Unknown user",
                x.DeviceName,
                x.Possession,
                x.SubmittedLocation,
                SubmissionChanges(x.ChangesJson),
                x.Status,
                x.SubmittedAt,
                Etag(x.Version))).ToArray(),
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static async Task<IResult> DecideOwnershipSubmissionAsync(
        string submissionId,
        OwnershipDecisionRequest request,
        HttpContext httpContext,
        AssetsDbContext db,
        IAccessEvaluator accessEvaluator,
        IPlatformDirectoryReader platformReader,
        IDeviceDirectoryReader deviceReader,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(
                submissionId,
                "submission",
                out var id))
        {
            return NotFound("Ownership submission not found.");
        }

        var access = await RequireAsync(
            httpContext,
            accessEvaluator,
            "assets.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var submission = await db.OwnershipSubmissions.SingleOrDefaultAsync(
            x => x.Id == id,
            cancellationToken);
        if (submission is null)
        {
            return NotFound("Ownership submission not found.");
        }

        var asset = await db.Assets.SingleOrDefaultAsync(
            x => x.Id == submission.AssetId,
            cancellationToken);
        if (asset is null)
        {
            return NotFound("Asset not found.");
        }
        if (!await CanAccessAssetAsync(
                access,
                asset,
                deviceReader,
                cancellationToken))
        {
            return Forbidden("ASSET_OUTSIDE_SCOPE");
        }

        var stale = ValidateIfMatch(
            httpContext,
            submission.Version,
            "Ownership submission changed");
        if (stale is not null)
        {
            return stale;
        }

        var decision = request.Decision.Trim().ToLowerInvariant();
        if (decision is not ("confirmed" or "rejected"))
        {
            return Validation(
                "decision",
                "Decision must be confirmed or rejected.");
        }

        if (!string.Equals(
                submission.Status,
                "pending",
                StringComparison.OrdinalIgnoreCase))
        {
            return Validation(
                "decision",
                "This submission has already been reviewed.");
        }

        var now = DateTimeOffset.UtcNow;
        var previousOwner = asset.OwnerUserId;
        submission.Status = decision;
        submission.ReviewedByUserId = access.UserId;
        submission.ReviewedAt = now;
        submission.DecisionNote = string.IsNullOrWhiteSpace(request.Note)
            ? null
            : request.Note.Trim();
        submission.Version++;

        if (decision == "confirmed")
        {
            var users = await platformReader.ReadUsersAsync(
                new[] { submission.UserId },
                cancellationToken);
            if (!users.TryGetValue(submission.UserId, out var owner)
                || !string.Equals(
                    owner.Status,
                    "active",
                    StringComparison.OrdinalIgnoreCase))
            {
                return Validation(
                    "decision",
                    "Submitted user is no longer active.");
            }

            asset.OwnerUserId = submission.UserId;
            asset.OrganizationUnitId = owner.OrganizationUnitId
                ?? asset.OrganizationUnitId;
            asset.LocationId = owner.LocationId ?? asset.LocationId;
            asset.Version++;
            asset.UpdatedAt = now;

            db.AssetOwnershipHistory.Add(new AssetOwnershipHistory
            {
                Id = Guid.NewGuid(),
                AssetId = asset.Id,
                PreviousOwnerUserId = previousOwner,
                OwnerUserId = submission.UserId,
                ChangedByUserId = access.UserId,
                ReasonCode = "agent_confirmation",
                Note = submission.DecisionNote,
                EffectiveAt = now
            });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        if (decision == "confirmed")
        {
            await WriteOwnershipLedgerAsync(
                asset,
                previousOwner,
                submission.UserId,
                access.UserId,
                "agent_confirmation",
                httpContext,
                ledger,
                cancellationToken);
        }
        else
        {
            await ledger.AppendAuditAsync(
                "assets.ownership.changed",
                "asset",
                OpaqueId.Format("asset", asset.Id),
                OpaqueId.Format("user", access.UserId),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                new
                {
                    submissionId = OpaqueId.Format("submission", submission.Id),
                    decision = "rejected"
                },
                cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(submission.Version);
        return Results.Ok(new ResourceResponse<OwnershipDecisionResponse>(
            new OwnershipDecisionResponse(
                OpaqueId.Format("submission", submission.Id),
                submission.Status,
                submission.ReviewedAt,
                Etag(submission.Version))));
    }

    private static async Task<List<Asset>> GetVisibleAssetsAsync(
        IQueryable<Asset> query,
        EffectiveAccess access,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        var assets = await query.ToListAsync(cancellationToken);
        if (access.AllResources)
        {
            return assets;
        }

        var direct = assets
            .Where(x =>
                (x.OrganizationUnitId.HasValue
                    && access.OrganizationIds.Contains(
                        x.OrganizationUnitId.Value))
                || (x.LocationId.HasValue
                    && access.LocationIds.Contains(x.LocationId.Value)))
            .ToDictionary(x => x.Id);

        var remaining = assets
            .Where(x => !direct.ContainsKey(x.Id)
                && x.LinkedDeviceId.HasValue)
            .ToArray();
        if (remaining.Length > 0 && access.DeviceGroupIds.Count > 0)
        {
            var ids = remaining
                .Select(x => x.LinkedDeviceId!.Value)
                .Distinct()
                .ToArray();
            var devices = await deviceReader.ReadAsync(ids, cancellationToken);
            foreach (var asset in remaining)
            {
                if (asset.LinkedDeviceId is Guid deviceId
                    && devices.TryGetValue(deviceId, out var device)
                    && device.GroupIds.Any(access.DeviceGroupIds.Contains))
                {
                    direct[asset.Id] = asset;
                }
            }
        }

        return direct.Values.ToList();
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

    private static async Task<PlatformDirectorySnapshot> ReadDirectoryAsync(
        IEnumerable<Asset> assets,
        IPlatformDirectoryReader platformReader,
        CancellationToken cancellationToken)
    {
        var array = assets.ToArray();
        return await platformReader.ReadAsync(
            array.Where(x => x.OwnerUserId.HasValue)
                .Select(x => x.OwnerUserId!.Value)
                .Distinct()
                .ToArray(),
            array.Where(x => x.OrganizationUnitId.HasValue)
                .Select(x => x.OrganizationUnitId!.Value)
                .Distinct()
                .ToArray(),
            array.Where(x => x.LocationId.HasValue)
                .Select(x => x.LocationId!.Value)
                .Distinct()
                .ToArray(),
            cancellationToken);
    }

    private static async Task<DeviceDirectoryEntry?> ReadLinkedDeviceAsync(
        Asset asset,
        IDeviceDirectoryReader deviceReader,
        CancellationToken cancellationToken)
    {
        if (!asset.LinkedDeviceId.HasValue)
        {
            return null;
        }
        var devices = await deviceReader.ReadAsync(
            new[] { asset.LinkedDeviceId.Value },
            cancellationToken);
        return devices.GetValueOrDefault(asset.LinkedDeviceId.Value);
    }

    private static AssetListItemResponse ToListItem(
        Asset asset,
        PlatformDirectorySnapshot directory) =>
        new(
            OpaqueId.Format("asset", asset.Id),
            asset.AssetTag,
            asset.Name,
            asset.Category,
            BrandModel(asset),
            asset.SerialNumber,
            asset.OwnerUserId.HasValue
                ? directory.Users.GetValueOrDefault(asset.OwnerUserId.Value)
                : null,
            asset.OrganizationUnitId.HasValue
                ? directory.Organizations.GetValueOrDefault(
                    asset.OrganizationUnitId.Value)
                : null,
            asset.LocationId.HasValue
                ? directory.Locations.GetValueOrDefault(asset.LocationId.Value)
                : null,
            asset.LifecycleStatus,
            asset.RegisteredAt,
            asset.UpdatedAt);

    private static AssetDetailResponse ToDetail(
        Asset asset,
        PlatformDirectorySnapshot directory,
        DeviceDirectoryEntry? linkedDevice,
        IReadOnlyCollection<AssetOwnershipHistory> history,
        PlatformDirectorySnapshot historyDirectory,
        IReadOnlyList<AssetCustomFieldSnapshot> customFields) =>
        new(
            OpaqueId.Format("asset", asset.Id),
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
                    directory.Organizations.GetValueOrDefault(
                        asset.OrganizationUnitId.Value)
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
            asset.PurchasePrice,
            asset.RegisteredAt,
            asset.WarrantyEndAt,
            asset.Source,
            history.Select(x => new OwnershipHistoryResponse(
                OpaqueId.Format("ownership", x.Id),
                x.PreviousOwnerUserId.HasValue
                    ? historyDirectory.Users.GetValueOrDefault(
                        x.PreviousOwnerUserId.Value)
                    : null,
                x.OwnerUserId.HasValue
                    ? historyDirectory.Users.GetValueOrDefault(
                        x.OwnerUserId.Value)
                    : null,
                x.ReasonCode,
                x.Note,
                x.EffectiveAt)).ToArray(),
            customFields.Select(x => new AssetCustomFieldResponse(
                x.FieldKey,
                x.Label,
                x.FieldType,
                x.IsRequired,
                x.ShowInAgent,
                x.Options,
                x.Value)).ToArray(),
            asset.UpdatedAt,
            Etag(asset.Version));

    private static async Task WriteOwnershipLedgerAsync(
        Asset asset,
        Guid? previousOwner,
        Guid? owner,
        Guid actorUserId,
        string reasonCode,
        HttpContext httpContext,
        AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var publicAssetId = OpaqueId.Format("asset", asset.Id);
        var correlationId = CorrelationId(httpContext);
        var actorId = OpaqueId.Format("user", actorUserId);

        await ledger.AppendAuditAsync(
            "assets.ownership.changed",
            "asset",
            publicAssetId,
            actorId,
            correlationId,
            httpContext.TraceIdentifier,
            new
            {
                previousOwnerUserId = previousOwner.HasValue
                    ? OpaqueId.Format("user", previousOwner.Value)
                    : null,
                ownerUserId = owner.HasValue
                    ? OpaqueId.Format("user", owner.Value)
                    : null,
                reasonCode
            },
            cancellationToken);

        await ledger.AppendOutboxAsync(
            "ownership.changed",
            "asset",
            publicAssetId,
            new
            {
                assetId = publicAssetId,
                previousOwnerUserId = previousOwner.HasValue
                    ? OpaqueId.Format("user", previousOwner.Value)
                    : null,
                ownerUserId = owner.HasValue
                    ? OpaqueId.Format("user", owner.Value)
                    : null,
                effectiveAt = DateTimeOffset.UtcNow,
                reasonCode
            },
            correlationId,
            null,
            httpContext.TraceIdentifier,
            cancellationToken);
    }

    private static string[] SubmissionChanges(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Object
                ? document.RootElement.EnumerateObject()
                    .Select(x => x.Name)
                    .ToArray()
                : Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static string BrandModel(Asset asset) =>
        string.Join(
            " ",
            new[] { asset.Brand, asset.Model }
                .Where(x => !string.IsNullOrWhiteSpace(x)));

    private static string NormalizeStatus(string value) =>
        value.Trim().ToLowerInvariant() switch
        {
            "in use" => "in_use",
            "in_use" => "in_use",
            "stock" => "stock",
            "repair" => "repair",
            "retired" => "retired",
            _ => value.Trim().ToLowerInvariant()
        };

    private static Task<EffectiveAccess> RequireAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        string permission,
        CancellationToken cancellationToken) =>
        accessEvaluator.EvaluateAsync(
            httpContext.User,
            permission,
            cancellationToken);

    private static IResult? ValidateIfMatch(
        HttpContext httpContext,
        long currentVersion,
        string title)
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
                title: title,
                detail: "Refresh the resource and retry the action.");
        }
        return null;
    }

    private static bool TryReadVersion(string raw, out long version)
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
        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Resource not found",
        detail: detail);

    private static IResult Validation(string field, string detail) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]>
            {
                [field] = new[] { detail }
            },
            title: "Validation failed");

    public sealed record UpdateAssetRequest(
        string? Name,
        string? Category,
        string? LifecycleStatus,
        string? LinkedDeviceId,
        decimal? PurchasePrice,
        DateTimeOffset? WarrantyEndAt,
        IReadOnlyDictionary<string, JsonElement>? CustomFields);

    public sealed record ChangeOwnershipRequest(
        string? OwnerUserId,
        string? ReasonCode,
        string? Note);

    public sealed record OwnershipDecisionRequest(
        string Decision,
        string? Note);

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record AssetOverviewRecent(
        string Id,
        string AssetTag,
        string Name,
        string Category,
        string Status,
        DateTimeOffset UpdatedAt);

    private sealed record AssetOverviewResponse(
        int TotalAssets,
        int InUse,
        int InStock,
        int Repair,
        int Unassigned,
        int WarrantyExpiring,
        IReadOnlyList<AssetOverviewRecent> RecentAssets);

    private sealed record AssetListItemResponse(
        string Id,
        string AssetTag,
        string Name,
        string Category,
        string BrandModel,
        string? SerialNumber,
        string? Owner,
        string? Organization,
        string? Location,
        string Status,
        DateTimeOffset RegisteredAt,
        DateTimeOffset UpdatedAt);

    private sealed record LinkedDeviceResponse(
        string Id,
        string Name,
        string Status,
        string? OperatingSystem);

    private sealed record OwnershipHistoryResponse(
        string Id,
        string? PreviousOwner,
        string? Owner,
        string ReasonCode,
        string? Note,
        DateTimeOffset EffectiveAt);

    private sealed record AssetCustomFieldResponse(
        string FieldKey,
        string Label,
        string FieldType,
        bool IsRequired,
        bool ShowInAgent,
        IReadOnlyList<string> Options,
        JsonElement? Value);

    private sealed record AssetDetailResponse(
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
        decimal? PurchasePrice,
        DateTimeOffset RegisteredAt,
        DateTimeOffset? WarrantyEndAt,
        string Source,
        IReadOnlyList<OwnershipHistoryResponse> OwnershipHistory,
        IReadOnlyList<AssetCustomFieldResponse> CustomFields,
        DateTimeOffset UpdatedAt,
        string ETag);

    private sealed record OwnershipChangeResponse(
        string AssetId,
        string AssetTag,
        string? PreviousOwner,
        string? Owner,
        string ReasonCode,
        DateTimeOffset EffectiveAt);

    private sealed record OwnershipOverviewResponse(
        int AssignedAssets,
        int ConfirmedOwnership,
        int PendingSubmissions,
        int UnassignedAssets,
        IReadOnlyList<OwnershipChangeResponse> RecentChanges);

    private sealed record OwnershipChangeResult(
        string AssetId,
        string? OwnerUserId,
        DateTimeOffset EffectiveAt,
        string ETag);

    private sealed record OwnerSummaryResponse(
        string Id,
        string FullName,
        string EmployeeId,
        string Email,
        string? Organization,
        int AssetCount,
        DateTimeOffset? LastOwnershipAt);

    private sealed record OwnerAssetResponse(
        string Id,
        string AssetTag,
        string Name,
        string BrandModel,
        string Status,
        DateTimeOffset AssignedAt);

    private sealed record OwnerDetailResponse(
        string Id,
        string FullName,
        string EmployeeId,
        string Email,
        string? Organization,
        string? Location,
        IReadOnlyList<OwnerAssetResponse> Assets);

    private sealed record OwnershipSubmissionResponse(
        string Id,
        string AssetId,
        string AssetTag,
        string UserId,
        string UserName,
        string DeviceName,
        string Possession,
        string? SubmittedLocation,
        IReadOnlyList<string> Changes,
        string Status,
        DateTimeOffset SubmittedAt,
        string ETag);

    private sealed record OwnershipDecisionResponse(
        string Id,
        string Status,
        DateTimeOffset? ReviewedAt,
        string ETag);
}
