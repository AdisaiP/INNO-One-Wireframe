using INNO.One.Contracts;
using INNO.One.MeetingService.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var meetingDatabase = builder.Configuration.GetConnectionString("MeetingDatabase")
    ?? throw new InvalidOperationException("ConnectionStrings:MeetingDatabase is required.");

builder.Services.AddDbContext<MeetingDbContext>(options =>
    options.UseNpgsql(meetingDatabase, npgsql =>
        npgsql.MigrationsHistoryTable("__ef_migrations_history", MeetingDbContext.Schema)));
builder.Services.AddDbContext<MeetingIntegrationDbContext>(options =>
    options.UseNpgsql(meetingDatabase, npgsql =>
        npgsql.MigrationsHistoryTable("__ef_migrations_history", MeetingIntegrationDbContext.Schema)));

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
    service = "meeting-service",
    apiBasePath = ContractVersions.ApiBasePath,
    dataModelContract = ContractVersions.DataModelContract
}));

app.Run();
