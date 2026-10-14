using System.Net;
using System.Net.Http.Json;
using FinallyLoseWeight.Api.Features.Cardio;
using FinallyLoseWeight.Api.Features.Profile;
using FinallyLoseWeight.Api.Features.Summary;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Smoke;

/// <summary>Quick end-to-end checks that the app starts, authenticates and talks to PostgreSQL.</summary>
public class SmokeTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Health_is_public()
    {
        var response = await api.CreateAnonymousClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Database_health_needs_an_invited_user_and_checks_the_database()
    {
        await (await api.CreateAnonymousClient().GetAsync("/health/db")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
        await (await api.CreateClientFor(TestUser.NotInvited()).GetAsync("/health/db"))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");

        var response = await api.CreateClientFor(TestUser.Alice()).GetAsync("/health/db");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Api_without_token_is_401_problem_with_bearer_challenge()
    {
        var response = await api.CreateAnonymousClient().GetAsync("/api/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
        Assert.Contains(response.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("wrong-audience")]
    [InlineData("wrong-issuer")]
    [InlineData("bad-signature")]
    public async Task Invalid_tokens_are_401(string variant)
    {
        var client = api.CreateClientFor(TestUser.Alice(), token => variant switch
        {
            "expired" => token.Expired(),
            "wrong-audience" => token.WithWrongAudience(),
            "wrong-issuer" => token.WithWrongIssuer(),
            "bad-signature" => token.WithBadSignature(),
            _ => throw new ArgumentOutOfRangeException(nameof(variant)),
        });

        var response = await client.GetAsync("/api/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_without_subject_is_401()
    {
        var client = api.CreateClientWithToken(TestTokens.Create(new TokenSpec { Subject = "", Email = TestUser.AliceEmail }));

        var response = await client.GetAsync("/api/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Body_with_a_wrongly_typed_value_is_a_validation_problem_for_that_field()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        using var body = new StringContent("""{ "weightKg": "abc" }""", System.Text.Encoding.UTF8, "application/json");

        var response = await client.PutAsync("/api/weights/2026-10-14", body);

        await response.ShouldBeValidationProblemAsync("weightKg");
    }

    [Fact]
    public async Task Profile_can_be_created_read_and_updated()
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var missing = await client.GetAsync("/api/me");
        await missing.ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");

        var created = await client.PutAsJsonAsync("/api/me", ApiFactory.DefaultProfile("Adnan"), ApiJson.Options);
        var profile = await created.ReadAsAsync<ProfileResponse>(HttpStatusCode.Created);
        Assert.Equal("/api/me", created.Headers.Location?.OriginalString);
        Assert.Equal("Adnan", profile.DisplayName);
        Assert.Equal("1", profile.PrivacyVersion);

        var read = await (await client.GetAsync("/api/me")).ReadAsAsync<ProfileResponse>();
        Assert.Equal(profile, read);

        var update = new ProfileRequest("  Adnan B.  ", HeightCm: null, TargetWeightKg: 72.5m, DailyKcalTarget: null, AcceptPrivacy: null);
        var updated = await (await client.PutAsJsonAsync("/api/me", update, ApiJson.Options)).ReadAsAsync<ProfileResponse>();
        Assert.Equal("Adnan B.", updated.DisplayName);
        Assert.Null(updated.HeightCm);
        Assert.Equal(72.5m, updated.TargetWeightKg);
        Assert.Equal(profile.ConsentAt, updated.ConsentAt);
    }

    [Fact]
    public async Task Creating_a_profile_requires_consent()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var request = ApiFactory.DefaultProfile() with { AcceptPrivacy = false };

        var response = await client.PutAsJsonAsync("/api/me", request, ApiJson.Options);

        await response.ShouldBeValidationProblemAsync("acceptPrivacy");
    }

    [Fact]
    public async Task Access_checks_run_in_contract_order()
    {
        // Unverified email wins over not being invited.
        var unverifiedStranger = api.CreateClientFor(TestUser.NotInvited(), t => t.WithUnverifiedEmail());
        await (await unverifiedStranger.GetAsync("/api/me"))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "email_not_verified");

        var stranger = api.CreateClientFor(TestUser.NotInvited());
        await (await stranger.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "not_invited");

        var withoutProfile = api.CreateClientFor(TestUser.Bob());
        await (await withoutProfile.GetAsync("/api/weights?from=2026-10-01&to=2026-10-14"))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "profile_required");

        // The machine catalog needs an invitation but no profile.
        var machines = await withoutProfile.GetFromJsonAsync<List<CardioMachineDto>>("/api/cardio/machines", ApiJson.Options);
        Assert.Equal("incline-treadmill", Assert.Single(machines!).Id);

        // GDPR endpoints only need a valid token.
        var export = await unverifiedStranger.GetAsync("/api/me/export");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
    }

    [Fact]
    public async Task Cardio_uses_the_latest_weight_and_feeds_the_day_summary()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Carol());

        var weight = await client.PutAsJsonAsync("/api/weights/2026-10-10", new { weightKg = 70.0 }, ApiJson.Options);
        Assert.Equal(HttpStatusCode.OK, weight.StatusCode);

        var body = new
        {
            date = "2026-10-14",
            machine = "incline-treadmill",
            durationMin = 30,
            avgSpeedKmh = 4.8,
            inclinePercent = 12,
            kcalGross = 9999,
        };
        var estimate = await (await client.PostAsJsonAsync("/api/cardio/estimate", body, ApiJson.Options))
            .ReadAsAsync<CardioEstimateResponse>();
        Assert.Equal(new CardioEstimateResponse(302, 265, 70m, WeightSource.Entry, "acsm-walking", "acsm-v1"), estimate);

        var created = await client.PostAsJsonAsync("/api/cardio", body, ApiJson.Options);
        var session = await created.ReadAsAsync<CardioResponse>(HttpStatusCode.Created);
        Assert.Equal($"/api/cardio/{session.Id}", created.Headers.Location?.OriginalString);
        Assert.Equal((302, 265, "Cinta inclinada"), (session.KcalGross, session.KcalNet, session.MachineName));

        var day = await (await client.GetAsync("/api/days/2026-10-14")).ReadAsAsync<DayResponse>();
        Assert.Null(day.Weight);
        Assert.Equal(265, day.Totals.KcalCardioNet);
        Assert.Equal(2200, day.DailyKcalTarget);
    }

    [Fact]
    public async Task Cardio_without_any_weight_is_422_weight_required()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var body = new { date = "2026-10-14", machine = "incline-treadmill", durationMin = 30, avgSpeedKmh = 4.8, inclinePercent = 12 };

        var response = await client.PostAsJsonAsync("/api/cardio/estimate", body, ApiJson.Options);

        await response.ShouldBeProblemAsync(HttpStatusCode.UnprocessableEntity, "weight_required");
    }

    [Fact]
    public async Task Account_deletion_removes_everything_and_the_firebase_user()
    {
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);
        await client.PutAsJsonAsync("/api/steps/2026-10-14", new { steps = 8500 }, ApiJson.Options);
        Assert.Equal(2, (await api.CountRowsAsync(user.Uid)).Total);

        var stale = api.CreateClientFor(user, t => t.SignedInAgo(TimeSpan.FromMinutes(10)));
        await (await stale.DeleteAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "reauth_required");

        var response = await client.DeleteAsync("/api/me");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
        Assert.Contains(user.Uid, api.FirebaseUsers.DeletedUids);
    }

    private sealed record CardioMachineDto(string Id, string Name);
}
