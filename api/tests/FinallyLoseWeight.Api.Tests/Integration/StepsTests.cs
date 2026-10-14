using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>docs/API.md, "Pasos": one value per date, upserted with PUT.</summary>
public class StepsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Put_creates_and_returns_the_documented_shape()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var json = await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(8500))).ReadJsonAsync();

        json.ShouldHaveExactly(ContractShapes.Steps);
        Assert.Equal(new StepsDto("2026-10-14", 8500), json.As<StepsDto>());
    }

    [Fact]
    public async Task Put_on_an_existing_date_replaces_it()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(8500))).ReadJsonAsync();

        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(10200))).ReadJsonAsync();

        Assert.Equal([new StepsDto("2026-10-14", 10200)], await client.GetOkAsync<List<StepsDto>>("/api/steps?from=2026-10-01&to=2026-10-31"));
    }

    [Fact]
    public async Task List_returns_only_the_inclusive_range()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        foreach (var (date, steps) in new[] { ("2026-10-09", 1), ("2026-10-10", 2), ("2026-10-12", 3), ("2026-10-14", 4), ("2026-10-15", 5) })
        {
            await (await client.PutJsonAsync($"/api/steps/{date}", Bodies.Steps(steps))).ReadJsonAsync();
        }

        var list = await client.GetOkAsync<List<StepsDto>>("/api/steps?from=2026-10-10&to=2026-10-14");

        Assert.Equal(
            [new StepsDto("2026-10-10", 2), new StepsDto("2026-10-12", 3), new StepsDto("2026-10-14", 4)],
            list.OrderBy(s => s.Date, StringComparer.Ordinal));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(150000)]
    public async Task Boundary_values_are_accepted(int steps)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var result = (await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(steps))).ReadJsonAsync()).As<StepsDto>();

        Assert.Equal(steps, result.Steps);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("null")]
    [InlineData("-1")]
    [InlineData("150001")]
    [InlineData("8500.5")]
    [InlineData("\"8500\"")]
    public async Task Invalid_values_are_400_on_steps_and_store_nothing(string? value)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps().With("steps", value));

        await response.ShouldBeValidationProblemAsync("steps");
        Assert.Empty(await client.GetOkAsync<List<StepsDto>>("/api/steps?from=2026-10-14&to=2026-10-14"));
    }

    [Fact]
    public async Task Delete_removes_the_date_then_404_not_found()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps())).ReadJsonAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/steps/2026-10-14")).StatusCode);

        Assert.Empty(await client.GetOkAsync<List<StepsDto>>("/api/steps?from=2026-10-14&to=2026-10-14"));
        await (await client.DeleteAsync("/api/steps/2026-10-14")).ShouldBeNotFoundAsync();
    }

    [Fact]
    public async Task Concurrent_puts_on_the_same_date_all_succeed_and_leave_one_row()
    {
        var user = TestUser.Alice();
        var client = await api.CreateRegisteredClientAsync(user);

        var responses = await Task.WhenAll(Enumerable.Range(0, 12)
            .Select(i => client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps(1000 + i))));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Single(await client.GetOkAsync<List<StepsDto>>("/api/steps?from=2026-10-14&to=2026-10-14"));
        Assert.Equal(1, (await api.CountRowsAsync(user.Uid)).Steps);
    }
}
