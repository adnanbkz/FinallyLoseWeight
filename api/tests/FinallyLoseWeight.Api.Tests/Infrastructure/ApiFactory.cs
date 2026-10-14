using System.Net.Http.Headers;
using System.Net.Http.Json;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Features.Profile;
using FinallyLoseWeight.Api.Firebase;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// Runs the real API in memory against its own PostgreSQL database.
/// <list type="bullet">
/// <item>Use it as a class fixture: <c>public class MyTests(ApiFactory api) : IClassFixture&lt;ApiFactory&gt;</c>.
/// One database per test class; every <see cref="TestUser"/> factory call gets a fresh UID, so tests in the
/// same class do not interfere.</item>
/// <item>Environment <c>Testing</c> (production-like: no OpenAPI, no exception details); migrations are applied
/// on startup by the app itself (<c>Database:MigrateOnStartup</c>).</item>
/// <item>Configuration: <see cref="TestTokens.ProjectId"/>, allowlist <see cref="TestUser.AllowedEmailsSetting"/>,
/// CORS origin <see cref="CorsOrigin"/>, a high rate limit. Override <see cref="ConfigureSettings"/> in a subclass
/// to change any key (e.g. a low <c>RateLimit:PermitsPerMinute</c>).</item>
/// <item>The Firebase Admin SDK (user checks and deletion) is replaced by <see cref="FirebaseUsers"/>.</item>
/// </list>
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string CorsOrigin = "http://localhost:5173";

    private readonly TestDatabase _database = new();

    /// <summary>Fake Firebase users: records the users the API deleted (<c>DELETE /api/me</c>).</summary>
    public FakeFirebaseUsers FirebaseUsers { get; } = new();

    /// <summary>Connection string of this fixture's database.</summary>
    public string ConnectionString => _database.ConnectionString;

    /// <summary>Configuration applied on top of appsettings.json. Call the base method when overriding.</summary>
    protected virtual void ConfigureSettings(IDictionary<string, string?> settings)
    {
        settings["ConnectionStrings:Default"] = _database.ConnectionString;
        settings["Firebase:ProjectId"] = TestTokens.ProjectId;
        settings["Firebase:ServiceAccountJson"] = string.Empty;
        settings["Access:AllowedEmails"] = TestUser.AllowedEmailsSetting;
        settings["Cors:AllowedOrigins"] = CorsOrigin;
        settings["Privacy:CurrentVersion"] = "1";
        settings["Security:ReauthMaxAgeMinutes"] = "5";
        settings["RateLimit:PermitsPerMinute"] = "10000";
        settings["Database:MigrateOnStartup"] = "true";
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var settings = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        ConfigureSettings(settings);

        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(settings));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IFirebaseUsers>();
            services.AddSingleton<IFirebaseUsers>(FirebaseUsers);
            services.PostConfigure<JwtBearerOptions>(
                JwtBearerDefaults.AuthenticationScheme, TestTokens.TrustTestSigningKey);
        });
    }

    /// <summary>Creates the database and starts the app (which applies the migrations).</summary>
    public async Task InitializeAsync()
    {
        await _database.CreateAsync();
        _ = Server;
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        await _database.DropAsync();
    }

    /// <summary>Client without <c>Authorization</c> header.</summary>
    public HttpClient CreateAnonymousClient() => CreateClient();

    /// <summary>Client sending a valid token for <paramref name="user"/> (optionally customized, see <see cref="TestTokens"/>).</summary>
    public HttpClient CreateClientFor(TestUser user, Func<TokenSpec, TokenSpec>? customizeToken = null) =>
        CreateClientWithToken(TestTokens.Create(user, customizeToken));

    /// <summary>Client sending <paramref name="token"/> as bearer token, whatever it is.</summary>
    public HttpClient CreateClientWithToken(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Completes the sign-up of <paramref name="user"/> (<c>PUT /api/me</c> with consent) and returns an
    /// authenticated client: the usual starting point for data endpoint tests.
    /// </summary>
    public async Task<HttpClient> CreateRegisteredClientAsync(TestUser user, ProfileRequest? profile = null)
    {
        var client = CreateClientFor(user);
        var response = await client.PutAsJsonAsync(
            "/api/me", profile ?? DefaultProfile(), ApiJson.Options);
        response.EnsureSuccessStatusCode();
        return client;
    }

    public static ProfileRequest DefaultProfile(string displayName = "Tester") =>
        new(displayName, HeightCm: 178, TargetWeightKg: 75m, DailyKcalTarget: 2200, AcceptPrivacy: true);

    /// <summary>
    /// Direct database access, outside any request. There is no current user here, so the global query
    /// filters hide every per-user row: use <c>IgnoreQueryFilters()</c> to inspect data.
    /// </summary>
    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        await using var scope = Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    /// <summary>Rows stored for <paramref name="uid"/> in every table (bypassing the query filters).</summary>
    public Task<UserRowCounts> CountRowsAsync(string uid) => WithDbAsync(async db => new UserRowCounts(
        Profiles: await db.UserProfiles.IgnoreQueryFilters().CountAsync(p => p.Uid == uid),
        Weights: await db.WeightEntries.IgnoreQueryFilters().CountAsync(w => w.UserId == uid),
        Meals: await db.MealEntries.IgnoreQueryFilters().CountAsync(m => m.UserId == uid),
        Steps: await db.DailySteps.IgnoreQueryFilters().CountAsync(s => s.UserId == uid),
        Cardio: await db.CardioSessions.IgnoreQueryFilters().CountAsync(c => c.UserId == uid)));
}

public sealed record UserRowCounts(int Profiles, int Weights, int Meals, int Steps, int Cardio)
{
    public int Total => Profiles + Weights + Meals + Steps + Cardio;
}
