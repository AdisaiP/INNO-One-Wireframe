using INNO.One.Contracts.Directory;
using INNO.One.Modules.Devices.Application;
using INNO.One.Modules.Devices.Infrastructure;
using INNO.One.Modules.Devices.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Modules.Devices;

public static class DevicesModule
{
    public static IServiceCollection AddDevicesModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<DevicesDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", DevicesDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IDeviceDirectoryReader, DeviceDirectoryReader>();
        services.AddScoped<DeviceLedgerWriter>();
        services.AddHostedService<DiscoveryScanWorker>();
        services.AddHostedService<MeshCentralSyncWorker>();

        return services;
    }
}
