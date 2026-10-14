namespace FinallyLoseWeight.Api.Auth;

/// <summary>Values of the <c>code</c> extension of problem responses (docs/API.md, "Errores").</summary>
public static class ProblemCodes
{
    /// <summary>Name of the problem details extension that carries the code.</summary>
    public const string ExtensionName = "code";

    public const string ReauthRequired = "reauth_required";
    public const string EmailNotVerified = "email_not_verified";
    public const string NotInvited = "not_invited";
    public const string ProfileRequired = "profile_required";
    public const string NotFound = "not_found";
    public const string ProfileNotFound = "profile_not_found";
    public const string WeightRequired = "weight_required";

    /// <summary>
    /// Every code above, in a stable order. Published in the OpenAPI document (schema <c>ProblemCode</c>) so the
    /// web contract test can compare it with <c>ApiErrorCode</c> in web/src/api/types.ts.
    /// </summary>
    public static IReadOnlyList<string> All { get; } =
        [ReauthRequired, EmailNotVerified, NotInvited, ProfileRequired, NotFound, ProfileNotFound, WeightRequired];
}
