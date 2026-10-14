using Npgsql;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// A throw-away PostgreSQL database with a unique name, created on the server given by
/// <c>FLW_TEST_CONNECTION</c> (default: localhost:5432, postgres/postgres) and dropped afterwards.
/// </summary>
public sealed class TestDatabase
{
    public const string ConnectionEnvironmentVariable = "FLW_TEST_CONNECTION";
    public const string DefaultServerConnection = "Host=localhost;Port=5432;Username=postgres;Password=postgres";

    private readonly string _serverConnectionString;

    public TestDatabase()
    {
        var server = new NpgsqlConnectionStringBuilder(
            Environment.GetEnvironmentVariable(ConnectionEnvironmentVariable) is { Length: > 0 } configured
                ? configured
                : DefaultServerConnection);

        // Admin connection: the configured database if any, else the 'postgres' maintenance database.
        server.Database = string.IsNullOrEmpty(server.Database) ? "postgres" : server.Database;
        _serverConnectionString = server.ConnectionString;

        Name = $"flw_test_{Guid.NewGuid():N}";
        ConnectionString = new NpgsqlConnectionStringBuilder(server.ConnectionString) { Database = Name }.ConnectionString;
    }

    /// <summary>Database name (<c>flw_test_&lt;guid&gt;</c>).</summary>
    public string Name { get; }

    /// <summary>Connection string of the test database (used as <c>ConnectionStrings:Default</c>).</summary>
    public string ConnectionString { get; }

    public Task CreateAsync() => ExecuteOnServerAsync($"CREATE DATABASE \"{Name}\"");

    /// <summary>Drops the database, closing any connection still open to it.</summary>
    public Task DropAsync() => ExecuteOnServerAsync($"DROP DATABASE IF EXISTS \"{Name}\" WITH (FORCE)");

    private async Task ExecuteOnServerAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
