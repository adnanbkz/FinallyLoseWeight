using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, GDPR: GET /api/me/export and DELETE /api/me (recent login, everything deleted, then Firebase).</summary>
public partial class AccountTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    /// <summary>Registers <paramref name="user"/> and records at least one row in every table.</summary>
    private async Task<HttpClient> SeedEverythingAsync(TestUser user)
    {
        var client = await api.CreateRegisteredClientAsync(user, ApiFactory.DefaultProfile("Adnan"));
        await (await client.PutJsonAsync("/api/weights/2019-01-01", Bodies.Weight(95m))).ReadJsonAsync();
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(72.5m, "en ayunas"))).ReadJsonAsync();
        await (await client.PostJsonAsync("/api/meals", Bodies.Meal("2026-10-14"))).ReadJsonAsync(HttpStatusCode.Created);
        await (await client.PostJsonAsync("/api/meals", Bodies.Meal("2023-05-01", "snack", "Antigua", 100, null, null, null)))
            .ReadJsonAsync(HttpStatusCode.Created);
        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(8500))).ReadJsonAsync();
        await (await client.PostJsonAsync("/api/cardio", Bodies.Cardio("2026-10-14", weightKg: null))).ReadJsonAsync(HttpStatusCode.Created);
        return client;
    }

    [GeneratedRegex("""^finallyloseweight-export-(\d{4}-\d{2}-\d{2})\.json$""")]
    private static partial Regex ExportFileName();

    [Fact]
    public async Task Export_is_a_json_attachment_with_every_row_of_the_user()
    {
        var user = TestUser.Alice();
        var client = await SeedEverythingAsync(user);
        var start = DateTimeOffset.UtcNow.AddSeconds(-5);

        var response = await client.GetAsync("/api/me/export");
        var json = await response.ReadJsonAsync();

        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition.DispositionType);
        var match = ExportFileName().Match(disposition.FileName?.Trim('"') ?? "");
        Assert.True(match.Success, $"Unexpected file name: {disposition.FileName}");
        var fileDate = DateOnly.ParseExact(match.Groups[1].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        Assert.InRange(fileDate, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1), DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1));

        json.ShouldHaveExactly(ContractShapes.Export);
        json.GetProperty("exportedAt").ShouldBeUtcInstant();
        json.GetProperty("profile").ShouldHaveExactly(ContractShapes.Profile);
        Assert.All(json.GetProperty("weights").EnumerateArray(), w => w.ShouldHaveExactly(ContractShapes.Weight));
        Assert.All(json.GetProperty("meals").EnumerateArray(), m => m.ShouldHaveExactly(ContractShapes.Meal));
        Assert.All(json.GetProperty("steps").EnumerateArray(), s => s.ShouldHaveExactly(ContractShapes.Steps));
        Assert.All(json.GetProperty("cardio").EnumerateArray(), c => c.ShouldHaveExactly(ContractShapes.Cardio));

        var export = json.As<ExportDto>();
        Assert.InRange(export.ExportedAt, start, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.Equal(await client.GetOkAsync<ProfileDto>("/api/me"), export.Profile);
        Assert.Equal(
            [new WeightDto("2019-01-01", 95m, null), new WeightDto("2026-10-14", 72.5m, "en ayunas")],
            export.Weights.OrderBy(w => w.Date, StringComparer.Ordinal));
        Assert.Equal(["2023-05-01", "2026-10-14"], export.Meals.Select(m => m.Date).Order(StringComparer.Ordinal));
        Assert.Equal([new StepsDto("2026-10-14", 8500)], export.Steps);
        var cardio = Assert.Single(export.Cardio);
        Assert.Equal((72.5m, "incline-treadmill"), (cardio.WeightKgUsed, cardio.Machine));
    }

    [Fact]
    public async Task Export_without_a_profile_has_null_profile_and_empty_lists()
    {
        var client = api.CreateClientFor(TestUser.NotInvited());

        var export = await client.GetOkAsync<JsonElement>("/api/me/export");

        Assert.Equal(JsonValueKind.Null, export.GetProperty("profile").ValueKind);
        foreach (var list in new[] { "weights", "meals", "steps", "cardio" })
        {
            Assert.Equal(0, export.GetProperty(list).GetArrayLength());
        }
    }

    [Theory]
    [InlineData(6)]
    [InlineData(60)]
    [InlineData(60 * 24 * 7)]
    public async Task Delete_with_an_old_sign_in_is_401_reauth_required_and_deletes_nothing(int minutesAgo)
    {
        var user = TestUser.Alice();
        await SeedEverythingAsync(user);
        var before = await api.CountRowsAsync(user.Uid);
        var stale = api.CreateClientFor(user, t => t.SignedInAgo(TimeSpan.FromMinutes(minutesAgo)));

        var response = await stale.DeleteAsync("/api/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "reauth_required");
        Assert.Equal(before, await api.CountRowsAsync(user.Uid));
        Assert.DoesNotContain(user.Uid, api.FirebaseUsers.DeletedUids);
    }

    [Fact]
    public async Task Delete_without_auth_time_is_401_reauth_required()
    {
        var user = TestUser.Alice();
        await SeedEverythingAsync(user);
        var client = api.CreateClientFor(user, t => t with { AuthTime = null });

        await (await client.DeleteAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "reauth_required");
        Assert.Equal(1, (await api.CountRowsAsync(user.Uid)).Profiles);
    }

    [Fact]
    public async Task Delete_with_a_sign_in_four_minutes_ago_is_allowed()
    {
        var user = TestUser.Alice();
        await SeedEverythingAsync(user);
        var client = api.CreateClientFor(user, t => t.SignedInAgo(TimeSpan.FromMinutes(4)));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
    }

    [Fact]
    public async Task Delete_removes_every_row_then_the_firebase_user_and_is_idempotent()
    {
        var user = TestUser.Alice();
        var client = await SeedEverythingAsync(user);
        Assert.Equal(new UserRowCounts(Profiles: 1, Weights: 2, Meals: 2, Steps: 1, Cardio: 1), await api.CountRowsAsync(user.Uid));

        var response = await client.DeleteAsync("/api/me");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
        Assert.Equal([user.Uid], api.FirebaseUsers.DeletedUids.Where(uid => uid == user.Uid));

        var again = await client.DeleteAsync("/api/me");

        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        await (await client.GetAsync("/api/days/2026-10-14")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "profile_required");
        var export = await client.GetOkAsync<ExportDto>("/api/me/export");
        Assert.Null(export.Profile);
        Assert.True(export.Weights.Count + export.Meals.Count + export.Steps.Count + export.Cardio.Count == 0);
    }

    [Fact]
    public async Task A_token_left_over_after_deletion_cannot_recreate_the_profile_or_store_data()
    {
        // Another device still holds a valid ID token (they live up to 1 h after the account is deleted).
        var user = TestUser.Alice();
        var client = await SeedEverythingAsync(user);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);

        await (await client.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        await (await client.PutJsonAsync("/api/me", Bodies.Profile("Adnan"))).ShouldBeProblemAsync(HttpStatusCode.Unauthorized);
        await (await client.PutJsonAsync("/api/weights/2026-10-15", Bodies.Weight()))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "profile_required");

        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
    }

    [Fact]
    public async Task Delete_of_a_user_without_profile_still_deletes_the_firebase_user()
    {
        var user = TestUser.Bob();
        var client = api.CreateClientFor(user);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);

        Assert.Contains(user.Uid, api.FirebaseUsers.DeletedUids);
    }

    [Fact]
    public async Task Not_invited_user_can_export_and_delete()
    {
        var user = TestUser.NotInvited();
        var client = api.CreateClientFor(user);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/me/export")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);
        Assert.Contains(user.Uid, api.FirebaseUsers.DeletedUids);
    }

    [Fact]
    public async Task Uninvited_user_with_data_can_still_export_and_delete_it()
    {
        // Invited when they signed up, removed from the list afterwards: GDPR rights remain.
        var user = TestUser.Alice();
        await SeedEverythingAsync(user);
        var client = api.CreateClientFor(user, t => t with { Email = TestUser.NotInvitedEmail, EmailVerified = false });

        var export = await client.GetOkAsync<ExportDto>("/api/me/export");
        Assert.Equal("Adnan", export.Profile?.DisplayName);
        Assert.Equal(2, export.Weights.Count);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/me")).StatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total);
    }

    [Fact]
    public async Task Firebase_failure_after_the_data_is_deleted_can_be_retried()
    {
        var user = TestUser.Carol();
        var client = await SeedEverythingAsync(user);
        api.FirebaseUsers.FailNextCall(new InvalidOperationException("Firebase no disponible"));

        var failed = await client.DeleteAsync("/api/me");

        Assert.False(failed.IsSuccessStatusCode);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Total); // the database goes first
        Assert.DoesNotContain(user.Uid, api.FirebaseUsers.DeletedUids);

        var retried = await client.DeleteAsync("/api/me");

        Assert.Equal(HttpStatusCode.NoContent, retried.StatusCode);
        Assert.Contains(user.Uid, api.FirebaseUsers.DeletedUids);
    }
}
