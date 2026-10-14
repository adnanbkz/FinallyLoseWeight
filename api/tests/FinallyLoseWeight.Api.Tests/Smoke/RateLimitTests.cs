using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Smoke;

/// <summary><see cref="ApiFactory"/> with a tiny rate limit (example of overriding configuration).</summary>
public sealed class LowRateLimitApiFactory : ApiFactory
{
    public const int PermitsPerMinute = 3;

    protected override void ConfigureSettings(IDictionary<string, string?> settings)
    {
        base.ConfigureSettings(settings);
        settings["RateLimit:PermitsPerMinute"] = PermitsPerMinute.ToString();
    }
}

public class RateLimitTests(LowRateLimitApiFactory api) : IClassFixture<LowRateLimitApiFactory>
{
    [Fact]
    public async Task Requests_over_the_limit_get_429_with_retry_after_per_user()
    {
        var alice = api.CreateClientFor(TestUser.Alice());
        for (var i = 0; i < LowRateLimitApiFactory.PermitsPerMinute; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync("/api/cardio/machines")).StatusCode);
        }

        var limited = await alice.GetAsync("/api/cardio/machines");

        await limited.ShouldBeProblemAsync(HttpStatusCode.TooManyRequests);
        Assert.True(limited.Headers.RetryAfter?.Delta > TimeSpan.Zero);

        // Partitioned by UID: another user is not affected.
        var bob = api.CreateClientFor(TestUser.Bob());
        Assert.Equal(HttpStatusCode.OK, (await bob.GetAsync("/api/cardio/machines")).StatusCode);
    }

    [Fact]
    public async Task Health_is_never_rate_limited()
    {
        var client = api.CreateAnonymousClient();
        for (var i = 0; i < LowRateLimitApiFactory.PermitsPerMinute * 2; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        }
    }
}
