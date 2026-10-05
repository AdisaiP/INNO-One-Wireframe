using INNO.One.Contracts.Reports;
using INNO.One.Modules.Reports.Application;
using INNO.One.Modules.Reports.Infrastructure;
using INNO.One.Modules.Reports.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Modules.Reports;

public static class ReportsModule
{
    public static IServiceCollection AddReportsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<ReportsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", ReportsDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<ReportsLedgerWriter>();
        services.AddScoped<IReportGenerationService, ReportGenerationService>();
        services.AddHostedService<ReportScheduleWorker>();
        return services;
    }
}
