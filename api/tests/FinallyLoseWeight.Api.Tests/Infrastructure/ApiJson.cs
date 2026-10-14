using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>JSON settings matching the API (web defaults: camelCase; enums as camelCase strings).</summary>
public static class ApiJson
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    /// <summary>Asserts the status code and deserializes the body (e.g. into the API's response records).</summary>
    public static async Task<T> ReadAsAsync<T>(this HttpResponseMessage response, HttpStatusCode expectedStatus = HttpStatusCode.OK)
    {
        Assert.True(response.StatusCode == expectedStatus,
            $"Expected {(int)expectedStatus} but got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        var value = await response.Content.ReadFromJsonAsync<T>(Options);
        Assert.NotNull(value);
        return value;
    }
}

/// <summary>Assertions for <c>application/problem+json</c> responses.</summary>
public static class ProblemAssertions
{
    /// <summary>
    /// Asserts an RFC 9457 problem with <paramref name="status"/> and, when given, the <c>code</c> extension
    /// (<c>null</c> = do not check the code). Returns the parsed body.
    /// </summary>
    public static async Task<JsonElement> ShouldBeProblemAsync(
        this HttpResponseMessage response, HttpStatusCode status, string? code = null)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"Expected {(int)status} but got {(int)response.StatusCode}: {body}");
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var problem = JsonDocument.Parse(body).RootElement.Clone();
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        if (code is not null)
        {
            Assert.True(problem.TryGetProperty("code", out var actual), $"Problem without 'code': {body}");
            Assert.Equal(code, actual.GetString());
        }

        return problem;
    }

    /// <summary>Asserts a 400 ValidationProblem whose <c>errors</c> keys are exactly <paramref name="fields"/>.</summary>
    public static async Task<Dictionary<string, string[]>> ShouldBeValidationProblemAsync(
        this HttpResponseMessage response, params string[] fields)
    {
        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest);
        var errors = problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>(ApiJson.Options)!;
        Assert.Equal(fields.Order(StringComparer.Ordinal), errors.Keys.Order(StringComparer.Ordinal));
        return errors;
    }
}
