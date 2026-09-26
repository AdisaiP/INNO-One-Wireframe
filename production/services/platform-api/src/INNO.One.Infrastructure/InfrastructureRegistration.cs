using INNO.One.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace INNO.One.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddInnoInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<InfrastructureDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", InfrastructureDbContext.MigrationsSchema)));

        return services;
    }
}
