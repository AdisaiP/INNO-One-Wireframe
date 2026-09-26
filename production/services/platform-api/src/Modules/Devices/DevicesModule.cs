using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using INNO.One.Modules.Devices.Persistence;

namespace INNO.One.Modules.Devices;

public static class DevicesModule
{
    public static IServiceCollection AddDevicesModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<DevicesDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", DevicesDbContext.Schema)));

        return services;
    }
}
