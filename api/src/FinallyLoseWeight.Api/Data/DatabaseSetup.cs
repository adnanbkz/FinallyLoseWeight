using FinallyLoseWeight.Api.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Data;

public static class DatabaseSetup
{
    public const string ConnectionStringName = "Default";

    /// <summary>Tag of the database health check (only <c>/health/db</c> runs it).</summary>
    public const string HealthCheckTag = "database";

    /// <summary>Registers <see cref="AppDbContext"/> on PostgreSQL (Npgsql) and the <c>/health/db</c> database check.</summary>
    public static IServiceCollection AddAppDatabase(this IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>((serviceProvider, options) =>
        {
            var connectionString = serviceProvider.GetRequiredService<IConfiguration>()
                .GetConnectionString(ConnectionStringName);
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"Falta la cadena de conexión 'ConnectionStrings:{ConnectionStringName}' (PostgreSQL).");
            }

            Configure(options, connectionString);
        });

        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database", tags: [HealthCheckTag]);

        return services;
    }

    /// <summary>Provider configuration shared by the application and the design-time factory.</summary>
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options
            // Neon (serverless) can drop idle connections; retry transient failures.
            .UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure())
            .UseSnakeCaseNamingConvention();

    /// <summary>Applies pending migrations when <c>Database:MigrateOnStartup</c> is true (the default).</summary>
    public static async Task MigrateDatabaseIfEnabledAsync(this WebApplication app)
    {
        if (!app.Services.GetRequiredService<IOptions<DatabaseSettings>>().Value.MigrateOnStartup)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }
}
