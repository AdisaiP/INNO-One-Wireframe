using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using INNO.One.Contracts.Search;
using INNO.One.Modules.Assets.Application;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;

namespace INNO.One.Modules.Assets;

public static class AssetsModule
{
    public static IServiceCollection AddAssetsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AssetsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", AssetsDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<AssetsLedgerWriter>();
        services.AddScoped<AssetCustomFieldValueService>();
        services.AddScoped<IGlobalSearchProvider, AssetsGlobalSearchProvider>();
        return services;
    }
}
