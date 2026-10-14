using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using FinallyLoseWeight.Api.Tests.Infrastructure;

namespace FinallyLoseWeight.Api.Tests.Integration;

/// <summary>
/// docs/API.md "Convenciones" for request bodies: JSON objects, numbers as JSON numbers, validation errors
/// as 400 (never 500) keyed by the camelCase field.
/// </summary>
public class RequestBodyTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private static readonly Dictionary<string, (HttpMethod Method, string Url, Func<JsonObject> Body, string NumericField)> Operations = new()
    {
        ["PUT /api/me"] = (HttpMethod.Put, "/api/me", () => Bodies.Profile(), "heightCm"),
        ["PUT /api/weights/{date}"] = (HttpMethod.Put, "/api/weights/2026-10-14", () => Bodies.Weight(), "weightKg"),
        ["POST /api/meals"] = (HttpMethod.Post, "/api/meals", () => Bodies.Meal(), "kcal"),
        ["PUT /api/steps/{date}"] = (HttpMethod.Put, "/api/steps/2026-10-14", () => Bodies.Steps(), "steps"),
        ["POST /api/cardio/estimate"] = (HttpMethod.Post, "/api/cardio/estimate", () => Bodies.Cardio(), "durationMin"),
        ["POST /api/cardio"] = (HttpMethod.Post, "/api/cardio", () => Bodies.Cardio(), "durationMin"),
    };

    public static TheoryData<string> OperationNames => new(Operations.Keys);

    private async Task<HttpResponseMessage> SendRawAsync(string operation, string? rawBody)
    {
        var (method, url, _, _) = Operations[operation];
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());
        var request = new HttpRequestMessage(method, url);
        if (rawBody is not null)
        {
            request.Content = new StringContent(rawBody, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request);
    }

    [Theory]
    [MemberData(nameof(OperationNames))]
    public async Task Missing_body_is_400(string operation)
    {
        await (await SendRawAsync(operation, null)).ShouldBeProblemAsync(HttpStatusCode.BadRequest);
    }

    [Theory]
    [MemberData(nameof(OperationNames))]
    public async Task Malformed_json_is_400(string operation)
    {
        await (await SendRawAsync(operation, """{ "date": "2026-10-14", """)).ShouldBeProblemAsync(HttpStatusCode.BadRequest);
    }

    [Theory]
    [MemberData(nameof(OperationNames))]
    public async Task Json_that_is_not_an_object_is_400(string operation)
    {
        await (await SendRawAsync(operation, "[]")).ShouldBeProblemAsync(HttpStatusCode.BadRequest);
    }

    [Theory]
    [MemberData(nameof(OperationNames))]
    public async Task Numbers_sent_as_strings_are_400_on_that_field(string operation)
    {
        var (_, _, body, field) = Operations[operation];
        var value = body()[field]!.ToJsonString();

        var response = await SendRawAsync(operation, body().With(field, $"\"{value}\"").ToJsonString());

        await response.ShouldBeValidationProblemAsync(field);
    }

    [Theory]
    [MemberData(nameof(OperationNames))]
    public async Task Numbers_too_large_for_any_type_are_400_on_that_field(string operation)
    {
        var (_, _, body, field) = Operations[operation];

        var response = await SendRawAsync(operation, body().With(field, "1e40").ToJsonString());

        await response.ShouldBeValidationProblemAsync(field);
    }

    [Fact]
    public async Task Integer_fields_reject_values_beyond_int32()
    {
        var client = await api.CreateRegisteredClientAsync(TestUser.Alice());

        await (await client.PutJsonAsync("/api/steps/2026-10-14", Bodies.Steps().With("steps", "3000000000")))
            .ShouldBeValidationProblemAsync("steps");
        await (await client.PostJsonAsync("/api/meals", Bodies.Meal().With("kcal", "-3000000000")))
            .ShouldBeValidationProblemAsync("kcal");
    }
}
