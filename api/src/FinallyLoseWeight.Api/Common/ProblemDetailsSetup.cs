using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace FinallyLoseWeight.Api.Common;

public static class ProblemDetailsSetup
{
    /// <summary>
    /// Every error is <c>application/problem+json</c>: endpoint results, authorization failures, rate
    /// limiting, unmatched routes (status code pages) and exceptions. Exception details are only added
    /// in Development.
    /// </summary>
    public static IServiceCollection AddApiProblemDetails(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = Customize);
        services.AddExceptionHandler<BadRequestExceptionHandler>();

        // Binding failures (malformed JSON, wrong types, missing body) throw BadHttpRequestException in
        // every environment, so BadRequestExceptionHandler can answer with a consistent ValidationProblem.
        services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

        return services;
    }

    private static readonly Dictionary<int, string> SpanishTitles = new()
    {
        [StatusCodes.Status400BadRequest] = "Petición no válida",
        [StatusCodes.Status401Unauthorized] = "No autenticado",
        [StatusCodes.Status403Forbidden] = "Acceso denegado",
        [StatusCodes.Status404NotFound] = "No encontrado",
        [StatusCodes.Status405MethodNotAllowed] = "Método no permitido",
        [StatusCodes.Status406NotAcceptable] = "Formato no aceptable",
        [StatusCodes.Status408RequestTimeout] = "Tiempo de espera agotado",
        [StatusCodes.Status409Conflict] = "Conflicto",
        [StatusCodes.Status413PayloadTooLarge] = "Petición demasiado grande",
        [StatusCodes.Status415UnsupportedMediaType] = "Tipo de contenido no admitido",
        [StatusCodes.Status422UnprocessableEntity] = "No se puede procesar",
        [StatusCodes.Status429TooManyRequests] = "Demasiadas peticiones",
        [StatusCodes.Status500InternalServerError] = "Error interno del servidor",
        [StatusCodes.Status503ServiceUnavailable] = "Servicio no disponible",
    };

    // Titles the framework fills in on its own; they are replaced by the Spanish ones above.
    private static readonly HashSet<string> FrameworkTitles = new(StringComparer.Ordinal)
    {
        "An error occurred while processing your request.",
        "One or more validation errors occurred.",
    };

    private static void Customize(ProblemDetailsContext context)
    {
        var problem = context.ProblemDetails;
        var status = problem.Status ?? context.HttpContext.Response.StatusCode;

        var isFrameworkTitle = problem.Title is null
            || FrameworkTitles.Contains(problem.Title)
            || problem.Title == ReasonPhrases.GetReasonPhrase(status);

        if (isFrameworkTitle)
        {
            if (problem is HttpValidationProblemDetails)
            {
                problem.Title = ValidationErrors.Title;
            }
            else if (SpanishTitles.TryGetValue(status, out var title))
            {
                problem.Title = title;
            }
        }

        if (context.Exception is not null
            && context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment())
        {
            problem.Extensions["exception"] = context.Exception.ToString();
        }
    }
}

/// <summary>
/// Maps <see cref="BadHttpRequestException"/> (request binding failures) to problem responses.
/// A JSON value of the wrong type becomes a ValidationProblem keyed by the camelCase property name.
/// </summary>
public sealed class BadRequestExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException badRequest)
        {
            return false;
        }

        httpContext.Response.StatusCode = badRequest.StatusCode;

        ProblemDetails problem;
        if (badRequest.StatusCode == StatusCodes.Status400BadRequest
            && badRequest.InnerException is JsonException { Path: { } path })
        {
            problem = new HttpValidationProblemDetails(new Dictionary<string, string[]>
            {
                [FieldFromJsonPath(path)] = [ValidationErrors.Messages.InvalidValue],
            })
            {
                Status = StatusCodes.Status400BadRequest,
                Title = ValidationErrors.Title,
            };
        }
        else
        {
            problem = new ProblemDetails
            {
                Status = badRequest.StatusCode,
                Detail = badRequest.StatusCode == StatusCodes.Status415UnsupportedMediaType
                    ? "El cuerpo de la petición debe ser JSON (Content-Type: application/json)."
                    : "La petición no tiene el formato esperado.",
            };
        }

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    // "$.weightKg" -> "weightKg"; "$" (the whole body) -> "body".
    private static string FieldFromJsonPath(string path)
    {
        var field = path.StartsWith("$.", StringComparison.Ordinal) ? path[2..] : path.TrimStart('$');
        return string.IsNullOrEmpty(field) ? "body" : field;
    }
}
