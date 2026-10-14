using System.Text.Json.Nodes;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>One documented <c>/api</c> operation with a valid request (so only access rules can reject it).</summary>
public sealed record ApiOperation(HttpMethod Method, string Url, JsonNode? Body = null)
{
    public Task<HttpResponseMessage> SendAsync(HttpClient client) => client.SendJsonAsync(Method, Url, Body?.DeepClone());
}

/// <summary>
/// Every <c>/api</c> operation of docs/API.md, grouped by the access level the contract demands
/// ("Orden de comprobaciones de acceso"). Theories take the operation name (serializable) and look it up.
/// </summary>
public static class EndpointCatalog
{
    private static readonly string SomeId = Guid.CreateVersion7().ToString();

    /// <summary>Only a valid token (GDPR): <c>GET /api/me/export</c> and <c>DELETE /api/me</c>.</summary>
    public static IReadOnlyDictionary<string, ApiOperation> TokenOnly { get; } = new Dictionary<string, ApiOperation>
    {
        ["GET /api/me/export"] = new(HttpMethod.Get, "/api/me/export"),
        ["DELETE /api/me"] = new(HttpMethod.Delete, "/api/me"),
    };

    /// <summary>Valid token + verified email + invitation, but no profile.</summary>
    public static IReadOnlyDictionary<string, ApiOperation> InvitedOnly { get; } = new Dictionary<string, ApiOperation>
    {
        ["GET /api/me"] = new(HttpMethod.Get, "/api/me"),
        ["PUT /api/me"] = new(HttpMethod.Put, "/api/me", Bodies.Profile()),
        ["GET /api/cardio/machines"] = new(HttpMethod.Get, "/api/cardio/machines"),
    };

    /// <summary>Data endpoints: everything else, which also needs a completed profile.</summary>
    public static IReadOnlyDictionary<string, ApiOperation> Data { get; } = new Dictionary<string, ApiOperation>
    {
        ["GET /api/weights"] = new(HttpMethod.Get, "/api/weights?from=2026-10-01&to=2026-10-14"),
        ["PUT /api/weights/{date}"] = new(HttpMethod.Put, "/api/weights/2026-10-14", Bodies.Weight()),
        ["DELETE /api/weights/{date}"] = new(HttpMethod.Delete, "/api/weights/2026-10-14"),
        ["GET /api/meals"] = new(HttpMethod.Get, "/api/meals?from=2026-10-01&to=2026-10-14"),
        ["POST /api/meals"] = new(HttpMethod.Post, "/api/meals", Bodies.Meal()),
        ["PUT /api/meals/{id}"] = new(HttpMethod.Put, $"/api/meals/{SomeId}", Bodies.Meal()),
        ["DELETE /api/meals/{id}"] = new(HttpMethod.Delete, $"/api/meals/{SomeId}"),
        ["GET /api/steps"] = new(HttpMethod.Get, "/api/steps?from=2026-10-01&to=2026-10-14"),
        ["PUT /api/steps/{date}"] = new(HttpMethod.Put, "/api/steps/2026-10-14", Bodies.Steps()),
        ["DELETE /api/steps/{date}"] = new(HttpMethod.Delete, "/api/steps/2026-10-14"),
        ["POST /api/cardio/estimate"] = new(HttpMethod.Post, "/api/cardio/estimate", Bodies.Cardio()),
        ["GET /api/cardio"] = new(HttpMethod.Get, "/api/cardio?from=2026-10-01&to=2026-10-14"),
        ["POST /api/cardio"] = new(HttpMethod.Post, "/api/cardio", Bodies.Cardio()),
        ["PUT /api/cardio/{id}"] = new(HttpMethod.Put, $"/api/cardio/{SomeId}", Bodies.Cardio()),
        ["DELETE /api/cardio/{id}"] = new(HttpMethod.Delete, $"/api/cardio/{SomeId}"),
        ["GET /api/days/{date}"] = new(HttpMethod.Get, "/api/days/2026-10-14"),
        ["GET /api/stats"] = new(HttpMethod.Get, "/api/stats?from=2026-10-01&to=2026-10-14"),
    };

    /// <summary>Everything that needs an invitation (verified, allow-listed email).</summary>
    public static IReadOnlyDictionary<string, ApiOperation> InvitationRequired { get; } =
        InvitedOnly.Concat(Data).ToDictionary();

    public static IReadOnlyDictionary<string, ApiOperation> All { get; } =
        TokenOnly.Concat(InvitationRequired).ToDictionary();

    public static TheoryData<string> Names(IReadOnlyDictionary<string, ApiOperation> operations) => new(operations.Keys);
}
