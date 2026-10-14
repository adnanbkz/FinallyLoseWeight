using System.Net;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>
/// docs/API.md range rules shared by every list ("from y to obligatorios, from ≤ to, rango ≤ 1100 días";
/// stats ≤ 366) and "YYYY-MM-DD" diary dates in paths.
/// </summary>
public class DiaryDateTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private static readonly string[] Lists = ["/api/weights", "/api/meals", "/api/steps", "/api/cardio"];

    public static TheoryData<string> ListsAndStats => new([.. Lists, "/api/stats"]);

    public static TheoryData<string, string, string> MissingOrMalformed
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var url in Lists.Append("/api/stats"))
            {
                data.Add(url, "", "from,to");
                data.Add(url, "?to=2026-10-14", "from");
                data.Add(url, "?from=2026-10-01", "to");
                data.Add(url, "?from=&to=2026-10-14", "from");
                data.Add(url, "?from=2026-02-30&to=2026-10-14", "from");
                data.Add(url, "?from=01/10/2026&to=2026-10-14", "from");
                data.Add(url, "?from=2026-10-01&to=mañana", "to");
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(MissingOrMalformed))]
    public async Task Missing_or_malformed_from_and_to_are_400_on_that_parameter(string url, string query, string fields)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.GetAsync(url + query);

        await response.ShouldBeValidationProblemIncludingAsync(fields.Split(','));
    }

    [Theory]
    [MemberData(nameof(ListsAndStats))]
    public async Task From_after_to_is_400(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.GetAsync($"{url}?from=2026-10-15&to=2026-10-14");

        await response.ShouldBeValidationProblemIncludingAsync();
    }

    [Theory]
    [MemberData(nameof(ListsAndStats))]
    public async Task Same_from_and_to_is_a_valid_one_day_range(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var response = await client.GetAsync($"{url}?from=2026-10-14&to=2026-10-14");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public static TheoryData<string> ListUrls => new(Lists);

    [Theory]
    [MemberData(nameof(ListUrls))]
    public async Task Lists_accept_1100_days(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        // 1100 days counting both ends (to - from = 1099): valid under any reading of "≤ 1100 días".
        var to = Dates.Plus("2024-01-01", 1099);

        var response = await client.GetAsync($"{url}?from=2024-01-01&to={to}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(ListUrls))]
    public async Task Lists_reject_more_than_1100_days(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        // to - from = 1101: too long under any reading.
        var to = Dates.Plus("2024-01-01", 1101);

        var response = await client.GetAsync($"{url}?from=2024-01-01&to={to}");

        await response.ShouldBeValidationProblemIncludingAsync();
    }

    public static TheoryData<string, string> InvalidPathDates
    {
        get
        {
            var data = new TheoryData<string, string>();
            foreach (var date in new[] { "2026-02-30", "2026-13-01", "14-10-2026", "hoy" })
            {
                data.Add("PUT", $"/api/weights/{date}");
                data.Add("DELETE", $"/api/weights/{date}");
                data.Add("PUT", $"/api/steps/{date}");
                data.Add("DELETE", $"/api/steps/{date}");
                data.Add("GET", $"/api/days/{date}");
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(InvalidPathDates))]
    public async Task Invalid_dates_in_the_path_are_400(string method, string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var body = url.Contains("/weights/") ? Bodies.Weight() : url.Contains("/steps/") ? Bodies.Steps() : null;

        var response = await client.SendJsonAsync(new HttpMethod(method), url, method == "PUT" ? body : null);

        await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Leap_day_is_a_valid_date()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        var weight = (await (await client.PutJsonAsync("/api/weights/2028-02-29", Bodies.Weight())).ReadJsonAsync()).As<WeightDto>();

        Assert.Equal("2028-02-29", weight.Date);
    }

    public static TheoryData<string> ExtremeDateRequests => new()
    {
        "/api/stats?from=0001-01-01&to=0001-01-07",
        "/api/stats?from=9999-12-25&to=9999-12-31",
        "/api/days/0001-01-01",
        "/api/days/9999-12-31",
        "/api/weights?from=0001-01-01&to=0001-01-31",
        "/api/meals?from=9999-12-01&to=9999-12-31",
    };

    [Theory]
    [MemberData(nameof(ExtremeDateRequests))]
    public async Task Earliest_and_latest_representable_dates_are_handled(string url)
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/0001-01-01", Bodies.Weight(70m))).ReadJsonAsync();
        await (await client.PutJsonAsync("/api/weights/9999-12-31", Bodies.Weight(71m))).ReadJsonAsync();
        await (await client.PostJsonAsync("/api/cardio", Bodies.Cardio("9999-12-31", weightKg: null))).ReadJsonAsync(HttpStatusCode.Created);
        await (await client.PostJsonAsync("/api/cardio", Bodies.Cardio("0001-01-01", weightKg: null))).ReadJsonAsync(HttpStatusCode.Created);

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Stats_at_the_end_of_the_calendar_has_one_element_per_day()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        await (await client.PutJsonAsync("/api/weights/9999-12-31", Bodies.Weight(71m))).ReadJsonAsync();

        var stats = await client.GetOkAsync<StatsDto>("/api/stats?from=9999-12-25&to=9999-12-31");

        Assert.Equal(7, stats.Days.Count);
        Assert.Equal((71m, 71m), (stats.Days[^1].WeightKg, stats.Days[^1].WeightTrendKg));
    }
}
