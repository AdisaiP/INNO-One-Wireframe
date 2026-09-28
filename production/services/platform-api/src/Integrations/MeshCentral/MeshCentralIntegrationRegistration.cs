using INNO.One.Contracts.Integrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Integrations.MeshCentral;

public static class MeshCentralIntegrationRegistration
{
    public static IServiceCollection AddMeshCentralIntegration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<MeshCentralOptions>(
            configuration.GetSection(MeshCentralOptions.SectionName));
        services.AddSingleton<IRemoteDeviceEngine, MeshCentralRemoteDeviceEngine>();
        services.AddScoped<IIntegrationHealthProvider, MeshCentralIntegrationHealthProvider>();
        return services;
    }
}
