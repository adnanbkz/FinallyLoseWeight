using System.Net;
using System.Text.Json;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "GET /api/stats": one element per day with the 7-day weight trend.</summary>
public class StatsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task One_element_per_day_of_the_inclusive_range_in_order()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await client.GetOkAsync<JsonElement>("/api/stats?from=2026-09-28&to=2026-10-04");

        json.ShouldHaveExactly(ContractShapes.Stats);
        foreach (var day in json.GetProperty("days").EnumerateArray())
        {
            day.ShouldHaveExactly(ContractShapes.StatsDay);
        }

        var stats = json.As<StatsDto>();
        Assert.Equal(("2026-09-28", "2026-10-04"), (stats.From, stats.To));
        Assert.Equal(
            ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
            stats.Days.Select(d => d.Date));
        Assert.All(stats.Days, d => Assert.Equal(new StatsDayDto(d.Date, null, null, null, 0, null), d));
    }

    [Fact]
    public async Task Single_day_range_has_one_element()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=2026-10-14&to=2026-10-14");

        Assert.Equal(["2026-10-14"], stats.Days.Select(d => d.Date));
    }

    [Fact]
    public async Task Weight_trend_averages_the_last_seven_days_including_days_before_from()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        foreach (var (date, kg) in new[]
                 {
                     ("2026-09-28", 90m), // date-7 for 2026-10-05: outside every window in range
                     ("2026-09-30", 80m), // before 'from', inside the windows of 10-05 and 10-06
                     ("2026-10-05", 79.10m),
                     ("2026-10-08", 78.20m),
                     ("2026-10-11", 77.40m),
                     ("2026-10-12", 50m), // after 'to': never used
                 })
        {
            await (await client.PutJsonAsync($"/api/weights/{date}", Bodies.Weight(kg))).ReadJsonAsync();
        }

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=2026-10-05&to=2026-10-11");

        Assert.Equal(
            [
                ("2026-10-05", 79.10m, 79.55m), // (80 + 79.10) / 2
                ("2026-10-06", null, 79.55m), //   window [09-30, 10-06]
                ("2026-10-07", null, 79.10m), //   window [10-01, 10-07]: 09-30 drops out
                ("2026-10-08", 78.20m, 78.65m),
                ("2026-10-09", null, 78.65m),
                ("2026-10-10", null, 78.65m),
                ("2026-10-11", 77.40m, 78.23m), // 234.70 / 3 = 78.2333…
            ],
            stats.Days.Select(d => (d.Date, d.WeightKg, d.WeightTrendKg)));
    }

    [Fact]
    public async Task Weight_trend_is_null_without_weights_in_the_window_and_never_uses_later_weights()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/2026-10-10", Bodies.Weight(70m))).ReadJsonAsync();

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=2026-10-01&to=2026-10-03");

        Assert.All(stats.Days, d => Assert.Null(d.WeightTrendKg));
    }

    [Fact]
    public async Task Kcal_in_is_null_without_meals_and_the_rest_default_as_documented()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PostAsync(client, "/api/meals", Bodies.Meal("2026-10-06", kcal: 500));
        await PostAsync(client, "/api/meals", Bodies.Meal("2026-10-06", mealType: "dinner", kcal: 700));
        await PostAsync(client, "/api/meals", Bodies.Meal("2026-10-08", mealType: "snack", description: "Agua con limón", kcal: 0));
        await PostAsync(client, "/api/cardio", Bodies.Cardio("2026-10-07", weightKg: 70m));
        await PostAsync(client, "/api/cardio", Bodies.Cardio("2026-10-07", weightKg: 70m, durationMin: 60m));
        await (await client.PutJsonAsync("/api/steps/2026-10-09", Bodies.Steps(12000))).ReadJsonAsync();
        await (await client.PutJsonAsync("/api/steps/2026-10-10", Bodies.Steps(0))).ReadJsonAsync();
        // Outside the range.
        await PostAsync(client, "/api/meals", Bodies.Meal("2026-10-12", kcal: 999));
        await PostAsync(client, "/api/cardio", Bodies.Cardio("2026-10-04", weightKg: 70m));

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=2026-10-05&to=2026-10-11");

        Assert.Equal(
            [
                ("2026-10-05", null, 0, null),
                ("2026-10-06", 1200, 0, null),
                ("2026-10-07", null, 265 + 531, null),
                ("2026-10-08", 0, 0, null), // a 0 kcal meal is recorded: 0, not null
                ("2026-10-09", null, 0, 12000),
                ("2026-10-10", null, 0, 0),
                ("2026-10-11", null, 0, null),
            ],
            stats.Days.Select(d => (d.Date, d.KcalIn, d.KcalCardioNet, d.Steps)));
    }

    [Fact]
    public async Task Range_of_366_days_is_accepted()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=2025-10-15&to=2026-10-15");

        Assert.Equal(366, stats.Days.Count);
        Assert.Equal(("2025-10-15", "2026-10-15"), (stats.Days[0].Date, stats.Days[^1].Date));
    }

    [Theory]
    [InlineData("from=2025-10-14&to=2026-10-16")]
    [InlineData("from=2020-01-01&to=2026-10-14")]
    public async Task Range_longer_than_366_days_is_400(string query)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.GetAsync($"/api/stats?{query}");

        await response.ShouldBeValidationProblemIncludingAsync();
    }

    private static async Task PostAsync(HttpClient client, string url, System.Text.Json.Nodes.JsonObject body) =>
        await (await client.PostJsonAsync(url, body)).ReadJsonAsync(HttpStatusCode.Created);
}
