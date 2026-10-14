using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// Valid request bodies taken from the examples in docs/API.md, as mutable JSON so validation tests can
/// change or remove a single property (<see cref="With"/>) and send exactly what a client would send.
/// </summary>
public static class Bodies
{
    public static JsonObject Profile(string displayName = "Tester", bool? acceptPrivacy = true) => new()
    {
        ["displayName"] = displayName,
        ["heightCm"] = 178,
        ["targetWeightKg"] = 75.0m,
        ["dailyKcalTarget"] = 2200,
        ["acceptPrivacy"] = acceptPrivacy,
    };

    public static JsonObject Weight(decimal weightKg = 72.5m, string? note = null) => new()
    {
        ["weightKg"] = weightKg,
        ["note"] = note,
    };

    public static JsonObject Meal(
        string date = "2026-10-14",
        string mealType = "lunch",
        string description = "Pollo con arroz",
        int kcal = 650,
        decimal? proteinG = 45m,
        decimal? carbsG = 70m,
        decimal? fatG = 15m) => new()
        {
            ["date"] = date,
            ["mealType"] = mealType,
            ["description"] = description,
            ["kcal"] = kcal,
            ["proteinG"] = proteinG,
            ["carbsG"] = carbsG,
            ["fatG"] = fatG,
        };

    public static JsonObject Steps(int steps = 8500) => new() { ["steps"] = steps };

    /// <summary>The contract example (4.8 km/h, 12 %, 30 min); with 70 kg it gives 302 / 265 kcal.</summary>
    public static JsonObject Cardio(
        string date = "2026-10-14",
        decimal? weightKg = 70m,
        decimal durationMin = 30m,
        decimal avgSpeedKmh = 4.8m,
        decimal inclinePercent = 12m,
        string? note = null) => new()
        {
            ["date"] = date,
            ["machine"] = "incline-treadmill",
            ["durationMin"] = durationMin,
            ["avgSpeedKmh"] = avgSpeedKmh,
            ["inclinePercent"] = inclinePercent,
            ["resistanceLevel"] = null,
            ["weightKg"] = weightKg,
            ["note"] = note,
        };

    /// <summary>
    /// Copy of <paramref name="body"/> with <paramref name="property"/> set to the raw JSON
    /// <paramref name="rawJson"/> (e.g. <c>"-1"</c>, <c>"\"text\""</c>, <c>"null"</c>), or removed when it is <c>null</c>.
    /// </summary>
    public static JsonObject With(this JsonObject body, string property, string? rawJson)
    {
        var copy = body.DeepClone().AsObject();
        if (rawJson is null)
        {
            copy.Remove(property);
        }
        else
        {
            copy[property] = JsonNode.Parse(rawJson);
        }

        return copy;
    }

    /// <summary>A JSON string literal of <paramref name="length"/> characters.</summary>
    public static string JsonString(int length, char c = 'a') => JsonSerializer.Serialize(new string(c, length));
}

/// <summary>Small HTTP helpers for the contract tests.</summary>
public static class ContractHttp
{
    public static Task<HttpResponseMessage> SendJsonAsync(this HttpClient client, HttpMethod method, string url, JsonNode? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null)
        {
            request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        }

        return client.SendAsync(request);
    }

    public static Task<HttpResponseMessage> PutJsonAsync(this HttpClient client, string url, JsonNode body) =>
        client.SendJsonAsync(HttpMethod.Put, url, body);

    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, JsonNode body) =>
        client.SendJsonAsync(HttpMethod.Post, url, body);

    /// <summary>GET that must answer 200 with a JSON body of type <typeparamref name="T"/>.</summary>
    public static async Task<T> GetOkAsync<T>(this HttpClient client, string url) =>
        await (await client.GetAsync(url)).ReadAsAsync<T>();

    /// <summary>Asserts <paramref name="expectedStatus"/> and returns the JSON body as an element.</summary>
    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response, HttpStatusCode expectedStatus = HttpStatusCode.OK)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expectedStatus,
            $"Expected {(int)expectedStatus} but got {(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    public static T As<T>(this JsonElement element) => element.Deserialize<T>(ApiJson.Options)!;

    public static Task<JsonElement> ShouldBeNotFoundAsync(this HttpResponseMessage response) =>
        response.ShouldBeProblemAsync(HttpStatusCode.NotFound, "not_found");

    /// <summary>Asserts a 400 ValidationProblem whose <c>errors</c> contain (at least) every key in <paramref name="fields"/>.</summary>
    public static async Task<Dictionary<string, string[]>> ShouldBeValidationProblemIncludingAsync(
        this HttpResponseMessage response, params string[] fields)
    {
        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest);
        Assert.True(problem.TryGetProperty("errors", out var errorsElement), $"ValidationProblem without 'errors': {problem}");
        var errors = errorsElement.Deserialize<Dictionary<string, string[]>>(ApiJson.Options)!;
        Assert.NotEmpty(errors);
        foreach (var field in fields)
        {
            Assert.True(errors.TryGetValue(field, out var messages) && messages.Length > 0,
                $"Expected a validation error for '{field}', got: {string.Join(", ", errors.Keys)}");
        }

        return errors;
    }
}

/// <summary>Exact JSON shape assertions (property names are case-sensitive: the contract is camelCase).</summary>
public static class JsonShape
{
    public static void ShouldHaveExactly(this JsonElement element, IEnumerable<string> properties)
    {
        Assert.Equal(JsonValueKind.Object, element.ValueKind);
        var actual = element.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal).ToArray();
        var expected = properties.Order(StringComparer.Ordinal).ToArray();
        Assert.Equal(expected, actual);
    }

    /// <summary>
    /// <paramref name="actual"/> equals the raw JSON <paramref name="expectedJson"/>; numbers compare by value
    /// (<c>72.5</c> equals <c>72.50</c>).
    /// </summary>
    public static void ShouldEqualJson(string expectedJson, JsonElement actual)
    {
        var expected = JsonDocument.Parse(expectedJson).RootElement;
        Assert.Equal(expected.ValueKind, actual.ValueKind);
        if (expected.ValueKind == JsonValueKind.Number)
        {
            Assert.Equal(expected.GetDecimal(), actual.GetDecimal());
        }
        else
        {
            Assert.Equal(expected.GetRawText(), actual.GetRawText());
        }
    }

    /// <summary>The instant is ISO 8601 in UTC (e.g. <c>2026-10-14T08:30:00Z</c>).</summary>
    public static DateTimeOffset ShouldBeUtcInstant(this JsonElement element)
    {
        Assert.Equal(JsonValueKind.String, element.ValueKind);
        var text = element.GetString()!;
        Assert.True(text.EndsWith('Z') || text.EndsWith("+00:00", StringComparison.Ordinal), $"Not a UTC instant: {text}");
        return DateTimeOffset.Parse(text, CultureInfo.InvariantCulture);
    }
}

/// <summary>Diary date arithmetic on "YYYY-MM-DD" strings.</summary>
public static class Dates
{
    public static DateOnly Parse(string date) => DateOnly.ParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string Format(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string Plus(string date, int days) => Format(Parse(date).AddDays(days));
}
