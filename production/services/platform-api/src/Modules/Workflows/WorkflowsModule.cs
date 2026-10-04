using INNO.One.Modules.Workflows.Infrastructure;
using INNO.One.Modules.Workflows.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Modules.Workflows;

public static class WorkflowsModule
{
    public static IServiceCollection AddWorkflowsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<WorkflowsDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", WorkflowsDbContext.Schema))
            .UseSnakeCaseNamingConvention());
        services.AddScoped<WorkflowLedgerWriter>();
        services.AddHostedService<WorkflowExecutionWorker>();
        return services;
    }
}
