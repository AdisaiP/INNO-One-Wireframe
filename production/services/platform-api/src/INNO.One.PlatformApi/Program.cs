using INNO.One.Contracts;
using INNO.One.Infrastructure;
using INNO.One.Modules.Assets;
using INNO.One.Modules.Devices;
using INNO.One.Modules.Helpdesk;
using INNO.One.Modules.Platform;
using INNO.One.Modules.Reports;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

var coreDatabase = builder.Configuration.GetConnectionString("CoreDatabase")
    ?? throw new InvalidOperationException("ConnectionStrings:CoreDatabase is required.");

builder.Services
    .AddPlatformModule(coreDatabase)
    .AddDevicesModule(coreDatabase)
    .AddAssetsModule(coreDatabase)
    .AddHelpdeskModule(coreDatabase)
    .AddReportsModule(coreDatabase)
    .AddInnoInfrastructure(coreDatabase);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Authentication:Authority"];
        options.Audience = builder.Configuration["Authentication:Audience"];
        options.RequireHttpsMetadata = builder.Configuration.GetValue("Authentication:RequireHttpsMetadata", true);
    });
builder.Services.AddAuthorization();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/health/live");
app.MapGet("/health/ready", () => Results.Ok(new
{
    service = "platform-api",
    apiBasePath = ContractVersions.ApiBasePath,
    implementationContract = ContractVersions.ImplementationContract
}));

app.Run();
