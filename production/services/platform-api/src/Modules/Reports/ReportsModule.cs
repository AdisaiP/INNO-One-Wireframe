using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using INNO.One.Modules.Reports.Persistence;

namespace INNO.One.Modules.Reports;

public static class ReportsModule
{
    public static IServiceCollection AddReportsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<ReportsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", ReportsDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        return services;
    }
}
