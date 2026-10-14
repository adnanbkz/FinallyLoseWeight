using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// Mints Firebase-like ID tokens (RS256) signed with a key generated in-process; <see cref="ApiFactory"/>
/// makes the API trust it, so no network or real Firebase project is needed.
/// </summary>
/// <example>
/// <code>
/// var token = TestTokens.Create(user);                                  // valid
/// var expired = TestTokens.Create(user, t => t.Expired());
/// var stale = TestTokens.Create(user, t => t.SignedInAgo(TimeSpan.FromMinutes(10)));
/// var custom = TestTokens.Create(user, t => t with { Email = null, EmailVerified = null });
/// </code>
/// </example>
public static class TestTokens
{
    /// <summary>Firebase project id configured by <see cref="ApiFactory"/> (token audience).</summary>
    public const string ProjectId = "flw-test";

    /// <summary>Issuer expected by the API for <see cref="ProjectId"/>.</summary>
    public const string Issuer = $"https://securetoken.google.com/{ProjectId}";

    private const string KeyId = "flw-test-key";

    /// <summary>The key the API under test trusts.</summary>
    public static SecurityKey SigningKey { get; } = new RsaSecurityKey(RSA.Create(2048)) { KeyId = KeyId };

    // Same key id, different key material: tokens signed with it fail signature validation.
    private static readonly SecurityKey UntrustedKey = new RsaSecurityKey(RSA.Create(2048)) { KeyId = KeyId };

    private static readonly JsonWebTokenHandler Handler = new() { SetDefaultTimesOnTokenCreation = false };

    /// <summary>Default (valid) token description for <paramref name="user"/>; customize it with <c>with</c> or the helpers.</summary>
    public static TokenSpec For(TestUser user) => new() { Subject = user.Uid, Email = user.Email };

    /// <summary>Token for <paramref name="user"/>, optionally customized.</summary>
    public static string Create(TestUser user, Func<TokenSpec, TokenSpec>? customize = null)
    {
        var spec = For(user);
        return Create(customize is null ? spec : customize(spec));
    }

    public static string Create(TokenSpec spec)
    {
        var claims = new Dictionary<string, object>
        {
            ["sub"] = spec.Subject,
            ["user_id"] = spec.Subject,
        };
        if (spec.Email is not null)
        {
            claims["email"] = spec.Email;
        }

        if (spec.EmailVerified is { } verified)
        {
            claims["email_verified"] = verified;
        }

        if (spec.AuthTime is { } authTime)
        {
            claims["auth_time"] = authTime.ToUnixTimeSeconds();
        }

        foreach (var (name, value) in spec.ExtraClaims ?? new Dictionary<string, object>())
        {
            claims[name] = value;
        }

        return Handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = spec.Issuer,
            Audience = spec.Audience,
            IssuedAt = spec.IssuedAt.UtcDateTime,
            Expires = spec.Expires?.UtcDateTime,
            Claims = claims,
            SigningCredentials = new SigningCredentials(
                spec.SignWithUntrustedKey ? UntrustedKey : SigningKey, SecurityAlgorithms.RsaSha256),
        });
    }

    /// <summary>
    /// Same claims as <see cref="Create(TokenSpec)"/> but with <c>"alg": "none"</c> and no signature
    /// (the classic signature-bypass attempt).
    /// </summary>
    public static string CreateUnsigned(TokenSpec spec)
    {
        var payload = Create(spec).Split('.')[1];
        var header = Base64UrlEncoder.Encode("""{"alg":"none","typ":"JWT"}""");
        return $"{header}.{payload}.";
    }

    /// <summary>
    /// <c>PostConfigure</c> for the API's <see cref="JwtBearerOptions"/>: drop the Firebase authority and
    /// OpenID metadata (no network) and trust <see cref="SigningKey"/>. Issuer and audience validation stay
    /// as in production (they come from <c>Firebase:ProjectId</c> = <see cref="ProjectId"/>).
    /// </summary>
    public static void TrustTestSigningKey(JwtBearerOptions options)
    {
        options.Authority = null;
        options.Configuration = null;
        options.ConfigurationManager = null;
        options.TokenValidationParameters.IssuerSigningKey = SigningKey;
    }
}

/// <summary>Contents of a test token. Defaults describe a valid, freshly signed-in, verified user.</summary>
public sealed record TokenSpec
{
    public required string Subject { get; init; }

    public string? Email { get; init; }

    /// <summary><c>null</c> omits the claim.</summary>
    public bool? EmailVerified { get; init; } = true;

    /// <summary>Last interactive sign-in (<c>auth_time</c>); <c>null</c> omits the claim.</summary>
    public DateTimeOffset? AuthTime { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset IssuedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Expiry (<c>exp</c>); <c>null</c> omits the claim.</summary>
    public DateTimeOffset? Expires { get; init; } = DateTimeOffset.UtcNow.AddHours(1);

    public string Issuer { get; init; } = TestTokens.Issuer;

    public string Audience { get; init; } = TestTokens.ProjectId;

    public bool SignWithUntrustedKey { get; init; }

    public IReadOnlyDictionary<string, object>? ExtraClaims { get; init; }

    /// <summary>Expired an hour ago (well beyond the JWT handler's clock skew).</summary>
    public TokenSpec Expired()
    {
        var now = DateTimeOffset.UtcNow;
        return this with { IssuedAt = now.AddHours(-2), Expires = now.AddHours(-1), AuthTime = now.AddHours(-2) };
    }

    public TokenSpec WithWrongAudience() => this with { Audience = "another-project" };

    public TokenSpec WithWrongIssuer() => this with { Issuer = "https://securetoken.google.com/another-project" };

    /// <summary>Signed with a key the API does not trust (same key id).</summary>
    public TokenSpec WithBadSignature() => this with { SignWithUntrustedKey = true };

    public TokenSpec WithUnverifiedEmail() => this with { EmailVerified = false };

    /// <summary>No <c>exp</c> claim at all (Firebase ID tokens always expire).</summary>
    public TokenSpec WithoutExpiry() => this with { Expires = null };

    /// <summary>Last real sign-in <paramref name="ago"/> before now (token refreshed since).</summary>
    public TokenSpec SignedInAgo(TimeSpan ago) => this with { AuthTime = DateTimeOffset.UtcNow - ago };
}
