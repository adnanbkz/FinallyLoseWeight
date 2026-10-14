using System.Net;
using System.Text.Json;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "Peso": one weight per date, upserted with PUT.</summary>
public class WeightsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Put_creates_and_returns_the_documented_shape()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(72.5m, "en ayunas"))).ReadJsonAsync();

        json.ShouldHaveExactly(ContractShapes.Weight);
        Assert.Equal(JsonValueKind.Number, json.GetProperty("weightKg").ValueKind);
        Assert.Equal(new WeightDto("2026-10-14", 72.5m, "en ayunas"), json.As<WeightDto>());
        Assert.Equal([new WeightDto("2026-10-14", 72.5m, "en ayunas")],
            await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-14&to=2026-10-14"));
    }

    [Fact]
    public async Task Put_on_an_existing_date_replaces_it()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(72.5m, "en ayunas"))).ReadJsonAsync();

        var replaced = (await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(71.9m).With("note", null)))
            .ReadJsonAsync()).As<WeightDto>();

        Assert.Equal(new WeightDto("2026-10-14", 71.9m, null), replaced);
        Assert.Equal([replaced], await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-01&to=2026-10-31"));
    }

    [Fact]
    public async Task List_is_ordered_by_date_and_filtered_by_the_inclusive_range()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        foreach (var (date, kg) in new[] { ("2026-10-14", 72m), ("2026-10-09", 74m), ("2026-10-12", 73m), ("2026-10-10", 73.5m), ("2026-10-15", 71m) })
        {
            await (await client.PutJsonAsync($"/api/weights/{date}", Bodies.Weight(kg))).ReadJsonAsync();
        }

        var weights = await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-10&to=2026-10-14");

        Assert.Equal(["2026-10-10", "2026-10-12", "2026-10-14"], weights.Select(w => w.Date));
        Assert.Equal([73.5m, 73m, 72m], weights.Select(w => w.WeightKg));
    }

    [Fact]
    public async Task Empty_range_is_an_empty_array()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        Assert.Empty(await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-01&to=2026-10-31"));
    }

    [Theory]
    [InlineData("20")]
    [InlineData("400")]
    [InlineData("72.25")]
    public async Task Boundary_weights_are_accepted(string weightKg)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight().With("weightKg", weightKg))).ReadJsonAsync();

        JsonShape.ShouldEqualJson(weightKg, json.GetProperty("weightKg"));
    }

    [Fact]
    public async Task Note_of_200_characters_or_null_is_accepted()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var note = new string('n', 200);

        Assert.Equal(note, (await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(70m, note))).ReadJsonAsync()).As<WeightDto>().Note);
        Assert.Null((await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(70m).With("note", "null"))).ReadJsonAsync()).As<WeightDto>().Note);
    }

    public static TheoryData<string, string?> InvalidBodies => new()
    {
        { "weightKg", null },
        { "weightKg", "null" },
        { "weightKg", "19.99" },
        { "weightKg", "400.01" },
        { "weightKg", "-72.5" },
        { "weightKg", "\"72,5\"" },
        { "note", Bodies.JsonString(201) },
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_values_are_400_on_that_field_and_store_nothing(string field, string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(70m))).ReadJsonAsync();

        var response = await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight().With(field, value));

        await response.ShouldBeValidationProblemAsync(field);
        Assert.Equal([new WeightDto("2026-10-14", 70m, null)],
            await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-14&to=2026-10-14"));
    }

    [Fact]
    public async Task Delete_removes_the_date_then_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight())).ReadJsonAsync();
        await (await client.PutJsonAsync("/api/weights/2026-10-13", Bodies.Weight(73m))).ReadJsonAsync();

        var deleted = await client.DeleteAsync("/api/weights/2026-10-14");

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(["2026-10-13"], (await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-01&to=2026-10-31")).Select(w => w.Date));
        await (await client.DeleteAsync("/api/weights/2026-10-14")).ShouldBeNotFoundAsync();
    }

    [Fact]
    public async Task Delete_of_a_date_never_recorded_is_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        await (await client.DeleteAsync("/api/weights/2026-10-14")).ShouldBeNotFoundAsync();
    }

    [Fact]
    public async Task Concurrent_puts_on_the_same_date_all_succeed_and_leave_one_row()
    {
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);

        var responses = await Task.WhenAll(Enumerable.Range(0, 12)
            .Select(i => client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight(70m + i))));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var stored = Assert.Single(await client.GetOkAsync<List<WeightDto>>("/api/weights?from=2026-10-14&to=2026-10-14"));
        Assert.InRange(stored.WeightKg, 70m, 81m);
        Assert.Equal(1, (await api.CountRowsAsync(user.Uid)).Weights);
    }
}
