using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>
/// Each user only ever sees and changes their own data (docs/PLAN.md §4): another user's resources are
/// 404 not_found, never 403, and nothing Bob does changes Alice's rows.
/// </summary>
public class IsolationTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Day = "2026-10-10";
    private const string Range = "from=2026-10-01&to=2026-10-31";

    private sealed record Alice(TestUser User, HttpClient Client, Guid MealId, Guid CardioId)
    {
        /// <summary>Alice's whole dataset as JSON (export minus the timestamp), to prove it did not change.</summary>
        public async Task<string> SnapshotAsync()
        {
            var export = JsonNode.Parse(await (await Client.GetAsync("/api/me/export")).Content.ReadAsStringAsync())!.AsObject();
            export.Remove("exportedAt");
            return export.ToJsonString();
        }
    }

    /// <summary>Alice registers and records a weight, a meal, steps and a cardio session on <see cref="Day"/>.</summary>
    private async Task<Alice> SeedAliceAsync()
    {
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);
        await (await client.PutJsonAsync($"/api/weights/{Day}", Bodies.Weight(80m, "Alice"))).ReadJsonAsync();
        await (await client.PutJsonAsync($"/api/weights/{Dates.Plus(Day, -3)}", Bodies.Weight(81m))).ReadJsonAsync();
        var meal = (await (await client.PostJsonAsync("/api/meals", Bodies.Meal(date: Day, description: "Comida de Alice")))
            .ReadJsonAsync(HttpStatusCode.Created)).As<MealDto>();
        await (await client.PutJsonAsync($"/api/steps/{Day}", Bodies.Steps(12345))).ReadJsonAsync();
        var cardio = (await (await client.PostJsonAsync("/api/cardio", Bodies.Cardio(date: Day, weightKg: null)))
            .ReadJsonAsync(HttpStatusCode.Created)).As<CardioDto>();
        Assert.Equal(80m, cardio.WeightKgUsed);
        return new Alice(user, client, meal.Id, cardio.Id);
    }

    public static TheoryData<string> ListUrls => new()
    {
        $"/api/weights?{Range}",
        $"/api/meals?{Range}",
        $"/api/steps?{Range}",
        $"/api/cardio?{Range}",
    };

    [Theory]
    [MemberData(nameof(ListUrls))]
    public async Task Lists_never_include_another_users_rows(string url)
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());

        var bobs = await bob.GetOkAsync<JsonElement>(url);
        var alices = await alice.Client.GetOkAsync<JsonElement>(url);

        Assert.Equal(0, bobs.GetArrayLength());
        Assert.True(alices.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Day_summary_never_includes_another_users_rows()
    {
        await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());

        var day = await bob.GetOkAsync<DayDto>($"/api/days/{Day}");

        Assert.Null(day.Weight);
        Assert.Empty(day.Meals);
        Assert.Null(day.Steps);
        Assert.Empty(day.Cardio);
        Assert.Equal(new DayTotalsDto(0, 0, 0, 0, 0, 0), day.Totals);
    }

    [Fact]
    public async Task Stats_never_include_another_users_rows()
    {
        await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());

        var stats = await bob.GetOkAsync<StatsDto>($"/api/stats?from={Dates.Plus(Day, -1)}&to={Dates.Plus(Day, 1)}");

        Assert.Equal(3, stats.Days.Count);
        Assert.All(stats.Days, d =>
        {
            Assert.Null(d.WeightKg);
            Assert.Null(d.WeightTrendKg);
            Assert.Null(d.KcalIn);
            Assert.Equal(0, d.KcalCardioNet);
            Assert.Null(d.Steps);
        });
    }

    [Fact]
    public async Task Export_only_contains_the_callers_data()
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob(), ApiFactory.DefaultProfile("Bob"));
        await (await bob.PutJsonAsync("/api/weights/2026-10-11", Bodies.Weight(90m))).ReadJsonAsync();

        var export = await bob.GetOkAsync<ExportDto>("/api/me/export");

        Assert.Equal("Bob", export.Profile?.DisplayName);
        Assert.Equal([new WeightDto("2026-10-11", 90m, null)], export.Weights);
        Assert.Empty(export.Meals);
        Assert.Empty(export.Steps);
        Assert.Empty(export.Cardio);

        var alices = await alice.Client.GetOkAsync<ExportDto>("/api/me/export");
        Assert.Equal("Tester", alices.Profile?.DisplayName);
        Assert.DoesNotContain(alices.Weights, w => w.WeightKg == 90m);
    }

    [Fact]
    public async Task Profiles_are_per_user()
    {
        var alice = await SeedAliceAsync();
        var bob = api.CreateClientFor(TestUser.Bob());

        await (await bob.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        await (await bob.PutJsonAsync("/api/me", Bodies.Profile("Bob"))).ReadJsonAsync(HttpStatusCode.Created);

        Assert.Equal("Bob", (await bob.GetOkAsync<ProfileDto>("/api/me")).DisplayName);
        Assert.Equal("Tester", (await alice.Client.GetOkAsync<ProfileDto>("/api/me")).DisplayName);
    }

    public static TheoryData<string, string> ForeignResourceOperations => new()
    {
        { "PUT", "meals" },
        { "DELETE", "meals" },
        { "PUT", "cardio" },
        { "DELETE", "cardio" },
    };

    [Theory]
    [MemberData(nameof(ForeignResourceOperations))]
    public async Task Changing_another_users_meal_or_cardio_is_404_not_found_and_changes_nothing(string method, string resource)
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());
        var before = await alice.SnapshotAsync();
        var id = resource == "meals" ? alice.MealId : alice.CardioId;
        var body = resource == "meals"
            ? Bodies.Meal(date: Day, description: "Hackeado", kcal: 1)
            : Bodies.Cardio(date: Day, durationMin: 600m);

        var response = await bob.SendJsonAsync(new HttpMethod(method), $"/api/{resource}/{id}", method == "PUT" ? body : null);

        await response.ShouldBeNotFoundAsync();
        Assert.Equal(before, await alice.SnapshotAsync());
        Assert.Equal(0, (await bob.GetOkAsync<JsonElement>($"/api/{resource}?{Range}")).GetArrayLength());
    }

    [Fact]
    public async Task Writing_the_same_date_never_touches_another_users_rows()
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());
        var before = await alice.SnapshotAsync();

        await (await bob.PutJsonAsync($"/api/weights/{Day}", Bodies.Weight(99m, "Bob"))).ReadJsonAsync();
        await (await bob.PutJsonAsync($"/api/steps/{Day}", Bodies.Steps(1))).ReadJsonAsync();
        Assert.Equal(before, await alice.SnapshotAsync());
        Assert.Equal([new WeightDto(Day, 99m, "Bob")], await bob.GetOkAsync<List<WeightDto>>($"/api/weights?{Range}"));
        Assert.Equal([new StepsDto(Day, 1)], await bob.GetOkAsync<List<StepsDto>>($"/api/steps?{Range}"));

        Assert.Equal(HttpStatusCode.NoContent, (await bob.DeleteAsync($"/api/weights/{Day}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await bob.DeleteAsync($"/api/steps/{Day}")).StatusCode);
        Assert.Equal(before, await alice.SnapshotAsync());
    }

    [Theory]
    [InlineData("weights")]
    [InlineData("steps")]
    public async Task Deleting_a_date_only_another_user_recorded_is_404_not_found(string resource)
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());
        var before = await alice.SnapshotAsync();

        await (await bob.DeleteAsync($"/api/{resource}/{Day}")).ShouldBeNotFoundAsync();

        Assert.Equal(before, await alice.SnapshotAsync());
    }

    [Fact]
    public async Task Cardio_weight_resolution_never_uses_another_users_weight()
    {
        await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());

        var response = await bob.PostJsonAsync("/api/cardio/estimate", Bodies.Cardio(date: Day, weightKg: null));

        await response.ShouldBeProblemAsync(HttpStatusCode.UnprocessableEntity, "weight_required");
    }

    [Fact]
    public async Task Client_supplied_ids_and_user_ids_are_ignored()
    {
        var alice = await SeedAliceAsync();
        var bob = await api.CreateRegisteredClientAsync(TestUser.Bob());
        var before = await alice.SnapshotAsync();

        var meal = Bodies.Meal(date: Day, description: "De Bob");
        meal["id"] = alice.MealId.ToString();
        meal["userId"] = alice.User.Uid;
        var cardio = Bodies.Cardio(date: Day);
        cardio["id"] = alice.CardioId.ToString();
        cardio["userId"] = alice.User.Uid;

        var bobsMeal = (await (await bob.PostJsonAsync("/api/meals", meal)).ReadJsonAsync(HttpStatusCode.Created)).As<MealDto>();
        var bobsCardio = (await (await bob.PostJsonAsync("/api/cardio", cardio)).ReadJsonAsync(HttpStatusCode.Created)).As<CardioDto>();
        var updated = (await (await bob.PutJsonAsync($"/api/meals/{bobsMeal.Id}", meal)).ReadJsonAsync()).As<MealDto>();

        Assert.NotEqual(alice.MealId, bobsMeal.Id);
        Assert.NotEqual(alice.CardioId, bobsCardio.Id);
        Assert.Equal(bobsMeal.Id, updated.Id);
        Assert.Equal(before, await alice.SnapshotAsync());
        Assert.Equal([bobsMeal.Id], (await bob.GetOkAsync<List<MealDto>>($"/api/meals?{Range}")).Select(m => m.Id));
        Assert.Equal([bobsCardio.Id], (await bob.GetOkAsync<List<CardioDto>>($"/api/cardio?{Range}")).Select(c => c.Id));
    }

    [Fact]
    public async Task Deleting_an_account_leaves_other_users_intact()
    {
        var alice = await SeedAliceAsync();
        var bobUser = TestUser.Bob();
        var bob = await api.CreateRegisteredClientAsync(bobUser);
        await (await bob.PutJsonAsync($"/api/weights/{Day}", Bodies.Weight(99m))).ReadJsonAsync();
        await (await bob.PostJsonAsync("/api/meals", Bodies.Meal(date: Day))).ReadJsonAsync(HttpStatusCode.Created);
        var aliceRows = await api.CountRowsAsync(alice.User.Uid);
        var before = await alice.SnapshotAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await bob.DeleteAsync("/api/me")).StatusCode);

        Assert.Equal(0, (await api.CountRowsAsync(bobUser.Uid)).Total);
        Assert.Equal(aliceRows, await api.CountRowsAsync(alice.User.Uid));
        Assert.Equal(new UserRowCounts(1, 2, 1, 1, 1), aliceRows);
        Assert.Equal(before, await alice.SnapshotAsync());
        Assert.Contains(bobUser.Uid, api.FirebaseUsers.DeletedUids);
        Assert.DoesNotContain(alice.User.Uid, api.FirebaseUsers.DeletedUids);
    }

    [Fact]
    public async Task Uids_that_differ_only_in_case_are_different_users()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var lower = new TestUser($"user-{suffix}", TestUser.AliceEmail);
        var upper = new TestUser($"USER-{suffix.ToUpperInvariant()}", TestUser.BobEmail);
        var lowerClient = await api.CreateRegisteredClientAsync(lower);
        await (await lowerClient.PutJsonAsync($"/api/weights/{Day}", Bodies.Weight(80m))).ReadJsonAsync();
        var upperClient = api.CreateClientFor(upper);

        await (await upperClient.GetAsync("/api/me")).ShouldBeProblemAsync(HttpStatusCode.NotFound, "profile_not_found");
        await (await upperClient.PutJsonAsync("/api/me", Bodies.Profile("Upper"))).ReadJsonAsync(HttpStatusCode.Created);
        Assert.Empty(await upperClient.GetOkAsync<List<WeightDto>>($"/api/weights?{Range}"));
        Assert.Equal("Tester", (await lowerClient.GetOkAsync<ProfileDto>("/api/me")).DisplayName);
    }
}
