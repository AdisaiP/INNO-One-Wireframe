using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using INNO.One.Modules.Platform.Persistence;

namespace INNO.One.Modules.Platform;

public static class PlatformModule
{
    public static IServiceCollection AddPlatformModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<PlatformDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", PlatformDbContext.Schema)));

        return services;
    }
}
