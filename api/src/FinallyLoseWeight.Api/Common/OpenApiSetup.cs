using System.Text.Json.Nodes;
using FinallyLoseWeight.Api.Auth;
using Microsoft.OpenApi;

namespace FinallyLoseWeight.Api.Common;

public static class OpenApiSetup
{
    /// <summary>Name of the only OpenAPI document (<c>/openapi/v1.json</c> in Development).</summary>
    public const string DocumentName = "v1";

    /// <summary>Schema listing every <see cref="ProblemCodes"/> value (the <c>code</c> of problem responses).</summary>
    public const string ProblemCodeSchema = "ProblemCode";

    /// <summary>
    /// OpenAPI document of the API. Served only in Development, but always registered: the tests generate it
    /// to keep the committed contract snapshot (docs/openapi.json) in sync with the code, and the web tests
    /// compare that snapshot with web/src/api/types.ts.
    /// </summary>
    public static IServiceCollection AddApiOpenApi(this IServiceCollection services) =>
        services.AddOpenApi(DocumentName, options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info.Title = "FinallyLoseWeight API";
            document.Components ??= new OpenApiComponents();
            document.Components.Schemas ??= new Dictionary<string, IOpenApiSchema>();
            document.Components.Schemas[ProblemCodeSchema] = new OpenApiSchema
            {
                Type = JsonSchemaType.String,
                Description = "Valores de la extensión `code` de las respuestas application/problem+json.",
                Enum = [.. ProblemCodes.All.Select(code => (JsonNode)JsonValue.Create(code))],
            };
            return Task.CompletedTask;
        }));
}
