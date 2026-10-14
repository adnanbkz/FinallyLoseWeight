using FinallyLoseWeight.Api.Auth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace FinallyLoseWeight.Api.Common;

/// <summary>
/// Factory for every <c>application/problem+json</c> response defined by docs/API.md.
/// Titles and details are user-facing, so they are in Spanish; clients should branch on
/// <see cref="ProblemCodes"/> (the <c>code</c> extension), never on the text.
/// </summary>
public static class ApiProblems
{
    public static ProblemHttpResult Unauthorized() =>
        Create(StatusCodes.Status401Unauthorized, code: null,
            "No autenticado", "Falta el token de acceso, no es válido o ha caducado.");

    /// <summary>401 for a valid token whose Firebase user was deleted or disabled after it was issued.</summary>
    public static ProblemHttpResult AccountInactive() =>
        Create(StatusCodes.Status401Unauthorized, code: null,
            "No autenticado", "Tu cuenta ya no existe o está desactivada. Vuelve a iniciar sesión.");

    public static ProblemHttpResult ReauthRequired() =>
        Create(StatusCodes.Status401Unauthorized, ProblemCodes.ReauthRequired,
            "Vuelve a iniciar sesión",
            "Por seguridad, vuelve a iniciar sesión antes de borrar tu cuenta.");

    /// <summary>403 for a failed access check. <paramref name="code"/> is one of the access codes or <c>null</c>.</summary>
    public static ProblemHttpResult Forbidden(string? code) => code switch
    {
        ProblemCodes.EmailNotVerified => Create(StatusCodes.Status403Forbidden, code,
            "Email no verificado", "Verifica tu email para poder usar la aplicación."),
        ProblemCodes.NotInvited => Create(StatusCodes.Status403Forbidden, code,
            "Sin invitación", "Tu email no está en la lista de invitados."),
        ProblemCodes.ProfileRequired => Create(StatusCodes.Status403Forbidden, code,
            "Perfil pendiente", "Completa el alta (perfil y consentimiento) antes de registrar datos."),
        _ => Create(StatusCodes.Status403Forbidden, code: null,
            "Acceso denegado", "No tienes permiso para realizar esta acción."),
    };

    /// <summary>404 for a resource that does not exist <b>or belongs to another user</b>.</summary>
    public static ProblemHttpResult NotFound() =>
        Create(StatusCodes.Status404NotFound, ProblemCodes.NotFound,
            "No encontrado", "El recurso no existe.");

    public static ProblemHttpResult ProfileNotFound() =>
        Create(StatusCodes.Status404NotFound, ProblemCodes.ProfileNotFound,
            "Perfil no encontrado", "Todavía no has completado el alta.");

    public static ProblemHttpResult WeightRequired() =>
        Create(StatusCodes.Status422UnprocessableEntity, ProblemCodes.WeightRequired,
            "Falta el peso",
            "Registra tu peso en esa fecha o una anterior, o indícalo en el formulario, para calcular las calorías.");

    public static ProblemHttpResult TooManyRequests(int retryAfterSeconds) =>
        Create(StatusCodes.Status429TooManyRequests, code: null,
            "Demasiadas peticiones",
            $"Has superado el límite de peticiones. Vuelve a intentarlo en {retryAfterSeconds} s.");

    private static ProblemHttpResult Create(int status, string? code, string title, string detail)
    {
        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        if (code is not null)
        {
            problem.Extensions[ProblemCodes.ExtensionName] = code;
        }

        return TypedResults.Problem(problem);
    }
}
