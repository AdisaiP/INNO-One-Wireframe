using INNO.One.Contracts.Audit;
using INNO.One.Contracts.Integrations;
using INNO.One.Infrastructure.Audit;
using INNO.One.Infrastructure.IntegrationHealth;
using INNO.One.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace INNO.One.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddInnoInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<InfrastructureDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", InfrastructureDbContext.MigrationsSchema))
            .UseSnakeCaseNamingConvention());

        var connection = new NpgsqlConnectionStringBuilder(connectionString);
        var port = connection.Port > 0 ? connection.Port : 5432;
        services.AddSingleton(new PostgreSqlIntegrationDescriptor(
            $"{connection.Host}:{port}/{connection.Database}"));
        services.AddScoped<IIntegrationHealthProvider, PostgreSqlIntegrationHealthProvider>();
        services.AddScoped<IAuditQueryService, AuditQueryService>();

        return services;
    }
}
