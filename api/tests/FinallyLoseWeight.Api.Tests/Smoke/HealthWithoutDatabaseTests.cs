using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;
using Npgsql;

namespace FinallyLoseWeight.Api.Tests.Smoke;

/// <summary><see cref="ApiFactory"/> whose connection string points to a database that does not exist.</summary>
public sealed class UnreachableDatabaseApiFactory : ApiFactory
{
    protected override void ConfigureSettings(IDictionary<string, string?> settings)
    {
        base.ConfigureSettings(settings);
        settings["ConnectionStrings:Default"] = new NpgsqlConnectionStringBuilder(ConnectionString)
        {
            Database = $"flw_missing_{Guid.NewGuid():N}",
        }.ConnectionString;
        settings["Database:MigrateOnStartup"] = "false";
    }
}

/// <summary>
/// The anonymous, unthrottled <c>/health</c> must not query the database: otherwise anyone could keep the
/// (serverless) database awake and use up its free compute quota.
/// </summary>
public class HealthWithoutDatabaseTests(UnreachableDatabaseApiFactory api) : IClassFixture<UnreachableDatabaseApiFactory>
{
    [Fact]
    public async Task Public_health_does_not_touch_the_database()
    {
        var response = await api.CreateAnonymousClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Database_health_reports_the_failure()
    {
        var response = await api.CreateClientFor(TestUser.Alice()).GetAsync("/health/db");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync());
    }
}
