using FinallyLoseWeight.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Authentication;

namespace FinallyLoseWeight.Api.Auth;

/// <summary>
/// Turns authorization failures into <c>application/problem+json</c>: 401 (keeping the
/// <c>WWW-Authenticate</c> header added by the JWT handler) and 403 with the access <c>code</c>.
/// </summary>
public sealed class ProblemDetailsAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    public async Task HandleAsync(
        RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            if (policy.AuthenticationSchemes.Count > 0)
            {
                foreach (var scheme in policy.AuthenticationSchemes)
                {
                    await context.ChallengeAsync(scheme);
                }
            }
            else
            {
                await context.ChallengeAsync();
            }

            await ApiProblems.Unauthorized().ExecuteAsync(context);
            return;
        }

        if (authorizeResult.Forbidden)
        {
            var code = authorizeResult.AuthorizationFailure?.FailureReasons
                .Where(reason => reason.Handler is AccessAuthorizationHandler)
                .Select(reason => reason.Message)
                .FirstOrDefault();

            await ApiProblems.Forbidden(code).ExecuteAsync(context);
            return;
        }

        await next(context);
    }
}
