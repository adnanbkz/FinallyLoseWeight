namespace FinallyLoseWeight.Api.Auth;

/// <summary>Identity of the user behind the current request.</summary>
public interface ICurrentUser
{
    /// <summary>Firebase UID from the validated token, or <c>null</c> outside an authenticated request
    /// (startup, migrations, health checks). A <c>null</c> UID makes every per-user query return nothing.</summary>
    string? Uid { get; }
}

public static class CurrentUserExtensions
{
    /// <summary>
    /// The UID of the authenticated user. Only call it from endpoints protected by an access policy,
    /// where authentication is guaranteed.
    /// </summary>
    public static string RequireUid(this ICurrentUser user) =>
        user.Uid ?? throw new InvalidOperationException("The current request has no authenticated user.");
}

/// <summary>Reads the UID from <see cref="HttpContext.User"/>.</summary>
public sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public string? Uid => accessor.HttpContext?.User.GetUid();
}
