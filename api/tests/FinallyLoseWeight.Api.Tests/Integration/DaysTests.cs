using System.Net;
using System.Text.Json;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "GET /api/days/{date}": everything recorded on one diary date plus totals.</summary>
public class DaysTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Empty_day_has_the_documented_shape_with_zero_totals()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await client.GetOkAsync<JsonElement>("/api/days/2026-10-14");

        json.ShouldHaveExactly(ContractShapes.Day);
        json.GetProperty("totals").ShouldHaveExactly(ContractShapes.DayTotals);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("weight").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("steps").ValueKind);
        var day = json.As<DayDto>();
        Assert.Equal("2026-10-14", day.Date);
        Assert.Empty(day.Meals);
        Assert.Empty(day.Cardio);
        Assert.Equal(new DayTotalsDto(0, 0, 0, 0, 0, 0), day.Totals);
        Assert.Equal(2200, day.DailyKcalTarget);
    }

    [Fact]
    public async Task Daily_kcal_target_is_null_when_the_profile_has_none()
    {
        var profile = ApiFactory.DefaultProfile() with { DailyKcalTarget = null };
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice(), profile);

        var json = await client.GetOkAsync<JsonElement>("/api/days/2026-10-14");

        Assert.Equal(JsonValueKind.Null, json.GetProperty("dailyKcalTarget").ValueKind);
    }

    [Fact]
    public async Task Full_day_lists_only_that_dates_records_and_sums_them()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        const string date = "2026-10-14";
        const string otherDate = "2026-10-13";

        await (await client.PutJsonAsync($"/api/weights/{date}", Bodies.Weight(72.5m, "en ayunas"))).ReadJsonAsync();
        await (await client.PutJsonAsync($"/api/weights/{otherDate}", Bodies.Weight(73m))).ReadJsonAsync();
        await (await client.PutJsonAsync($"/api/steps/{date}", Bodies.Steps(8500))).ReadJsonAsync();
        await (await client.PutJsonAsync($"/api/steps/{otherDate}", Bodies.Steps(1))).ReadJsonAsync();

        var lunch = await PostMealAsync(client, Bodies.Meal(date, "lunch", "Pollo con arroz", 650, 45m, 70m, 15m));
        var dinner = await PostMealAsync(client, Bodies.Meal(date, "dinner", "Salmón", 500, 30.5m, null, 10.25m));
        var snack = await PostMealAsync(client, Bodies.Meal(date, "snack", "Manzana", 200, null, null, null));
        await PostMealAsync(client, Bodies.Meal(otherDate, "lunch", "Otro día", 999, 99m, 99m, 99m));

        var walk = await PostCardioAsync(client, Bodies.Cardio(date, weightKg: 70m));
        var longWalk = await PostCardioAsync(client, Bodies.Cardio(date, weightKg: 70m, durationMin: 60m));
        await PostCardioAsync(client, Bodies.Cardio(otherDate, weightKg: 70m));

        var day = await client.GetOkAsync<DayDto>($"/api/days/{date}");

        Assert.Equal(new WeightDto(date, 72.5m, "en ayunas"), day.Weight);
        Assert.Equal(8500, day.Steps);
        Assert.Equal([lunch.Id, dinner.Id, snack.Id], day.Meals.Select(m => m.Id).Order());
        Assert.Equal(dinner, day.Meals.Single(m => m.Id == dinner.Id));
        Assert.Equal([walk.Id, longWalk.Id], day.Cardio.Select(c => c.Id).Order());
        Assert.Equal(longWalk, day.Cardio.Single(c => c.Id == longWalk.Id));
        Assert.Equal(
            new DayTotalsDto(KcalIn: 1350, ProteinG: 75.5m, CarbsG: 70m, FatG: 25.25m, KcalCardioGross: 302 + 604, KcalCardioNet: 265 + 531),
            day.Totals);
        Assert.Equal(2200, day.DailyKcalTarget);
    }

    [Fact]
    public async Task Weight_is_only_the_one_recorded_that_day()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/2026-10-13", Bodies.Weight(73m))).ReadJsonAsync();

        var day = await client.GetOkAsync<DayDto>("/api/days/2026-10-14");

        Assert.Null(day.Weight);
    }

    [Fact]
    public async Task Macro_totals_are_zero_when_no_meal_has_macros()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await PostMealAsync(client, Bodies.Meal("2026-10-14", kcal: 300, proteinG: null, carbsG: null, fatG: null));

        var day = await client.GetOkAsync<DayDto>("/api/days/2026-10-14");

        Assert.Equal(new DayTotalsDto(300, 0, 0, 0, 0, 0), day.Totals);
    }

    [Fact]
    public async Task Deleted_records_disappear_from_the_day()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var meal = await PostMealAsync(client, Bodies.Meal("2026-10-14"));
        var cardio = await PostCardioAsync(client, Bodies.Cardio("2026-10-14"));
        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps())).ReadJsonAsync();
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight())).ReadJsonAsync();

        await client.DeleteAsync($"/api/meals/{meal.Id}");
        await client.DeleteAsync($"/api/cardio/{cardio.Id}");
        await client.DeleteAsync("/api/steps/2026-10-14");
        await client.DeleteAsync("/api/weights/2026-10-14");
        var day = await client.GetOkAsync<DayDto>("/api/days/2026-10-14");

        Assert.Null(day.Weight);
        Assert.Null(day.Steps);
        Assert.Empty(day.Meals);
        Assert.Empty(day.Cardio);
        Assert.Equal(new DayTotalsDto(0, 0, 0, 0, 0, 0), day.Totals);
    }

    private static async Task<MealDto> PostMealAsync(HttpClient client, System.Text.Json.Nodes.JsonObject body) =>
        (await (await client.PostJsonAsync("/api/meals", body)).ReadJsonAsync(HttpStatusCode.Created)).As<MealDto>();

    private static async Task<CardioDto> PostCardioAsync(HttpClient client, System.Text.Json.Nodes.JsonObject body) =>
        (await (await client.PostJsonAsync("/api/cardio", body)).ReadJsonAsync(HttpStatusCode.Created)).As<CardioDto>();
}
