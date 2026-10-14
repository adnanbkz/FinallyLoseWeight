using System.Net;
using System.Text.Json;
using FinallyLoseWeight.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "Perfil y cuenta": GET/PUT /api/me.</summary>
public class ProfileTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Get_before_sign_up_is_404_profile_not_found()
    {
        var response = await api.CreateClientFor(TestUser.Alice()).GetAsync("/api/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
    }

    [Fact]
    public async Task Create_returns_201_with_the_documented_shape_and_stamps_consent()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var start = DateTimeOffset.UtcNow.AddSeconds(-5);

        var json = await (await client.PutJsonAsync("/api/me", Bodies.Profile("Adnan"))).ReadJsonAsync(HttpStatusCode.Created);

        json.ShouldHaveExactly(ContractShapes.Profile);
        var consentAt = json.GetProperty("consentAt").ShouldBeUtcInstant();
        json.GetProperty("createdAt").ShouldBeUtcInstant();
        json.GetProperty("updatedAt").ShouldBeUtcInstant();
        Assert.Equal(JsonValueKind.Number, json.GetProperty("targetWeightKg").ValueKind);
        var profile = json.As<ProfileDto>();
        Assert.Equal("Adnan", profile.DisplayName);
        Assert.Equal(178, profile.HeightCm);
        Assert.Equal(75m, profile.TargetWeightKg);
        Assert.Equal(2200, profile.DailyKcalTarget);
        Assert.Equal("1", profile.PrivacyVersion);
        Assert.Equal("1", profile.CurrentPrivacyVersion);
        Assert.InRange(consentAt, start, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.InRange(profile.CreatedAt, start, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.Equal(profile.CreatedAt, profile.UpdatedAt);

        Assert.Equal(profile, await client.GetOkAsync<ProfileDto>("/api/me"));
    }

    [Theory]
    [InlineData("false")]
    [InlineData("null")]
    [InlineData(null)]
    public async Task Create_without_accepting_the_privacy_policy_is_400_on_acceptPrivacy(string? acceptPrivacy)
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var response = await client.PutJsonAsync("/api/me", Bodies.Profile().With("acceptPrivacy", acceptPrivacy));

        await response.ShouldBeValidationProblemAsync("acceptPrivacy");
        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        await (await client.GetAsync("/api/days/2026-10-14")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "profile_required");
    }

    [Fact]
    public async Task Update_returns_200_and_keeps_creation_and_consent()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var created = (await (await client.PutJsonAsync("/api/me", Bodies.Profile("Adnan"))).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();

        var body = Bodies.Profile("Adnan B.", acceptPrivacy: null).With("acceptPrivacy", null).With("heightCm", "180");
        var updated = (await (await client.PutJsonAsync("/api/me", body)).ReadJsonAsync()).As<ProfileDto>();

        Assert.Equal("Adnan B.", updated.DisplayName);
        Assert.Equal(180, updated.HeightCm);
        Assert.Equal(created.ConsentAt, updated.ConsentAt);
        Assert.Equal(created.PrivacyVersion, updated.PrivacyVersion);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.True(updated.UpdatedAt >= created.UpdatedAt);
        Assert.Equal(updated, await client.GetOkAsync<ProfileDto>("/api/me"));
    }

    [Fact]
    public async Task Update_with_acceptPrivacy_true_restamps_consent()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var created = (await (await client.PutJsonAsync("/api/me", Bodies.Profile())).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();
        await Task.Delay(20);

        var updated = (await (await client.PutJsonAsync("/api/me", Bodies.Profile(acceptPrivacy: true))).ReadJsonAsync()).As<ProfileDto>();

        Assert.True(updated.ConsentAt > created.ConsentAt, $"{updated.ConsentAt:o} should be after {created.ConsentAt:o}");
        Assert.Equal("1", updated.PrivacyVersion);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
    }

    [Fact]
    public async Task Outdated_consent_is_visible_and_accepting_again_stamps_the_current_version()
    {
        // Privacy:CurrentVersion is raised after the user accepted an older notice.
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);
        await api.WithDbAsync(db => db.UserProfiles.IgnoreQueryFilters()
            .Where(p => p.Uid == user.Uid)
            .ExecuteUpdateAsync(p => p.SetProperty(x => x.PrivacyVersion, "0")));

        var outdated = await client.GetOkAsync<ProfileDto>("/api/me");
        Assert.Equal(("0", "1"), (outdated.PrivacyVersion, outdated.CurrentPrivacyVersion));

        // A plain update keeps the old consent; acceptPrivacy: true accepts the current notice.
        var plain = (await (await client.PutJsonAsync("/api/me", Bodies.Profile(acceptPrivacy: null))).ReadJsonAsync()).As<ProfileDto>();
        Assert.Equal("0", plain.PrivacyVersion);
        var accepted = (await (await client.PutJsonAsync("/api/me", Bodies.Profile(acceptPrivacy: true))).ReadJsonAsync()).As<ProfileDto>();
        Assert.Equal(("1", "1"), (accepted.PrivacyVersion, accepted.CurrentPrivacyVersion));
        Assert.True(accepted.ConsentAt > outdated.ConsentAt);
    }

    [Fact]
    public async Task Update_replaces_every_editable_field_so_omitted_optionals_become_null()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var updated = await (await client.PutJsonAsync("/api/me", new System.Text.Json.Nodes.JsonObject { ["displayName"] = "Ana B" }))
            .ReadJsonAsync();

        var profile = updated.As<ProfileDto>();
        Assert.Equal("Ana B", profile.DisplayName);
        Assert.Equal((null, null, null), (profile.HeightCm, profile.TargetWeightKg, profile.DailyKcalTarget));
    }

    [Fact]
    public async Task Create_for_a_disabled_firebase_account_is_401_and_stores_nothing()
    {
        var user = TestUser.Alice();
        api.FirebaseUsers.Disable(user.Uid);
        var client = api.CreateClientFor(user);

        await (await client.PutJsonAsync("/api/me", Bodies.Profile())).ShouldBeProblemAsync(HttpStatusCode.Unauthorized);

        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
    }

    [Fact]
    public async Task Optional_fields_may_be_null()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var body = Bodies.Profile().With("heightCm", "null").With("targetWeightKg", "null").With("dailyKcalTarget", null);

        var profile = (await (await client.PutJsonAsync("/api/me", body)).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();

        Assert.Null(profile.HeightCm);
        Assert.Null(profile.TargetWeightKg);
        Assert.Null(profile.DailyKcalTarget);
    }

    [Fact]
    public async Task Display_name_is_trimmed()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var padded = "  " + new string('n', 40) + "  ";

        var profile = (await (await client.PutJsonAsync("/api/me", Bodies.Profile(padded))).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();

        Assert.Equal(new string('n', 40), profile.DisplayName);
    }

    public static TheoryData<string, string> ValidValues => new()
    {
        { "displayName", "\"A\"" },
        { "displayName", Bodies.JsonString(40) },
        { "heightCm", "100" },
        { "heightCm", "250" },
        { "targetWeightKg", "30" },
        { "targetWeightKg", "300" },
        { "targetWeightKg", "72.5" },
        { "dailyKcalTarget", "800" },
        { "dailyKcalTarget", "6000" },
    };

    [Theory]
    [MemberData(nameof(ValidValues))]
    public async Task Boundary_values_are_accepted(string field, string value)
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var json = await (await client.PutJsonAsync("/api/me", Bodies.Profile().With(field, value))).ReadJsonAsync(HttpStatusCode.Created);

        JsonShape.ShouldEqualJson(value, json.GetProperty(field));
    }

    public static TheoryData<string, string?> InvalidValues => new()
    {
        { "displayName", null },
        { "displayName", "null" },
        { "displayName", "\"\"" },
        { "displayName", "\"   \"" },
        { "displayName", Bodies.JsonString(41) },
        { "heightCm", "99" },
        { "heightCm", "251" },
        { "targetWeightKg", "29.99" },
        { "targetWeightKg", "300.01" },
        { "dailyKcalTarget", "799" },
        { "dailyKcalTarget", "6001" },
    };

    [Theory]
    [MemberData(nameof(InvalidValues))]
    public async Task Out_of_range_values_are_400_on_that_field_when_creating(string field, string? value)
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var response = await client.PutJsonAsync("/api/me", Bodies.Profile().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
    }

    [Theory]
    [MemberData(nameof(InvalidValues))]
    public async Task Out_of_range_values_are_400_on_that_field_when_updating(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var before = await client.GetOkAsync<ProfileDto>("/api/me");

        var response = await client.PutJsonAsync("/api/me", Bodies.Profile().With("acceptPrivacy", null).With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Equal(before, await client.GetOkAsync<ProfileDto>("/api/me"));
    }

    [Fact]
    public async Task All_invalid_fields_are_reported_together()
    {
        var client = api.CreateClientFor(TestUser.Alice());
        var body = Bodies.Profile(acceptPrivacy: false)
            .With("displayName", "\"\"")
            .With("heightCm", "20")
            .With("targetWeightKg", "1000")
            .With("dailyKcalTarget", "1");

        var response = await client.PutJsonAsync("/api/me", body);

        await response.ShouldBeValidationProblemAsync("displayName", "heightCm", "targetWeightKg", "dailyKcalTarget", "acceptPrivacy");
    }

    [Fact]
    public async Task Non_ascii_display_names_round_trip()
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var profile = (await (await client.PutJsonAsync("/api/me", Bodies.Profile("José Núñez 💪"))).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();

        Assert.Equal("José Núñez 💪", profile.DisplayName);
        Assert.Equal("José Núñez 💪", (await client.GetOkAsync<ProfileDto>("/api/me")).DisplayName);
    }

    [Fact]
    public async Task Concurrent_sign_ups_create_exactly_one_profile()
    {
        // A double-tapped "Crear cuenta" button: one 201, the rest are updates of that profile.
        var user = TestUser.Alice();
        var client = api.CreateClientFor(user);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => client.PutJsonAsync("/api/me", Bodies.Profile($"Tester {i}"))));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        Assert.All(statuses, s => Assert.Contains(s, new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
        Assert.Single(statuses, HttpStatusCode.Created);
        Assert.Equal(1, (await api.CountRowsAsync(user.Uid)).Profiles);
    }
}

/// <summary><see cref="ApiFactory"/> with a non-default <c>Privacy:CurrentVersion</c>.</summary>
public sealed class PrivacyVersionApiFactory : ApiFactory
{
    public const string Version = "2026-10";

    protected override void ConfigureSettings(IDictionary<string, string?> settings)
    {
        base.ConfigureSettings(settings);
        settings["Privacy:CurrentVersion"] = Version;
    }
}

/// <summary>The stamped <c>privacyVersion</c> is <c>Privacy:CurrentVersion</c>, not a constant.</summary>
public class ProfilePrivacyVersionTests(PrivacyVersionApiFactory api) : IClassFixture<PrivacyVersionApiFactory>
{
    [Fact]
    public async Task Consent_is_stamped_with_the_configured_privacy_version()
    {
        var client = api.CreateClientFor(TestUser.Alice());

        var profile = (await (await client.PutJsonAsync("/api/me", Bodies.Profile())).ReadJsonAsync(HttpStatusCode.Created)).As<ProfileDto>();

        Assert.Equal(PrivacyVersionApiFactory.Version, profile.PrivacyVersion);
    }
}
