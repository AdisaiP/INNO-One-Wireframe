using System.Text.Json;
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

public static class SoftwareBaselineEndpoints
{
    public static RouteGroupBuilder MapSoftwareBaselineEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/assets/software-baselines", ListAsync).WithName("assets.baselines.list");
        api.MapPost("/assets/software-baselines", CreateAsync).WithName("assets.baselines.create");
        api.MapGet("/assets/software-baselines/{baselineId}", GetAsync).WithName("assets.baselines.get");
        api.MapPatch("/assets/software-baselines/{baselineId}", UpdateAsync).WithName("assets.baselines.update");
        return api;
    }

    private static async Task<IResult> ListAsync(HttpContext http, AssetsDbContext db,
        IAccessEvaluator evaluator, string? search, string? status,
        CancellationToken cancellationToken)
    {
        var access = await evaluator.EvaluateAsync(http.User, "assets.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        var rows = await db.SoftwareBaselines.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var results = await db.SoftwareBaselineResults.AsNoTracking().ToListAsync(cancellationToken);
        var filtered = rows.Where(x =>
            (string.IsNullOrWhiteSpace(search) || x.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase)
                || x.Code.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase))
            && (string.IsNullOrWhiteSpace(status) || status == "all" || x.Status == status))
            .Select(x => ToResponse(x, EvaluationStatus(x, results.Where(r => r.BaselineId == x.Id))))
            .ToArray();
        return Results.Ok(new { items = filtered, totalItems = filtered.Length });
    }

    private static async Task<IResult> GetAsync(string baselineId, HttpContext http,
        AssetsDbContext db, IAccessEvaluator evaluator, CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(baselineId, "baseline", out var id)) return NotFound();
        var access = await evaluator.EvaluateAsync(http.User, "assets.view", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        var row = await db.SoftwareBaselines.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var hasResults = await db.SoftwareBaselineResults.AsNoTracking()
            .AnyAsync(x => x.BaselineId == id, cancellationToken);
        var response = ToResponse(row, hasResults ? "stale" : "not_evaluated");
        http.Response.Headers.ETag = response.ETag;
        return Results.Ok(new ResourceResponse<BaselineResponse>(response));
    }

    private static async Task<IResult> CreateAsync(BaselineRequest request, HttpContext http,
        AssetsDbContext db, IAccessEvaluator evaluator, AssetsLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await evaluator.EvaluateAsync(http.User, "assets.baseline.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        var error = Validate(request, requireCode: true);
        if (error is not null) return error;
        var code = request.Code!.Trim().ToUpperInvariant();
        if (await db.SoftwareBaselines.AnyAsync(x => x.Code == code, cancellationToken))
            return Results.Conflict(new { code = "BASELINE_CODE_EXISTS" });
        var now = DateTimeOffset.UtcNow;
        var row = new SoftwareBaseline {
            Id = Guid.NewGuid(), Code = code, Name = request.Name.Trim(),
            TargetCategory = Normalize(request.TargetCategory),
            RequiredPackagesJson = JsonSerializer.Serialize(NormalizePackages(request.RequiredPackages)),
            Status = request.Status, Version = 1, CreatedAt = now, UpdatedAt = now
        };
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.SoftwareBaselines.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        await AuditAsync("assets.baseline.created", row, http, access.UserId, ledger, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var response = ToResponse(row, "not_evaluated");
        http.Response.Headers.ETag = response.ETag;
        return Results.Created("/api/v1/assets/software-baselines/" + response.Id,
            new ResourceResponse<BaselineResponse>(response));
    }

    private static async Task<IResult> UpdateAsync(string baselineId, BaselineRequest request,
        HttpContext http, AssetsDbContext db, IAccessEvaluator evaluator,
        AssetsLedgerWriter ledger, CancellationToken cancellationToken)
    {
        if (!OpaqueId.TryParse(baselineId, "baseline", out var id)) return NotFound();
        var access = await evaluator.EvaluateAsync(http.User, "assets.baseline.manage", cancellationToken);
        if (!access.Allowed) return Forbidden(access.Reason);
        var row = await db.SoftwareBaselines.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var expected = "W/\"" + row.Version + "\"";
        if (http.Request.Headers.IfMatch.FirstOrDefault() != expected)
            return Results.Problem(statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Software baseline changed", detail: "Refresh the baseline and retry.");
        var error = Validate(request, requireCode: false);
        if (error is not null) return error;
        row.Name = request.Name.Trim();
        row.TargetCategory = Normalize(request.TargetCategory);
        row.RequiredPackagesJson = JsonSerializer.Serialize(NormalizePackages(request.RequiredPackages));
        row.Status = request.Status;
        row.Version++;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AuditAsync("assets.baseline.updated", row, http, access.UserId, ledger, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var hasResults = await db.SoftwareBaselineResults.AsNoTracking()
            .AnyAsync(x => x.BaselineId == id, cancellationToken);
        var response = ToResponse(row, hasResults ? "stale" : "not_evaluated");
        http.Response.Headers.ETag = response.ETag;
        return Results.Ok(new ResourceResponse<BaselineResponse>(response));
    }

    private static async Task AuditAsync(string action, SoftwareBaseline row, HttpContext http,
        Guid userId, AssetsLedgerWriter ledger, CancellationToken cancellationToken) =>
        await ledger.AppendAuditAsync(action, "software_baseline",
            OpaqueId.Format("baseline", row.Id), OpaqueId.Format("user", userId),
            http.Request.Headers["X-Correlation-Id"].FirstOrDefault() ?? http.TraceIdentifier,
            http.TraceIdentifier, new { row.Code, row.Status, row.TargetCategory },
            cancellationToken, classification: "internal");

    private static IResult? Validate(BaselineRequest request, bool requireCode)
    {
        var errors = new Dictionary<string, string[]>();
        if (requireCode && (string.IsNullOrWhiteSpace(request.Code)
            || request.Code.Trim().Length > 64
            || !System.Text.RegularExpressions.Regex.IsMatch(request.Code.Trim(), "^[A-Za-z0-9_-]+$")))
            errors["code"] = ["Code must contain 1–64 letters, digits, underscores or hyphens."];
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 180)
            errors["name"] = ["Name is required and must be 180 characters or fewer."];
        if (request.TargetCategory?.Trim().Length > 80)
            errors["targetCategory"] = ["Target category must be 80 characters or fewer."];
        if (request.RequiredPackages is null || request.RequiredPackages.Length is < 1 or > 30
            || request.RequiredPackages.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 180)
            || NormalizePackages(request.RequiredPackages).Length != request.RequiredPackages.Length)
            errors["requiredPackages"] = ["Provide 1–30 unique software names, each 180 characters or fewer."];
        if (request.Status is not ("draft" or "active" or "inactive"))
            errors["status"] = ["Status must be draft, active or inactive."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string[] NormalizePackages(string[]? values) =>
        (values ?? []).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    private static string EvaluationStatus(
        SoftwareBaseline row,
        IEnumerable<SoftwareBaselineResult> results)
    {
        var array = results.ToArray();
        if (array.Length == 0) return "not_evaluated";
        return array.Any(x => x.BaselineVersion != row.Version) ? "stale" : "current";
    }

    private static BaselineResponse ToResponse(SoftwareBaseline row, string evaluationStatus) =>
        new(OpaqueId.Format("baseline", row.Id), row.Code, row.Name, row.TargetCategory,
            JsonSerializer.Deserialize<string[]>(row.RequiredPackagesJson) ?? [], row.Status,
            evaluationStatus, row.UpdatedAt, "W/\"" + row.Version + "\"");
    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: 403, title: "Access denied", detail: reason);
    private static IResult NotFound() => Results.Problem(
        statusCode: 404, title: "Software baseline not found");

    public sealed record BaselineRequest(string? Code, string Name, string? TargetCategory,
        string[] RequiredPackages, string Status);
    private sealed record BaselineResponse(string Id, string Code, string Name,
        string? TargetCategory, string[] RequiredPackages, string Status,
        string EvaluationStatus, DateTimeOffset UpdatedAt, string ETag);
}
