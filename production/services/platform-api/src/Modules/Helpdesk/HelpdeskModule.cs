using INNO.One.Contracts.Automation;
using INNO.One.Contracts.Helpdesk;
using INNO.One.Contracts.Reports;
using INNO.One.Contracts.Search;
using INNO.One.Contracts.Workspace;
using INNO.One.Modules.Helpdesk.Application;
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
        services.AddScoped<IHelpdeskAutomationTicketCreator, HelpdeskAutomationTicketCreator>();
        services.AddScoped<IReportSourceReader, HelpdeskReportSourceReader>();
        services.AddScoped<IAutomationNodeExecutor, HelpdeskAutomationNodeExecutor>();
        services.AddScoped<BusinessTimeCalculator>();
        services.AddScoped<IGlobalSearchProvider, HelpdeskGlobalSearchProvider>();
        services.AddScoped<IWorkspaceAttentionProvider, HelpdeskWorkspaceAttentionProvider>();
        services.AddScoped<IWorkspaceResourceVisibilityProvider, HelpdeskWorkspaceAttentionProvider>();
        services.AddHostedService<HelpdeskSlaAutomationWorker>();
        return services;
    }
}
