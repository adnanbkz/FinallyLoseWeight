using FinallyLoseWeight.Api.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FinallyLoseWeight.Api.Data;

/// <summary>
/// Used by <c>dotnet ef</c> (migrations) so it does not need the application's configuration.
/// <c>dotnet ef database update</c> uses <c>FLW_DESIGN_CONNECTION</c> when set, otherwise a local database.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("FLW_DESIGN_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=flw_dev;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, connectionString);
        return new AppDbContext(options.Options, new NoCurrentUser());
    }

    private sealed class NoCurrentUser : ICurrentUser
    {
        public string? Uid => null;
    }
}
