using INNO.One.Contracts.Api;
using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Identifiers;
using INNO.One.Contracts.Integrations;
using INNO.One.Modules.Platform.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace INNO.One.Modules.Platform.Api;

public static class AdminIntegrationsEndpoints
{
    public static RouteGroupBuilder MapAdminIntegrationsEndpoints(
        this RouteGroupBuilder api)
    {
        api.MapGet("/admin/integrations", ListIntegrationsAsync)
            .WithName("admin.integrations.list");
        api.MapPost("/admin/integrations/{integrationId}/test", TestIntegrationAsync)
            .WithName("admin.integrations.test");
        return api;
    }

    private static async Task<IResult> ListIntegrationsAsync(
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IIntegrationHealthProvider> providers,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.integrations.view",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var items = new List<IntegrationHealthSnapshot>();
        foreach (var provider in providers.OrderBy(x => x.Id, StringComparer.Ordinal))
        {
            items.Add(await provider.CheckAsync(cancellationToken));
        }

        return Results.Ok(new
        {
            items = items
                .OrderBy(x => x.Category, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .ToArray()
        });
    }

    private static async Task<IResult> TestIntegrationAsync(
        string integrationId,
        HttpContext httpContext,
        IAccessEvaluator accessEvaluator,
        IEnumerable<IIntegrationHealthProvider> providers,
        PlatformLedgerWriter ledger,
        CancellationToken cancellationToken)
    {
        var access = await accessEvaluator.EvaluateAsync(
            httpContext.User,
            "admin.integrations.manage",
            cancellationToken);
        if (!access.Allowed)
        {
            return Forbidden(access.Reason);
        }

        var provider = providers.FirstOrDefault(x =>
            string.Equals(x.Id, integrationId, StringComparison.OrdinalIgnoreCase));
        if (provider is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Integration not found");
        }

        var snapshot = await provider.CheckAsync(cancellationToken);
        if (!snapshot.CanTest)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Integration cannot be tested",
                detail: snapshot.Message);
        }

        await ledger.AppendAuditAsync(
            "platform.integration.tested",
            "integration",
            snapshot.Id,
            OpaqueId.Format("user", access.UserId),
            CorrelationId(httpContext),
            httpContext.TraceIdentifier,
            new
            {
                integrationId = snapshot.Id,
                provider = snapshot.Provider,
                ownerModule = snapshot.OwnerModule,
                status = snapshot.Status,
                durationMs = snapshot.DurationMs
            },
            cancellationToken);

        return Results.Ok(new ResourceResponse<IntegrationHealthSnapshot>(snapshot));
    }

    private static string CorrelationId(HttpContext context) =>
        context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
        ?? context.TraceIdentifier;

    private static IResult Forbidden(string reason) => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Access denied",
        detail: reason);
}
