using INNO.One.Contracts.Assets;
using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Search;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Assets.Application;
using INNO.One.Modules.Assets.Infrastructure;
using INNO.One.Modules.Assets.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
        services.AddScoped<IAssetsAutomationContextReader, AssetsAutomationContextReader>();
        services.AddScoped<IAutomationNodeExecutor, AssetsAutomationNodeExecutor>();
        services.AddScoped<AssetCustomFieldValueService>();
        services.AddScoped<IGlobalSearchProvider, AssetsGlobalSearchProvider>();
        services.AddScoped<IWorkspaceAttentionProvider, AssetsWorkspaceAttentionProvider>();
        services.AddScoped<IWorkspaceResourceVisibilityProvider, AssetsWorkspaceAttentionProvider>();
        return services;
    }
}
