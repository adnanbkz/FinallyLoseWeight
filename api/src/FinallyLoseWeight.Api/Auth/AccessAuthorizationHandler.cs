using FinallyLoseWeight.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Auth;

/// <summary>
/// Evaluates <see cref="AccessRequirement"/>. On failure the reason message is the problem code
/// (<see cref="ProblemCodes"/>) that <see cref="ProblemDetailsAuthorizationResultHandler"/> returns.
/// </summary>
public sealed class AccessAuthorizationHandler(InvitationList invitations, AppDbContext db)
    : AuthorizationHandler<AccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, AccessRequirement requirement)
    {
        var user = context.User;
        var uid = user.GetUid();
        if (uid is null)
        {
            // Anonymous: the authenticated-user requirement of the policy produces the 401 challenge.
            return;
        }

        if (!user.IsEmailVerified())
        {
            context.Fail(new AuthorizationFailureReason(this, ProblemCodes.EmailNotVerified));
            return;
        }

        if (!invitations.IsInvited(user.GetEmail()))
        {
            context.Fail(new AuthorizationFailureReason(this, ProblemCodes.NotInvited));
            return;
        }

        if (requirement.RequireProfile)
        {
            var cancellationToken = (context.Resource as HttpContext)?.RequestAborted ?? CancellationToken.None;
            var hasProfile = await db.UserProfiles.AnyAsync(p => p.Uid == uid, cancellationToken);
            if (!hasProfile)
            {
                context.Fail(new AuthorizationFailureReason(this, ProblemCodes.ProfileRequired));
                return;
            }
        }

        context.Succeed(requirement);
    }
}
