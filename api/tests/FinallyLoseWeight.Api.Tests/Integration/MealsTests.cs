using System.Net;
using System.Text.Json;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "Comidas": CRUD with 201 + Location, enum strings and validation.</summary>
public class MealsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string October = "from=2026-10-01&to=2026-10-31";

    private static async Task<MealDto> CreateAsync(HttpClient client, System.Text.Json.Nodes.JsonObject body) =>
        (await (await client.PostJsonAsync("/api/meals", body)).ReadJsonAsync(HttpStatusCode.Created)).As<MealDto>();

    [Fact]
    public async Task Post_returns_201_with_location_and_the_documented_shape()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var start = DateTimeOffset.UtcNow.AddSeconds(-5);

        var response = await client.PostJsonAsync("/api/meals", Bodies.Meal());
        var json = await response.ReadJsonAsync(HttpStatusCode.Created);

        json.ShouldHaveExactly(ContractShapes.Meal);
        Assert.Equal("lunch", json.GetProperty("mealType").GetString());
        json.GetProperty("createdAt").ShouldBeUtcInstant();
        var meal = json.As<MealDto>();
        Assert.Equal(7, meal.Id.Version);
        Assert.Equal(
            new MealDto(meal.Id, "2026-10-14", "lunch", "Pollo con arroz", 650, 45m, 70m, 15m, meal.CreatedAt),
            meal);
        Assert.InRange(meal.CreatedAt, start, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.NotNull(response.Headers.Location);
        Assert.EndsWith($"/api/meals/{meal.Id}", response.Headers.Location.ToString(), StringComparison.OrdinalIgnoreCase);

        Assert.Equal([meal], await client.GetOkAsync<List<MealDto>>($"/api/meals?{October}"));
    }

    [Theory]
    [InlineData("breakfast")]
    [InlineData("lunch")]
    [InlineData("dinner")]
    [InlineData("snack")]
    public async Task Every_meal_type_round_trips_as_a_camelCase_string(string mealType)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PostJsonAsync("/api/meals", Bodies.Meal(mealType: mealType))).ReadJsonAsync(HttpStatusCode.Created);

        Assert.Equal(JsonValueKind.String, json.GetProperty("mealType").ValueKind);
        Assert.Equal(mealType, json.GetProperty("mealType").GetString());
    }

    [Theory]
    [InlineData("Lunch", "lunch")]
    [InlineData("SNACK", "snack")]
    public async Task Meal_type_is_read_case_insensitively_and_answered_in_camelCase(string sent, string stored)
    {
        // docs/API.md, "Convenciones": lenient on input, always camelCase on output.
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PostJsonAsync("/api/meals", Bodies.Meal(mealType: sent))).ReadJsonAsync(HttpStatusCode.Created);

        Assert.Equal(stored, json.GetProperty("mealType").GetString());
    }

    [Fact]
    public async Task Macros_are_optional_and_accept_decimals()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var withoutMacros = await CreateAsync(client, Bodies.Meal(proteinG: null, carbsG: null).With("fatG", null));
        var withDecimals = await CreateAsync(client, Bodies.Meal(proteinG: 12.5m, carbsG: 0m, fatG: 1000m));

        Assert.Equal((null, null, null), (withoutMacros.ProteinG, withoutMacros.CarbsG, withoutMacros.FatG));
        Assert.Equal((12.5m, 0m, 1000m), (withDecimals.ProteinG, withDecimals.CarbsG, withDecimals.FatG));
    }

    [Fact]
    public async Task Description_is_trimmed()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var meal = await CreateAsync(client, Bodies.Meal(description: "   " + new string('d', 200) + "  "));

        Assert.Equal(new string('d', 200), meal.Description);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5000)]
    public async Task Kcal_boundaries_are_accepted(int kcal)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        Assert.Equal(kcal, (await CreateAsync(client, Bodies.Meal(kcal: kcal))).Kcal);
    }

    [Fact]
    public async Task List_is_ordered_by_date_then_creation_and_filtered_by_range()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var first = await CreateAsync(client, Bodies.Meal(date: "2026-10-14", description: "primera del 14"));
        var earlier = await CreateAsync(client, Bodies.Meal(date: "2026-10-12", description: "del 12"));
        var second = await CreateAsync(client, Bodies.Meal(date: "2026-10-14", mealType: "breakfast", description: "segunda del 14"));
        await CreateAsync(client, Bodies.Meal(date: "2026-10-15", description: "fuera de rango"));
        await CreateAsync(client, Bodies.Meal(date: "2026-10-11", description: "fuera de rango"));

        var meals = await client.GetOkAsync<List<MealDto>>("/api/meals?from=2026-10-12&to=2026-10-14");

        Assert.Equal([earlier.Id, first.Id, second.Id], meals.Select(m => m.Id));
    }

    [Fact]
    public async Task Put_replaces_the_meal_and_keeps_id_and_createdAt()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var meal = await CreateAsync(client, Bodies.Meal());
        var body = Bodies.Meal(date: "2026-10-13", mealType: "dinner", description: "Ensalada", kcal: 300, proteinG: null, carbsG: 10.5m, fatG: null);

        var updated = (await (await client.PutJsonAsync($"/api/meals/{meal.Id}", body)).ReadJsonAsync()).As<MealDto>();

        Assert.Equal(new MealDto(meal.Id, "2026-10-13", "dinner", "Ensalada", 300, null, 10.5m, null, meal.CreatedAt), updated);
        Assert.Equal([updated], await client.GetOkAsync<List<MealDto>>($"/api/meals?{October}"));
    }

    [Fact]
    public async Task Put_and_delete_of_an_unknown_id_are_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var unknown = Guid.CreateVersion7();

        await (await client.PutJsonAsync($"/api/meals/{unknown}", Bodies.Meal())).ShouldBeNotFoundAsync();
        await (await client.DeleteAsync($"/api/meals/{unknown}")).ShouldBeNotFoundAsync();
        Assert.Empty(await client.GetOkAsync<List<MealDto>>($"/api/meals?{October}"));
    }

    [Fact]
    public async Task Delete_returns_204_then_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var meal = await CreateAsync(client, Bodies.Meal());
        var other = await CreateAsync(client, Bodies.Meal(description: "otra"));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/meals/{meal.Id}")).StatusCode);

        Assert.Equal([other.Id], (await client.GetOkAsync<List<MealDto>>($"/api/meals?{October}")).Select(m => m.Id));
        await (await client.DeleteAsync($"/api/meals/{meal.Id}")).ShouldBeNotFoundAsync();
        await (await client.PutJsonAsync($"/api/meals/{meal.Id}", Bodies.Meal())).ShouldBeNotFoundAsync();
    }

    public static TheoryData<string, string?> InvalidBodies => new()
    {
        { "date", null },
        { "date", "null" },
        { "date", "\"2026-02-30\"" },
        { "date", "\"14/10/2026\"" },
        { "mealType", null },
        { "mealType", "\"brunch\"" },
        { "mealType", "\"\"" },
        { "mealType", "1" },
        { "description", null },
        { "description", "\"\"" },
        { "description", "\"    \"" },
        { "description", Bodies.JsonString(201) },
        { "kcal", null },
        { "kcal", "-1" },
        { "kcal", "5001" },
        { "kcal", "650.5" },
        { "proteinG", "-0.5" },
        { "proteinG", "1000.01" },
        { "carbsG", "-1" },
        { "carbsG", "1001" },
        { "fatG", "-1" },
        { "fatG", "1000.5" },
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_values_are_400_on_that_field_when_creating(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PostJsonAsync("/api/meals", Bodies.Meal().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Empty(await client.GetOkAsync<List<MealDto>>("/api/meals?from=2026-01-01&to=2026-12-31"));
    }

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_values_are_400_on_that_field_when_updating(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var meal = await CreateAsync(client, Bodies.Meal());

        var response = await client.PutJsonAsync($"/api/meals/{meal.Id}", Bodies.Meal().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Equal([meal], await client.GetOkAsync<List<MealDto>>($"/api/meals?{October}"));
    }

    [Theory]
    [InlineData("PUT", "not-a-guid")]
    [InlineData("DELETE", "not-a-guid")]
    [InlineData("PUT", "123")]
    [InlineData("DELETE", "123")]
    public async Task Ids_that_are_not_uuids_are_404_not_found(string method, string id)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.SendJsonAsync(new HttpMethod(method), $"/api/meals/{id}", method == "PUT" ? Bodies.Meal() : null);

        await response.ShouldBeNotFoundAsync();
    }
}
