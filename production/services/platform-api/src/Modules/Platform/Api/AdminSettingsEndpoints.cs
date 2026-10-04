using INNO.One.Contracts;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Modules.Platform.Domain;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace INNO.One.Modules.Platform.Api;

public static class AdminSettingsEndpoints
{
    private static readonly string[] SupportedLocales = ["en-US", "th-TH"];

    public static RouteGroupBuilder MapAdminSettingsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/settings", GetSettingsAsync)
            .WithName("admin.settings.get");
        api.MapPatch("/admin/settings/localization", UpdateLocalizationAsync)
            .WithName("admin.settings.localization.update");
        return api;
    }

    private static async Task<IResult> GetSettingsAsync(
        HttpContext httpContext,
        IHostEnvironment environment,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.settings.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var localization = await GetLocalizationAsync(db, cancellationToken);
        var settings = BuildContractSettings(environment);

        return Results.Ok(new
        {
            configurationMode = "contract-and-deployment-managed-with-localization",
            mutableSettings = true,
            environment = environment.EnvironmentName,
            checkedAt = DateTimeOffset.UtcNow,
            groups = settings
                .Select(x => x.Group)
                .Distinct(StringComparer.Ordinal)
                .ToArray(),
            localization = ToLocalizationResponse(localization),
            items = settings
        });
    }

    private static async Task<IResult> UpdateLocalizationAsync(
        LocalizationUpdateRequest request,
        HttpContext httpContext,
        PlatformDbContext db,
        IAccessEvaluator accessEvaluator,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.settings.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        if (!SupportedLocales.Contains(request.DefaultLocale, StringComparer.Ordinal))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Unsupported locale",
                detail: "Default locale must be en-US or th-TH.");
        }

        var localization = await GetLocalizationAsync(db, cancellationToken);
        var precondition = ValidateIfMatch(httpContext, localization.Version);
        if (precondition is not null)
        {
            return precondition;
        }

        if (string.Equals(localization.DefaultLocale, request.DefaultLocale, StringComparison.Ordinal))
        {
            return Results.Ok(ToLocalizationResponse(localization));
        }

        var previousLocale = localization.DefaultLocale;
        localization.DefaultLocale = request.DefaultLocale;
        localization.Version += 1;
        localization.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Platform localization changed",
                detail: "Refresh Platform Settings and retry the save.");
        }

        await ledger.AppendAuditAsync(
            "platform.localization.default_locale_changed",
            "platform_localization",
            "default",
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                previousLocale,
                defaultLocale = localization.DefaultLocale,
                localization.Version
            },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Results.Ok(ToLocalizationResponse(localization));
    }

    private static async Task<PlatformLocalizationSettings> GetLocalizationAsync(
        PlatformDbContext db,
        CancellationToken cancellationToken)
    {
        var localization = await db.LocalizationSettings
            .SingleOrDefaultAsync(x => x.Id == 1, cancellationToken);
        if (localization is not null)
        {
            return localization;
        }

        localization = new PlatformLocalizationSettings
        {
            Id = 1,
            DefaultLocale = "en-US",
            Version = 1,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.LocalizationSettings.Add(localization);
        await db.SaveChangesAsync(cancellationToken);
        return localization;
    }

    private static PlatformLocalizationResponse ToLocalizationResponse(
        PlatformLocalizationSettings settings) =>
        new(
            settings.DefaultLocale,
            SupportedLocales,
            Etag(settings.Version),
            settings.UpdatedAt);

    private static PlatformSettingResponse[] BuildContractSettings(IHostEnvironment environment) =>
    [
        new(
            "api.base-path",
            "API",
            "Public API base path",
            ContractVersions.ApiBasePath,
            "API Contract",
            "frozen",
            "All public v1 resource APIs are rooted at the frozen API base path."),
        new(
            "api.authentication",
            "API",
            "Authentication contract",
            "Bearer JWT",
            "API Contract",
            "frozen",
            "Bearer JWT is the normal authenticated-user API contract."),
        new(
            "api.authorization",
            "API",
            "Authorization model",
            "Permission + resource scope",
            "Permission Scope Contract",
            "frozen",
            "Protected resources are authorized server-side using permission and resource scope."),
        new(
            "api.pagination",
            "API",
            "List pagination",
            "Page-number pagination",
            "API Contract",
            "frozen",
            "Page-number pagination is the v1 frozen list convention."),
        new(
            "api.errors",
            "API",
            "Error response format",
            "application/problem+json",
            "API Contract",
            "frozen",
            "Problem Details is the frozen v1 error contract."),
        new(
            "api.concurrency",
            "API",
            "Mutable configuration concurrency",
            "ETag / If-Match",
            "API Contract",
            "frozen",
            "Mutable configuration uses optimistic concurrency through ETag and If-Match."),
        new(
            "time.transport",
            "Time",
            "API timestamp transport",
            "ISO 8601 with timezone",
            "API Contract",
            "frozen",
            "APIs return timezone-aware ISO 8601 timestamps; clients convert to local display time."),
        new(
            "runtime.environment",
            "Runtime",
            "Hosting environment",
            environment.EnvironmentName,
            "Deployment",
            "effective",
            "The current ASP.NET Core hosting environment name. No environment secrets are exposed."),
        new(
            "contracts.design-system",
            "Contracts",
            "Design System",
            ContractVersions.DesignSystem,
            "Contract Versions",
            "frozen",
            "Current frozen Design System baseline."),
        new(
            "contracts.ui",
            "Contracts",
            "UI Contract",
            ContractVersions.UiContract,
            "Contract Versions",
            "frozen",
            "Current frozen UI contract version."),
        new(
            "contracts.api",
            "Contracts",
            "API Contract",
            ContractVersions.ApiContract,
            "Contract Versions",
            "frozen",
            "Current frozen API contract version."),
        new(
            "contracts.event-audit",
            "Contracts",
            "Event / Audit Contract",
            ContractVersions.EventAuditContract,
            "Contract Versions",
            "frozen",
            "Current frozen event and audit contract version."),
        new(
            "contracts.data-model",
            "Contracts",
            "Data Model Contract",
            ContractVersions.DataModelContract,
            "Contract Versions",
            "frozen",
            "Current frozen data-model contract version."),
        new(
            "contracts.implementation",
            "Contracts",
            "Implementation Contract",
            ContractVersions.ImplementationContract,
            "Contract Versions",
            "effective",
            "Current implementation contract version reported by this build.")
    ];

    private static IResult? ValidateIfMatch(HttpContext httpContext, long currentVersion)
    {
        var raw = httpContext.Request.Headers.IfMatch.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: "If-Match header required",
                detail: "Refresh Platform Settings and retry the save.");
        }

        if (!TryReadVersion(raw, out var expected) || expected != currentVersion)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Platform localization changed",
                detail: "Refresh Platform Settings and retry the save.");
        }

        return null;
    }

    private static bool TryReadVersion(string raw, out long version)
    {
        version = 0;
        var value = raw.Trim();
        if (value.StartsWith("W/\"", StringComparison.Ordinal) && value.EndsWith('"'))
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

    private sealed record LocalizationUpdateRequest(string DefaultLocale);

    private sealed record PlatformLocalizationResponse(
        string DefaultLocale,
        IReadOnlyList<string> SupportedLocales,
        string ETag,
        DateTimeOffset UpdatedAt);

    private sealed record PlatformSettingResponse(
        string Id,
        string Group,
        string Name,
        string Value,
        string Source,
        string Status,
        string Detail);
}
