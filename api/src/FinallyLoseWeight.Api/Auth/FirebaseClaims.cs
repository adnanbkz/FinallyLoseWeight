using System.Globalization;
using System.Security.Claims;

namespace FinallyLoseWeight.Api.Auth;

/// <summary>Claim names of Firebase ID tokens (inbound claim mapping is disabled, so these are the raw JWT names).</summary>
public static class FirebaseClaimTypes
{
    /// <summary>Firebase UID. The only source of the user's identity.</summary>
    public const string Subject = "sub";
    public const string Email = "email";
    public const string EmailVerified = "email_verified";

    /// <summary>Seconds since the Unix epoch of the last real sign-in (not of the token refresh).</summary>
    public const string AuthTime = "auth_time";
}

public static class FirebaseClaimsPrincipalExtensions
{
    /// <summary>The Firebase UID (<c>sub</c>) of an authenticated principal, or <c>null</c>.</summary>
    public static string? GetUid(this ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var uid = principal.FindFirstValue(FirebaseClaimTypes.Subject);
        return string.IsNullOrWhiteSpace(uid) ? null : uid;
    }

    public static string? GetEmail(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(FirebaseClaimTypes.Email);

    public static bool IsEmailVerified(this ClaimsPrincipal principal) =>
        bool.TryParse(principal.FindFirstValue(FirebaseClaimTypes.EmailVerified), out var verified) && verified;

    /// <summary>Instant of the last interactive sign-in, or <c>null</c> when the claim is missing or malformed.</summary>
    public static DateTimeOffset? GetAuthTime(this ClaimsPrincipal principal)
    {
        var raw = principal.FindFirstValue(FirebaseClaimTypes.AuthTime);
        if (!long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds))
        {
            return null;
        }

        try
        {
            return DateTimeOffset.FromUnixTimeSeconds(seconds);
        }
        catch (ArgumentOutOfRangeException)
        {
            return null;
        }
    }
}
