using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace INNO.One.Modules.Platform.Api;

public static class AdminDirectoryEndpoints
{
    public static RouteGroupBuilder MapAdminDirectoryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/overview", GetOverviewAsync).WithName("admin.overview.get");
        api.MapGet("/admin/organization/tree", GetOrganizationTreeAsync).WithName("admin.organization.tree");
        api.MapPost("/admin/organization/units", CreateOrganizationUnitAsync).WithName("admin.organization.create");
        api.MapPut("/admin/organization/units/{unitId}", UpdateOrganizationUnitAsync).WithName("admin.organization.update");
        api.MapGet("/admin/locations/tree", GetLocationsAsync).WithName("admin.locations.tree");
        api.MapPost("/admin/locations", CreateLocationAsync).WithName("admin.locations.create");
        api.MapPut("/admin/locations/{locationId}", UpdateLocationAsync).WithName("admin.locations.update");
        api.MapGet("/admin/positions", GetPositionsAsync).WithName("admin.positions.list");
        api.MapPost("/admin/positions", CreatePositionAsync).WithName("admin.positions.create");
        api.MapPut("/admin/positions/{positionId}", UpdatePositionAsync).WithName("admin.positions.update");
        api.MapGet("/admin/users", GetUsersAsync).WithName("admin.users.list");
        api.MapGet("/admin/users/{userId}", GetUserAsync).WithName("admin.users.get");
        api.MapPost("/admin/users", CreateUserAsync).WithName("admin.users.create");
        api.MapPut("/admin/users/{userId}", UpdateUserAsync).WithName("admin.users.update");
        return api;
    }

    private static async Task<IResult> GetOverviewAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.access", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var response = new AdminOverviewResponse(
            await db.OrganizationUnits.CountAsync(cancellationToken),
            await db.Locations.CountAsync(cancellationToken),
            await db.Positions.CountAsync(cancellationToken),
            await db.UserProfiles.CountAsync(cancellationToken),
            await db.Roles.CountAsync(cancellationToken),
            await db.AccessAssignments.CountAsync(cancellationToken));

        return Results.Ok(new ResourceResponse<AdminOverviewResponse>(response));
    }
    private static async Task<IResult> GetOrganizationTreeAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.organization.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var rows = await db.OrganizationUnits.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => new HierarchyItemResponse(
            OpaqueId.Format("org", x.Id),
            x.Code,
            x.Name,
            x.ParentUnitId is Guid parent ? OpaqueId.Format("org", parent) : null,
            x.Status,
            Etag(x.Version)))
            .ToArray();

        return Results.Ok(new { items });
    }

    private static async Task<IResult> CreateOrganizationUnitAsync(
        OrganizationUnitRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.organization.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var validation = await ValidateOrganizationRequestAsync(request, null, db, cancellationToken);
        if (validation.Error is not null) return validation.Error;

        var now = DateTimeOffset.UtcNow;
        var entity = new OrganizationUnit
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            ParentUnitId = validation.ParentId,
            Status = NormalizeStatus(request.Status),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        db.OrganizationUnits.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.organization.created",
            "organization_unit",
            OpaqueId.Format("org", entity.Id),
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { entity.Code, entity.Name, parentUnitId = request.ParentId, entity.Status },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Created(
            $"/api/v1/admin/organization/units/{OpaqueId.Format("org", entity.Id)}",
            new ResourceResponse<HierarchyItemResponse>(ToOrganizationResponse(entity)));
    }
    private static async Task<IResult> UpdateOrganizationUnitAsync(
        string unitId,
        OrganizationUnitRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.organization.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(unitId, "org", out var id)) return NotFound("Organization unit not found.");

        var entity = await db.OrganizationUnits.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound("Organization unit not found.");

        var stale = ValidateIfMatch(httpContext, entity.Version);
        if (stale is not null) return stale;

        var validation = await ValidateOrganizationRequestAsync(request, id, db, cancellationToken);
        if (validation.Error is not null) return validation.Error;
        if (validation.ParentId is Guid parent && await WouldCreateOrganizationCycleAsync(id, parent, db, cancellationToken))
        {
            return Conflict("Organization hierarchy would contain a cycle.");
        }

        var previous = new { entity.Code, entity.Name, entity.ParentUnitId, entity.Status };
        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.ParentUnitId = validation.ParentId;
        entity.Status = NormalizeStatus(request.Status);
        entity.Version++;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.organization.updated",
            "organization_unit",
            unitId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { previous, current = new { entity.Code, entity.Name, entity.ParentUnitId, entity.Status, entity.Version } },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Ok(new ResourceResponse<HierarchyItemResponse>(ToOrganizationResponse(entity)));
    }
    private static async Task<IResult> GetLocationsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.locations.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var rows = await db.Locations.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var items = rows.Select(x => new HierarchyItemResponse(
            OpaqueId.Format("loc", x.Id),
            x.Code,
            x.Name,
            x.ParentLocationId is Guid parent ? OpaqueId.Format("loc", parent) : null,
            x.Status,
            Etag(x.Version))).ToArray();

        return Results.Ok(new { items });
    }

    private static async Task<IResult> CreateLocationAsync(
        LocationRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.locations.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var validation = await ValidateLocationRequestAsync(request, null, db, cancellationToken);
        if (validation.Error is not null) return validation.Error;

        var now = DateTimeOffset.UtcNow;
        var entity = new Location
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            ParentLocationId = validation.ParentId,
            Status = NormalizeStatus(request.Status),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Locations.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.location.created",
            "location",
            OpaqueId.Format("loc", entity.Id),
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { entity.Code, entity.Name, parentLocationId = request.ParentId, entity.Status },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Created(
            $"/api/v1/admin/locations/{OpaqueId.Format("loc", entity.Id)}",
            new ResourceResponse<HierarchyItemResponse>(ToLocationResponse(entity)));
    }
    private static async Task<IResult> UpdateLocationAsync(
        string locationId,
        LocationRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.locations.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(locationId, "loc", out var id)) return NotFound("Location not found.");

        var entity = await db.Locations.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound("Location not found.");
        var stale = ValidateIfMatch(httpContext, entity.Version);
        if (stale is not null) return stale;

        var validation = await ValidateLocationRequestAsync(request, id, db, cancellationToken);
        if (validation.Error is not null) return validation.Error;
        if (validation.ParentId is Guid parent && await WouldCreateLocationCycleAsync(id, parent, db, cancellationToken))
        {
            return Conflict("Location hierarchy would contain a cycle.");
        }

        var previous = new { entity.Code, entity.Name, entity.ParentLocationId, entity.Status };
        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.ParentLocationId = validation.ParentId;
        entity.Status = NormalizeStatus(request.Status);
        entity.Version++;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.location.updated",
            "location",
            locationId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { previous, current = new { entity.Code, entity.Name, entity.ParentLocationId, entity.Status, entity.Version } },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Ok(new ResourceResponse<HierarchyItemResponse>(ToLocationResponse(entity)));
    }
    private static async Task<IResult> GetPositionsAsync(
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.positions.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        var items = await db.Positions.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new PositionResponse(
                OpaqueId.Format("pos", x.Id),
                x.Code,
                x.Name,
                x.Status,
                Etag(x.Version)))
            .ToListAsync(cancellationToken);
        return Results.Ok(new { items });
    }

    private static async Task<IResult> CreatePositionAsync(
        PositionRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.positions.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Code and name are required.");
        var code = request.Code.Trim();
        if (await db.Positions.AnyAsync(x => x.Code == code, cancellationToken))
            return Conflict("Position code already exists.");

        var now = DateTimeOffset.UtcNow;
        var entity = new Position
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Status = NormalizeStatus(request.Status),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Positions.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.position.created",
            "position",
            OpaqueId.Format("pos", entity.Id),
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { entity.Code, entity.Name, entity.Status },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Created(
            $"/api/v1/admin/positions/{OpaqueId.Format("pos", entity.Id)}",
            new ResourceResponse<PositionResponse>(ToPositionResponse(entity)));
    }
    private static async Task<IResult> UpdatePositionAsync(
        string positionId,
        PositionRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.positions.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(positionId, "pos", out var id)) return NotFound("Position not found.");
        var entity = await db.Positions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound("Position not found.");
        var stale = ValidateIfMatch(httpContext, entity.Version);
        if (stale is not null) return stale;
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Code and name are required.");

        var code = request.Code.Trim();
        if (await db.Positions.AnyAsync(x => x.Id != id && x.Code == code, cancellationToken))
            return Conflict("Position code already exists.");

        var previous = new { entity.Code, entity.Name, entity.Status };
        entity.Code = code;
        entity.Name = request.Name.Trim();
        entity.Status = NormalizeStatus(request.Status);
        entity.Version++;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.position.updated",
            "position",
            positionId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { previous, current = new { entity.Code, entity.Name, entity.Status, entity.Version } },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Ok(new ResourceResponse<PositionResponse>(ToPositionResponse(entity)));
    }
    private static async Task<IResult> GetUsersAsync(
        string? search,
        string? status,
        string? organizationId,
        int page,
        int pageSize,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.users.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 100);
        var query = db.UserProfiles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.FullName.ToLower().Contains(term)
                || x.EmployeeId.ToLower().Contains(term)
                || x.Email.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLower();
            query = query.Where(x => x.Status.ToLower() == normalized);
        }
        if (!string.IsNullOrWhiteSpace(organizationId))
        {
            if (!OpaqueId.TryParse(organizationId, "org", out var orgId))
                return BadRequest("Invalid organizationId.");
            query = query.Where(x => x.OrganizationUnitId == orgId);
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderBy(x => x.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var orgIds = rows.Where(x => x.OrganizationUnitId.HasValue).Select(x => x.OrganizationUnitId!.Value).Distinct().ToArray();
        var posIds = rows.Where(x => x.PositionId.HasValue).Select(x => x.PositionId!.Value).Distinct().ToArray();
        var locIds = rows.Where(x => x.LocationId.HasValue).Select(x => x.LocationId!.Value).Distinct().ToArray();

        var orgs = await db.OrganizationUnits.AsNoTracking().Where(x => orgIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var positions = await db.Positions.AsNoTracking().Where(x => posIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var locations = await db.Locations.AsNoTracking().Where(x => locIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var items = rows.Select(x => ToUserListResponse(x, orgs, positions, locations)).ToArray();
        return Results.Ok(new PagedResponse<UserListItemResponse>(
            items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }
    private static async Task<IResult> GetUserAsync(
        string userId,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.users.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(userId, "user", out var id)) return NotFound("User not found.");

        var profile = await db.UserProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (profile is null) return NotFound("User not found.");

        var response = await ToUserDetailResponseAsync(profile, db, cancellationToken);
        httpContext.Response.Headers.ETag = Etag(profile.Version);
        return Results.Ok(new ResourceResponse<UserDetailResponse>(response));
    }

    private static async Task<IResult> CreateUserAsync(
        UserCreateRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.users.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (string.IsNullOrWhiteSpace(request.KeycloakSubject)
            || string.IsNullOrWhiteSpace(request.EmployeeId)
            || string.IsNullOrWhiteSpace(request.FullName)
            || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("SSO subject, employee ID, full name and email are required.");
        }

        if (await db.UserProfiles.AnyAsync(
                x => x.KeycloakSubject == request.KeycloakSubject.Trim()
                    || x.EmployeeId == request.EmployeeId.Trim()
                    || x.Email == request.Email.Trim(),
                cancellationToken))
        {
            return Conflict("SSO subject, employee ID or email already exists.");
        }

        var references = await ResolveUserReferencesAsync(
            request.OrganizationId, request.PositionId, request.LocationId, db, cancellationToken);
        if (references.Error is not null) return references.Error;

        var now = DateTimeOffset.UtcNow;
        var entity = new UserProfile
        {
            Id = Guid.NewGuid(),
            KeycloakSubject = request.KeycloakSubject.Trim(),
            EmployeeId = request.EmployeeId.Trim(),
            FullName = request.FullName.Trim(),
            OrganizationUnitId = references.OrganizationId,
            PositionId = references.PositionId,
            LocationId = references.LocationId,
            Email = request.Email.Trim(),
            Phone = NullIfWhiteSpace(request.Phone),
            Office = NullIfWhiteSpace(request.Office),
            Status = NormalizeStatus(request.Status),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        db.UserProfiles.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.user.created",
            "user",
            OpaqueId.Format("user", entity.Id),
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { entity.EmployeeId, entity.Email, organizationId = request.OrganizationId, positionId = request.PositionId, locationId = request.LocationId, entity.Status },
            cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var response = await ToUserDetailResponseAsync(entity, db, cancellationToken);
        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Created(
            $"/api/v1/admin/users/{OpaqueId.Format("user", entity.Id)}",
            new ResourceResponse<UserDetailResponse>(response));
    }
    private static async Task<IResult> UpdateUserAsync(
        string userId,
        UserUpdateRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(httpContext.User, "admin.users.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        if (!OpaqueId.TryParse(userId, "user", out var id)) return NotFound("User not found.");

        var entity = await db.UserProfiles.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound("User not found.");
        var stale = ValidateIfMatch(httpContext, entity.Version);
        if (stale is not null) return stale;

        if (string.IsNullOrWhiteSpace(request.EmployeeId)
            || string.IsNullOrWhiteSpace(request.FullName)
            || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("Employee ID, full name and email are required.");
        }

        var employeeId = request.EmployeeId.Trim();
        var email = request.Email.Trim();
        if (await db.UserProfiles.AnyAsync(
                x => x.Id != id && (x.EmployeeId == employeeId || x.Email == email),
                cancellationToken))
        {
            return Conflict("Employee ID or email already exists.");
        }

        var references = await ResolveUserReferencesAsync(
            request.OrganizationId, request.PositionId, request.LocationId, db, cancellationToken);
        if (references.Error is not null) return references.Error;

        var previousStatus = entity.Status;
        var previous = new
        {
            entity.EmployeeId, entity.FullName, entity.Email,
            entity.OrganizationUnitId, entity.PositionId, entity.LocationId, entity.Status
        };

        entity.EmployeeId = employeeId;
        entity.FullName = request.FullName.Trim();
        entity.OrganizationUnitId = references.OrganizationId;
        entity.PositionId = references.PositionId;
        entity.LocationId = references.LocationId;
        entity.Email = email;
        entity.Phone = NullIfWhiteSpace(request.Phone);
        entity.Office = NullIfWhiteSpace(request.Office);
        entity.Status = NormalizeStatus(request.Status);
        entity.Version++;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await ledger.AppendAuditAsync(
            "platform.user.updated",
            "user",
            userId,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new { previous, current = new { entity.EmployeeId, entity.FullName, entity.Email, entity.OrganizationUnitId, entity.PositionId, entity.LocationId, entity.Status, entity.Version } },
            cancellationToken);
        if (!string.Equals(previousStatus, entity.Status, StringComparison.OrdinalIgnoreCase))
        {
            await ledger.AppendAuditAsync(
                "platform.user.status_changed",
                "user",
                userId,
                OpaqueId.Format("user", access.UserId),
                CorrelationId(httpContext),
                httpContext.TraceIdentifier,
                new { previousStatus, status = entity.Status, entity.Version },
                cancellationToken);
        }
        await tx.CommitAsync(cancellationToken);

        var response = await ToUserDetailResponseAsync(entity, db, cancellationToken);
        httpContext.Response.Headers.ETag = Etag(entity.Version);
        return Results.Ok(new ResourceResponse<UserDetailResponse>(response));
    }
    private static async Task<(Guid? ParentId, IResult? Error)> ValidateOrganizationRequestAsync(
        OrganizationUnitRequest request,
        Guid? existingId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return (null, BadRequest("Code and name are required."));

        var code = request.Code.Trim();
        if (await db.OrganizationUnits.AnyAsync(
                x => x.Code == code && (!existingId.HasValue || x.Id != existingId.Value),
                cancellationToken))
        {
            return (null, Conflict("Organization code already exists."));
        }

        if (string.IsNullOrWhiteSpace(request.ParentId)) return (null, null);
        if (!OpaqueId.TryParse(request.ParentId, "org", out var parentId))
            return (null, BadRequest("Invalid parent organization ID."));
        if (existingId == parentId) return (null, Conflict("Organization cannot be its own parent."));
        if (!await db.OrganizationUnits.AnyAsync(x => x.Id == parentId, cancellationToken))
            return (null, NotFound("Parent organization not found."));
        return (parentId, null);
    }

    private static async Task<(Guid? ParentId, IResult? Error)> ValidateLocationRequestAsync(
        LocationRequest request,
        Guid? existingId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return (null, BadRequest("Code and name are required."));

        var code = request.Code.Trim();
        if (await db.Locations.AnyAsync(
                x => x.Code == code && (!existingId.HasValue || x.Id != existingId.Value),
                cancellationToken))
        {
            return (null, Conflict("Location code already exists."));
        }

        if (string.IsNullOrWhiteSpace(request.ParentId)) return (null, null);
        if (!OpaqueId.TryParse(request.ParentId, "loc", out var parentId))
            return (null, BadRequest("Invalid parent location ID."));
        if (existingId == parentId) return (null, Conflict("Location cannot be its own parent."));
        if (!await db.Locations.AnyAsync(x => x.Id == parentId, cancellationToken))
            return (null, NotFound("Parent location not found."));
        return (parentId, null);
    }
    private static async Task<(Guid? OrganizationId, Guid? PositionId, Guid? LocationId, IResult? Error)> ResolveUserReferencesAsync(
        string? organizationId,
        string? positionId,
        string? locationId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        Guid? org = null;
        Guid? pos = null;
        Guid? loc = null;

        if (!string.IsNullOrWhiteSpace(organizationId))
        {
            if (!OpaqueId.TryParse(organizationId, "org", out var id))
                return (null, null, null, BadRequest("Invalid organization ID."));
            if (!await db.OrganizationUnits.AnyAsync(x => x.Id == id, cancellationToken))
                return (null, null, null, NotFound("Organization not found."));
            org = id;
        }
        if (!string.IsNullOrWhiteSpace(positionId))
        {
            if (!OpaqueId.TryParse(positionId, "pos", out var id))
                return (null, null, null, BadRequest("Invalid position ID."));
            if (!await db.Positions.AnyAsync(x => x.Id == id, cancellationToken))
                return (null, null, null, NotFound("Position not found."));
            pos = id;
        }
        if (!string.IsNullOrWhiteSpace(locationId))
        {
            if (!OpaqueId.TryParse(locationId, "loc", out var id))
                return (null, null, null, BadRequest("Invalid location ID."));
            if (!await db.Locations.AnyAsync(x => x.Id == id, cancellationToken))
                return (null, null, null, NotFound("Location not found."));
            loc = id;
        }

        return (org, pos, loc, null);
    }

    private static async Task<bool> WouldCreateOrganizationCycleAsync(
        Guid id,
        Guid parentId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var parents = await db.OrganizationUnits.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.ParentUnitId, cancellationToken);
        return WouldCreateCycle(id, parentId, parents);
    }

    private static async Task<bool> WouldCreateLocationCycleAsync(
        Guid id,
        Guid parentId,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var parents = await db.Locations.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => x.ParentLocationId, cancellationToken);
        return WouldCreateCycle(id, parentId, parents);
    }

    private static bool WouldCreateCycle(Guid id, Guid parentId, IReadOnlyDictionary<Guid, Guid?> parents)
    {
        var seen = new HashSet<Guid>();
        var current = (Guid?)parentId;
        while (current.HasValue && seen.Add(current.Value))
        {
            if (current.Value == id) return true;
            current = parents.TryGetValue(current.Value, out var parent) ? parent : null;
        }
        return false;
    }
    private static HierarchyItemResponse ToOrganizationResponse(OrganizationUnit x) =>
        new(
            OpaqueId.Format("org", x.Id),
            x.Code,
            x.Name,
            x.ParentUnitId is Guid parent ? OpaqueId.Format("org", parent) : null,
            x.Status,
            Etag(x.Version));

    private static HierarchyItemResponse ToLocationResponse(Location x) =>
        new(
            OpaqueId.Format("loc", x.Id),
            x.Code,
            x.Name,
            x.ParentLocationId is Guid parent ? OpaqueId.Format("loc", parent) : null,
            x.Status,
            Etag(x.Version));

    private static PositionResponse ToPositionResponse(Position x) =>
        new(OpaqueId.Format("pos", x.Id), x.Code, x.Name, x.Status, Etag(x.Version));

    private static UserListItemResponse ToUserListResponse(
        UserProfile x,
        IReadOnlyDictionary<Guid, string> organizations,
        IReadOnlyDictionary<Guid, string> positions,
        IReadOnlyDictionary<Guid, string> locations) =>
        new(
            OpaqueId.Format("user", x.Id),
            x.EmployeeId,
            x.FullName,
            x.Email,
            Reference(x.OrganizationUnitId, "org", organizations),
            Reference(x.PositionId, "pos", positions),
            Reference(x.LocationId, "loc", locations),
            x.Status,
            Etag(x.Version));

    private static async Task<UserDetailResponse> ToUserDetailResponseAsync(
        UserProfile x,
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        ReferenceResponse? organization = null;
        ReferenceResponse? position = null;
        ReferenceResponse? location = null;
        if (x.OrganizationUnitId is Guid orgId)
        {
            var org = await db.OrganizationUnits.AsNoTracking().SingleOrDefaultAsync(y => y.Id == orgId, cancellationToken);
            if (org is not null) organization = new ReferenceResponse(OpaqueId.Format("org", org.Id), org.Name);
        }
        if (x.PositionId is Guid posId)
        {
            var pos = await db.Positions.AsNoTracking().SingleOrDefaultAsync(y => y.Id == posId, cancellationToken);
            if (pos is not null) position = new ReferenceResponse(OpaqueId.Format("pos", pos.Id), pos.Name);
        }
        if (x.LocationId is Guid locId)
        {
            var loc = await db.Locations.AsNoTracking().SingleOrDefaultAsync(y => y.Id == locId, cancellationToken);
            if (loc is not null) location = new ReferenceResponse(OpaqueId.Format("loc", loc.Id), loc.Name);
        }

        var assignments = await (
            from assignment in db.AccessAssignments.AsNoTracking()
            join role in db.Roles.AsNoTracking() on assignment.RoleId equals role.Id
            where assignment.SubjectType == "user" && assignment.SubjectId == x.Id
            orderby role.Name
            select new UserAssignmentSummary(
                OpaqueId.Format("asg", assignment.Id),
                OpaqueId.Format("role", role.Id),
                role.Name,
                assignment.ScopeType,
                assignment.Status)
        ).ToListAsync(cancellationToken);

        return new UserDetailResponse(
            OpaqueId.Format("user", x.Id),
            x.KeycloakSubject,
            x.EmployeeId,
            x.FullName,
            x.Email,
            x.Phone,
            x.Office,
            organization,
            position,
            location,
            x.Status,
            assignments,
            Etag(x.Version));
    }

    private static ReferenceResponse? Reference(
        Guid? id,
        string prefix,
        IReadOnlyDictionary<Guid, string> names) =>
        id is Guid value && names.TryGetValue(value, out var name)
            ? new ReferenceResponse(OpaqueId.Format(prefix, value), name)
            : null;
    private static string NormalizeStatus(string? status) =>
        string.Equals(status, "inactive", StringComparison.OrdinalIgnoreCase)
            ? "inactive"
            : "active";

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult? ValidateIfMatch(HttpContext httpContext, long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match is required",
                detail: "Refresh this record and retry the save.");
        }
        if (!TryReadVersion(raw, out var expected) || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Record changed",
                detail: "Refresh this record and retry the save.");
        }
        return null;
    }

    private static bool TryReadVersion(string raw, out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal) && value.EndsWith('"'))
            value = value[3..^1];
        else if (value.StartsWith('"') && value.EndsWith('"'))
            value = value[1..^1];
        return long.TryParse(value, out version);
    }

    private static string Etag(long version) => $"W/\"{version}\"";
    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault() ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private static IResult BadRequest(string detail) => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Invalid request",
        detail: detail);

    private static IResult Conflict(string detail) => Results.Problem(
        statusCode: StatusCodes.Status409Conflict,
        title: "Conflict",
        detail: detail);

    private static IResult NotFound(string detail) => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Not found",
        detail: detail);

    private sealed record AdminOverviewResponse(
        int Organizations,
        int Locations,
        int Positions,
        int Users,
        int Roles,
        int AccessAssignments);

    private sealed record OrganizationUnitRequest(
        string Code,
        string Name,
        string? ParentId,
        string? Status);

    private sealed record LocationRequest(
        string Code,
        string Name,
        string? ParentId,
        string? Status);

    private sealed record PositionRequest(
        string Code,
        string Name,
        string? Status);

    private sealed record UserCreateRequest(
        string KeycloakSubject,
        string EmployeeId,
        string FullName,
        string Email,
        string? Phone,
        string? Office,
        string? OrganizationId,
        string? PositionId,
        string? LocationId,
        string? Status);

    private sealed record UserUpdateRequest(
        string EmployeeId,
        string FullName,
        string Email,
        string? Phone,
        string? Office,
        string? OrganizationId,
        string? PositionId,
        string? LocationId,
        string? Status);
    private sealed record HierarchyItemResponse(
        string Id,
        string Code,
        string Name,
        string? ParentId,
        string Status,
        string ETag);

    private sealed record PositionResponse(
        string Id,
        string Code,
        string Name,
        string Status,
        string ETag);

    private sealed record ReferenceResponse(string Id, string Name);

    private sealed record UserListItemResponse(
        string Id,
        string EmployeeId,
        string FullName,
        string Email,
        ReferenceResponse? Organization,
        ReferenceResponse? Position,
        ReferenceResponse? Location,
        string Status,
        string ETag);

    private sealed record UserAssignmentSummary(
        string Id,
        string RoleId,
        string RoleName,
        string ScopeType,
        string Status);

    private sealed record UserDetailResponse(
        string Id,
        string KeycloakSubject,
        string EmployeeId,
        string FullName,
        string Email,
        string? Phone,
        string? Office,
        ReferenceResponse? Organization,
        ReferenceResponse? Position,
        ReferenceResponse? Location,
        string Status,
        IReadOnlyList<UserAssignmentSummary> Assignments,
        string ETag);
}
