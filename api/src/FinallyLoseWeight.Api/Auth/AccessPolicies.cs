using Microsoft.AspNetCore.Authorization;

namespace FinallyLoseWeight.Api.Auth;

/// <summary>
/// Authorization policies implementing docs/API.md "Orden de comprobaciones de acceso".
/// Every endpoint under <c>/api</c> declares exactly one of them.
/// </summary>
public static class AccessPolicies
{
    /// <summary>Valid token only. GDPR endpoints: <c>GET /api/me/export</c> and <c>DELETE /api/me</c>.</summary>
    public const string AuthenticatedUser = nameof(AuthenticatedUser);

    /// <summary>Valid token + verified email + invited email. <c>/api/me</c> and <c>/api/cardio/machines</c>.</summary>
    public const string InvitedUser = nameof(InvitedUser);

    /// <summary><see cref="InvitedUser"/> + existing profile. Every data endpoint.</summary>
    public const string RegisteredUser = nameof(RegisteredUser);
}

/// <summary>
/// Requirement evaluated by <see cref="AccessAuthorizationHandler"/>: verified email, then invitation,
/// then (optionally) an existing profile — in that order, failing with the first unmet condition.
/// </summary>
public sealed record AccessRequirement(bool RequireProfile) : IAuthorizationRequirement;
