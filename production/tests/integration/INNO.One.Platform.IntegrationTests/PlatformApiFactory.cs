using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace INNO.One.Platform.IntegrationTests;

public sealed class PlatformApiFactory : WebApplicationFactory<Program>
{
    public const string AuthenticationScheme = "IntegrationTest";

    public PlatformApiFactory(string connectionString)
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__CoreDatabase", connectionString);
        Environment.SetEnvironmentVariable("Database__ApplyMigrationsOnStartup", "false");
        Environment.SetEnvironmentVariable("DevelopmentSeed__Enabled", "false");
        Environment.SetEnvironmentVariable("MeshCentral__Enabled", "false");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("IntegrationTest");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IHostedService>();

            services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = AuthenticationScheme;
                    options.DefaultChallengeScheme = AuthenticationScheme;
                })
                .AddScheme<AuthenticationSchemeOptions, IntegrationTestAuthHandler>(
                    AuthenticationScheme,
                    _ => { });
        });
    }
}

public sealed class IntegrationTestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var subject = Request.Headers["X-Test-Subject"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var identity = new ClaimsIdentity(
            [new Claim("sub", subject)],
            PlatformApiFactory.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, PlatformApiFactory.AuthenticationScheme);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
