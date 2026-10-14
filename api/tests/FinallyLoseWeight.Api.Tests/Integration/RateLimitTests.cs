using System.Globalization;
using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary><see cref="ApiFactory"/> with a tiny <c>RateLimit:PermitsPerMinute</c>.</summary>
public sealed class TinyRateLimitApiFactory : ApiFactory
{
    public const int PermitsPerMinute = 5;

    protected override void ConfigureSettings(IDictionary<string, string?> settings)
    {
        base.ConfigureSettings(settings);
        settings["RateLimit:PermitsPerMinute"] = PermitsPerMinute.ToString(CultureInfo.InvariantCulture);
    }
}

/// <summary>docs/API.md: 429 with <c>Retry-After</c> in seconds; PLAN §4: limiter partitioned by UID.</summary>
public class RateLimitTests(TinyRateLimitApiFactory api) : IClassFixture<TinyRateLimitApiFactory>
{
    [Fact]
    public async Task Exceeding_the_limit_is_429_problem_with_retry_after_in_seconds()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice()); // uses 1 permit
        for (var i = 1; i < TinyRateLimitApiFactory.PermitsPerMinute; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/days/2026-10-14")).StatusCode);
        }

        var limited = await client.GetAsync("/api/days/2026-10-14");

        await limited.ShouldBeProblemAsync(HttpStatusCode.TooManyRequests);
        Assert.True(limited.Headers.TryGetValues("Retry-After", out var values), "429 without Retry-After");
        var seconds = int.Parse(Assert.Single(values), NumberStyles.None, CultureInfo.InvariantCulture);
        Assert.InRange(seconds, 1, 60);
    }

    [Fact]
    public async Task Writes_are_rejected_too_and_not_applied()
    {
        var user = TestUser.Bob();
        var client = await api.CreateRegisteredClientAsync(user);
        for (var i = 1; i < TinyRateLimitApiFactory.PermitsPerMinute; i++)
        {
            await client.GetAsync("/api/cardio/machines");
        }

        var limited = await client.PutJsonAsync("/api/weights/2026-10-14", Bodies.Weight());

        await limited.ShouldBeProblemAsync(HttpStatusCode.TooManyRequests);
        Assert.Equal(0, (await api.CountRowsAsync(user.Uid)).Weights);
    }

    [Fact]
    public async Task Each_user_has_their_own_budget()
    {
        var alice = api.CreateClientFor(TestUser.Alice());
        for (var i = 0; i < TinyRateLimitApiFactory.PermitsPerMinute; i++)
        {
            await alice.GetAsync("/api/cardio/machines");
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await alice.GetAsync("/api/cardio/machines")).StatusCode);

        var carol = api.CreateClientFor(TestUser.Carol());
        Assert.Equal(HttpStatusCode.OK, (await carol.GetAsync("/api/cardio/machines")).StatusCode);
    }
}
