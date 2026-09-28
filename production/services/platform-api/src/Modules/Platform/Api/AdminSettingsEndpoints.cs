using INNO.One.Contracts;
using INNO.One.Contracts.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Hosting;

namespace INNO.One.Modules.Platform.Api;

public static class AdminSettingsEndpoints
{
    public static RouteGroupBuilder MapAdminSettingsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/settings", GetSettingsAsync)
            .WithName("admin.settings.get");
        return api;
    }

    private static async Task<IResult> GetSettingsAsync(
        HttpContext httpContext,
        IHostEnvironment environment,
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

        var settings = new[]
        {
            new PlatformSettingResponse(
                "api.base-path",
                "API",
                "Public API base path",
                ContractVersions.ApiBasePath,
                "API Contract",
                "frozen",
                "All public v1 resource APIs are rooted at the frozen API base path."),
            new PlatformSettingResponse(
                "api.authentication",
                "API",
                "Authentication contract",
                "Bearer JWT",
                "API Contract",
                "frozen",
                "Bearer JWT is the normal authenticated-user API contract."),
            new PlatformSettingResponse(
                "api.authorization",
                "API",
                "Authorization model",
                "Permission + resource scope",
                "Permission Scope Contract",
                "frozen",
                "Protected resources are authorized server-side using permission and resource scope."),
            new PlatformSettingResponse(
                "api.pagination",
                "API",
                "List pagination",
                "Page-number pagination",
                "API Contract",
                "frozen",
                "Page-number pagination is the v1 frozen list convention."),
            new PlatformSettingResponse(
                "api.errors",
                "API",
                "Error response format",
                "application/problem+json",
                "API Contract",
                "frozen",
                "Problem Details is the frozen v1 error contract."),
            new PlatformSettingResponse(
                "api.concurrency",
                "API",
                "Mutable configuration concurrency",
                "ETag / If-Match",
                "API Contract",
                "frozen",
                "Mutable configuration uses optimistic concurrency through ETag and If-Match."),
            new PlatformSettingResponse(
                "time.transport",
                "Time",
                "API timestamp transport",
                "ISO 8601 with timezone",
                "API Contract",
                "frozen",
                "APIs return timezone-aware ISO 8601 timestamps; clients convert to local display time."),
            new PlatformSettingResponse(
                "runtime.environment",
                "Runtime",
                "Hosting environment",
                environment.EnvironmentName,
                "Deployment",
                "effective",
                "The current ASP.NET Core hosting environment name. No environment secrets are exposed."),
            new PlatformSettingResponse(
                "contracts.design-system",
                "Contracts",
                "Design System",
                ContractVersions.DesignSystem,
                "Contract Versions",
                "frozen",
                "Current frozen Design System baseline."),
            new PlatformSettingResponse(
                "contracts.ui",
                "Contracts",
                "UI Contract",
                ContractVersions.UiContract,
                "Contract Versions",
                "frozen",
                "Current frozen UI contract version."),
            new PlatformSettingResponse(
                "contracts.api",
                "Contracts",
                "API Contract",
                ContractVersions.ApiContract,
                "Contract Versions",
                "frozen",
                "Current frozen API contract version."),
            new PlatformSettingResponse(
                "contracts.event-audit",
                "Contracts",
                "Event / Audit Contract",
                ContractVersions.EventAuditContract,
                "Contract Versions",
                "frozen",
                "Current frozen event and audit contract version."),
            new PlatformSettingResponse(
                "contracts.data-model",
                "Contracts",
                "Data Model Contract",
                ContractVersions.DataModelContract,
                "Contract Versions",
                "frozen",
                "Current frozen data-model contract version."),
            new PlatformSettingResponse(
                "contracts.implementation",
                "Contracts",
                "Implementation Contract",
                ContractVersions.ImplementationContract,
                "Contract Versions",
                "effective",
                "Current implementation contract version reported by this build.")
        };

        return Results.Ok(new
        {
            configurationMode = "contract-and-deployment-managed",
            mutableSettings = false,
            environment = environment.EnvironmentName,
            checkedAt = DateTimeOffset.UtcNow,
            groups = settings
                .Select(x => x.Group)
                .Distinct(StringComparer.Ordinal)
                .ToArray(),
            items = settings
        });
    }

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);

    private sealed record PlatformSettingResponse(
        string Id,
        string Group,
        string Name,
        string Value,
        string Source,
        string Status,
        string Detail);
}
