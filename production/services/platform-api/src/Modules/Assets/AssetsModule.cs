using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using INNO.One.Modules.Assets.Persistence;

namespace INNO.One.Modules.Assets;

public static class AssetsModule
{
    public static IServiceCollection AddAssetsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AssetsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", AssetsDbContext.Schema)));

        return services;
    }
}
