using System.Text.Json;
using System.Text.Json.Serialization;
using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Configuration;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Features;
using FinallyLoseWeight.Api.Firebase;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Configuration is only read lazily (options pipeline), never here, so test and App Service
// overrides always apply.
builder.Services.AddAppSettings();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    // docs/API.md: numbers are JSON numbers. The web defaults would also accept "8500" (a string).
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
});

builder.Services.AddApiProblemDetails();
builder.Services.AddFirebaseAuthentication();
builder.Services.AddAccessPolicies();
builder.Services.AddApiRateLimiting();
builder.Services.AddApiCors();
builder.Services.AddAppDatabase();
builder.Services.AddFirebaseUsers();

builder.Services.AddSingleton<ICardioCalculator, InclineTreadmillCalculator>();
builder.Services.AddSingleton<CardioCatalog>();

builder.Services.AddApiOpenApi();

var app = builder.Build();

// Fail fast on misconfiguration instead of on the first request that needs it
// (e.g. no Firebase service account outside Development, invalid cardio catalog).
_ = app.Services.GetRequiredService<IFirebaseUsers>();
_ = app.Services.GetRequiredService<CardioCatalog>();
if (app.Services.GetRequiredService<InvitationList>().IsEmpty)
{
    app.Logger.LogWarning("Access:AllowedEmails is empty: nobody can use the API until it is configured.");
}

await app.MigrateDatabaseIfEnabledAsync();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseRateLimiter(); // After authentication, so requests are partitioned by Firebase UID.
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Liveness: anonymous and never rate limited, so it must not touch the database. Otherwise anyone (or an
// uptime monitor) could keep Neon awake and burn the free compute quota. Reaching it after a deploy still
// proves the app started, and startup applies the migrations (Database:MigrateOnStartup).
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false })
    .AllowAnonymous()
    .DisableRateLimiting();
// Database check: same access and rate limit as the rest of the API for an invited user.
app.MapHealthChecks("/health/db", new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains(DatabaseSetup.HealthCheckTag),
    })
    .RequireAuthorization(AccessPolicies.InvitedUser);
app.MapApiEndpoints();

await app.RunAsync();

/// <summary>Entry point; public for <c>WebApplicationFactory&lt;Program&gt;</c> in the tests.</summary>
public partial class Program;
