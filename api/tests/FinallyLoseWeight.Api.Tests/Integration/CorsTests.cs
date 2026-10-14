using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>
/// PLAN §4.7: CORS only for the PWA origin (<c>Cors:AllowedOrigins</c>). The PWA and the API live on different
/// origins, so the browser must also be able to read error statuses and the documented headers.
/// </summary>
public class CorsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string ForeignOrigin = "https://evil.example";

    private static HttpRequestMessage Preflight(string url, string origin, string method) => new(HttpMethod.Options, url)
    {
        Headers =
        {
            { "Origin", origin },
            { "Access-Control-Request-Method", method },
            { "Access-Control-Request-Headers", "authorization,content-type" },
        },
    };

    private static string? AllowOrigin(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? string.Join(",", values) : null;

    private static IEnumerable<string> HeaderList(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? values.SelectMany(v => v.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            : [];

    [Theory]
    [InlineData("/api/weights/2026-10-14", "PUT")]
    [InlineData("/api/meals", "POST")]
    [InlineData("/api/cardio/00000000-0000-7000-8000-000000000000", "DELETE")]
    [InlineData("/api/me", "DELETE")]
    public async Task Preflight_from_the_pwa_origin_is_allowed(string url, string method)
    {
        var response = await api.CreateAnonymousClient().SendAsync(Preflight(url, ApiFactory.CorsOrigin, method));

        Assert.True(response.IsSuccessStatusCode, $"Preflight failed with {(int)response.StatusCode}");
        Assert.Equal(ApiFactory.CorsOrigin, AllowOrigin(response));
        Assert.Contains(method, HeaderList(response, "Access-Control-Allow-Methods"), StringComparer.OrdinalIgnoreCase);
        var allowedHeaders = HeaderList(response, "Access-Control-Allow-Headers").ToList();
        Assert.Contains("authorization", allowedHeaders, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("content-type", allowedHeaders, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Preflight_from_a_foreign_origin_gets_no_allow_origin()
    {
        var response = await api.CreateAnonymousClient().SendAsync(Preflight("/api/weights/2026-10-14", ForeignOrigin, "PUT"));

        Assert.Null(AllowOrigin(response));
    }

    [Fact]
    public async Task Requests_from_a_foreign_origin_get_no_allow_origin()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me") { Headers = { { "Origin", ForeignOrigin } } };

        var response = await client.SendAsync(request);

        Assert.Null(AllowOrigin(response));
    }

    [Fact]
    public async Task Responses_to_the_pwa_origin_carry_allow_origin_even_for_errors()
    {
        // The PWA must be able to read a 401 (to sign in again) instead of seeing an opaque network error.
        var anonymous = new HttpRequestMessage(HttpMethod.Get, "/api/me") { Headers = { { "Origin", ApiFactory.CorsOrigin } } };
        var unauthorized = await api.CreateAnonymousClient().SendAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.Equal(ApiFactory.CorsOrigin, AllowOrigin(unauthorized));

        var client = await api.CreateRegisteredClientAsync(TestUser.Bob());
        var ok = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, "/api/me") { Headers = { { "Origin", ApiFactory.CorsOrigin } } });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(ApiFactory.CorsOrigin, AllowOrigin(ok));
    }

    [Fact]
    public async Task Export_exposes_content_disposition_to_the_pwa()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Carol());
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me/export") { Headers = { { "Origin", ApiFactory.CorsOrigin } } };

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Content-Disposition", HeaderList(response, "Access-Control-Expose-Headers"), StringComparer.OrdinalIgnoreCase);
    }
}
