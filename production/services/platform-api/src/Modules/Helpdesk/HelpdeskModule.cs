using INNO.One.Modules.Helpdesk.Infrastructure;
using INNO.One.Modules.Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Modules.Helpdesk;

public static class HelpdeskModule
{
    public static IServiceCollection AddHelpdeskModule(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<HelpdeskDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable(
                    "__ef_migrations_history",
                    HelpdeskDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<HelpdeskLedgerWriter>();
        return services;
    }
}
