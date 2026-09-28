using INNO.One.Contracts.Integrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Integrations.Keycloak;

public static class KeycloakIntegrationRegistration
{
    public static IServiceCollection AddKeycloakIntegration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpClient("inno-keycloak-health", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddScoped<IIntegrationHealthProvider, KeycloakIntegrationHealthProvider>();
        return services;
    }
}
