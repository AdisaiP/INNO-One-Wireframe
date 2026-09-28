using INNO.One.Contracts.Authorization;
using INNO.One.Contracts.Directory;
using INNO.One.Modules.Platform.Application;
using INNO.One.Modules.Platform.Infrastructure;
using INNO.One.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Modules.Platform;

public static class PlatformModule
{
    public static IServiceCollection AddPlatformModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<PlatformDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", PlatformDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IAccessEvaluator, AccessEvaluator>();
        services.AddScoped<IPlatformDirectoryReader, PlatformDirectoryReader>();
        services.AddScoped<PlatformLedgerWriter>();
        services.AddSingleton<ModuleManifestCatalog>();

        return services;
    }
}
