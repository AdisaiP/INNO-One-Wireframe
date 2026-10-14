using INNO.One.Contracts;
using INNO.One.Contracts.Integrations;
using INNO.One.Infrastructure;
using INNO.One.Infrastructure.Persistence;
using INNO.One.Integrations.Keycloak;
using INNO.One.Integrations.MeshCentral;
using INNO.One.Modules.Assets;
using INNO.One.Modules.Assets.Api;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using INNO.One.Modules.Devices;
using INNO.One.Modules.Devices.Api;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using INNO.One.Modules.Helpdesk;
using INNO.One.Modules.Helpdesk.Api;
using INNO.One.Modules.Helpdesk.Infrastructure;
using INNO.One.Modules.Helpdesk.Persistence;
using INNO.One.Modules.Platform;
using INNO.One.Modules.Platform.Api;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using INNO.One.Modules.Reports;
using INNO.One.Modules.Reports.Api;
using INNO.One.Modules.Reports.Persistence;
using INNO.One.Modules.Workflows;
using INNO.One.Modules.Workflows.Api;
using INNO.One.Modules.Workflows.Persistence;
using INNO.One.PlatformApi.Observability;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var coreDatabase = builder.Configuration.GetConnectionString("CoreDatabase")
    ?? throw new InvalidOperationException("ConnectionStrings:CoreDatabase is required.");

builder.Services
    .AddPlatformModule(coreDatabase)
    .AddDevicesModule(coreDatabase)
    .AddAssetsModule(coreDatabase)
    .AddHelpdeskModule(coreDatabase)
    .AddReportsModule(coreDatabase)
    .AddWorkflowsModule(coreDatabase)
    .AddInnoInfrastructure(coreDatabase);

builder.Services.AddKeycloakIntegration(builder.Configuration);
builder.Services.AddMeshCentralIntegration(builder.Configuration);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.Authority = builder.Configuration["Authentication:Authority"];
        options.Audience = builder.Configuration["Authentication:Audience"];
        options.RequireHttpsMetadata = builder.Configuration.GetValue("Authentication:RequireHttpsMetadata", true);
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    var agentOrigins = builder.Configuration
        .GetSection("EndpointAgent:AllowedOrigins")
        .Get<string[]>()
        ?? ["http://tauri.localhost"];

    options.AddPolicy("EndpointAgent", policy =>
        policy.WithOrigins(agentOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod());
});
builder.Services.AddHealthChecks();

var app = builder.Build();

if (builder.Configuration.GetValue("Database:ApplyMigrationsOnStartup", false))
{
    await using var scope = app.Services.CreateAsyncScope();

    var infrastructureDb = scope.ServiceProvider.GetRequiredService<InfrastructureDbContext>();
    var platformDb = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
    var devicesDb = scope.ServiceProvider.GetRequiredService<DevicesDbContext>();
    var assetsDb = scope.ServiceProvider.GetRequiredService<AssetsDbContext>();
    var helpdeskDb = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
    var reportsDb = scope.ServiceProvider.GetRequiredService<ReportsDbContext>();
    var workflowsDb = scope.ServiceProvider.GetRequiredService<WorkflowsDbContext>();

    await infrastructureDb.Database.MigrateAsync();
    await platformDb.Database.MigrateAsync();
    await devicesDb.Database.MigrateAsync();
    await assetsDb.Database.MigrateAsync();
    await helpdeskDb.Database.MigrateAsync();
    await reportsDb.Database.MigrateAsync();
    await workflowsDb.Database.MigrateAsync();

    if (app.Environment.IsDevelopment()
        && builder.Configuration.GetValue("DevelopmentSeed:Enabled", false))
    {
        await PlatformDevelopmentSeed.SeedAsync(platformDb);
        await DevicesDevelopmentSeed.SeedAsync(devicesDb);
        await AssetsDevelopmentSeed.SeedAsync(assetsDb);
        await HelpdeskDevelopmentSeed.SeedAsync(helpdeskDb);
    }
}

app.UseCors("EndpointAgent");
app.UseMiddleware<RequestContextMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live");
app.MapGet("/health/ready", async (
    IEnumerable<IIntegrationHealthProvider> providers,
    CancellationToken cancellationToken) =>
{
    var dependencies = await Task.WhenAll(
        providers.Select(provider => provider.CheckAsync(cancellationToken)));

    var requiredIds = new HashSet<string>(StringComparer.Ordinal)
    {
        "core-database",
        "keycloak"
    };

    var requiredPresent = requiredIds.All(id =>
        dependencies.Any(dependency => string.Equals(
            dependency.Id,
            id,
            StringComparison.Ordinal)));

    var requiredHealthy = dependencies
        .Where(dependency => requiredIds.Contains(dependency.Id))
        .All(dependency => string.Equals(
            dependency.Status,
            "connected",
            StringComparison.OrdinalIgnoreCase));

    var enabledOptionalHealthy = dependencies
        .Where(dependency => !requiredIds.Contains(dependency.Id) && dependency.Enabled)
        .All(dependency => string.Equals(
            dependency.Status,
            "connected",
            StringComparison.OrdinalIgnoreCase));

    var ready = requiredPresent && requiredHealthy && enabledOptionalHealthy;

    var payload = new
    {
        service = "platform-api",
        status = ready ? "ready" : "degraded",
        apiBasePath = ContractVersions.ApiBasePath,
        implementationContract = ContractVersions.ImplementationContract,
        dependencies = dependencies.Select(dependency => new
        {
            dependency.Id,
            dependency.Name,
            dependency.Status,
            dependency.Enabled,
            dependency.Configured,
            dependency.DurationMs,
            dependency.Message
        })
    };

    return ready
        ? Results.Ok(payload)
        : Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
});

var api = app.MapGroup(ContractVersions.ApiBasePath)
    .RequireAuthorization();

api.MapPlatformEndpoints();
api.MapOperationEndpoints();
api.MapWorkspaceEndpoints();
api.MapPlatformNotificationEndpoints();
api.MapGlobalSearchEndpoints();
api.MapAppRegistryEndpoints();
api.MapAdminDirectoryEndpoints();
api.MapAdminAccessEndpoints();
api.MapAdminIntegrationsEndpoints();
api.MapAdminAuditEndpoints();
api.MapAdminSecurityEndpoints();
api.MapAdminSettingsEndpoints();
api.MapDevicesEndpoints();
api.MapAgentDeviceEndpoints();
api.MapAgentTelemetryEndpoints();
api.MapDeviceEnrollmentEndpoints();
api.MapDeviceManagementEndpoints();
api.MapDeviceHardwareInventoryEndpoints();
api.MapDevicePerformanceNetworkEndpoints();
api.MapDeviceLiveOperationsEndpoints();
api.MapRemoteSessionEndpoints();
api.MapDeviceMaintenanceEndpoints();
api.MapDeviceGovernanceEndpoints();
api.MapDeviceAlertEndpoints();
api.MapDeviceActivityEndpoints();
api.MapDeviceSoftwareInventoryEndpoints();
api.MapInventoryQueryEndpoints();
api.MapAssetsEndpoints();
api.MapAgentAssetsEndpoints();
api.MapAssetsCustomFieldEndpoints();
api.MapAssetsQrEndpoints();
api.MapSoftwareLicenseEndpoints();
api.MapSoftwareBaselineEndpoints();
api.MapSoftwareBaselineEvaluationEndpoints();
api.MapContractsWarrantyEndpoints();
api.MapHelpdeskEndpoints();
api.MapHelpdeskSlaAutomationEndpoints();
api.MapReportsEndpoints();
api.MapWorkflowEndpoints();

app.Run();

public partial class Program { }
