namespace FinallyLoseWeight.Api.Configuration;

// Strongly typed views over the configuration keys documented in docs/SETUP.md.
// They are bound lazily through the options pipeline (never read eagerly in Program.cs), so
// WebApplicationFactory overrides and App Service settings are always honoured.

/// <summary><c>Firebase:*</c> — the Firebase project used only for authentication.</summary>
public sealed class FirebaseSettings
{
    public const string SectionName = "Firebase";

    /// <summary>Firebase project id: token audience and part of the issuer URL.</summary>
    public string ProjectId { get; set; } = string.Empty;

    /// <summary>Service account key (JSON content, not a path). Used only to check (sign-up) and delete users.</summary>
    public string? ServiceAccountJson { get; set; }

    /// <summary>Issuer of Firebase ID tokens for <paramref name="projectId"/>.</summary>
    public static string IssuerFor(string projectId) => $"https://securetoken.google.com/{projectId}";
}

/// <summary><c>Access:*</c> — invite-only access.</summary>
public sealed class AccessSettings
{
    public const string SectionName = "Access";

    /// <summary>Comma-separated list of invited emails. Empty means nobody is invited (fail closed).</summary>
    public string? AllowedEmails { get; set; }
}

/// <summary><c>Cors:*</c>.</summary>
public sealed class CorsSettings
{
    public const string SectionName = "Cors";

    /// <summary>Comma-separated list of allowed origins (e.g. <c>https://my-app.web.app</c>).</summary>
    public string? AllowedOrigins { get; set; }
}

/// <summary><c>Privacy:*</c>.</summary>
public sealed class PrivacySettings
{
    public const string SectionName = "Privacy";

    /// <summary>Version of the privacy notice the user consents to when creating/updating the profile.</summary>
    public string CurrentVersion { get; set; } = "1";
}

/// <summary><c>Security:*</c>.</summary>
public sealed class SecuritySettings
{
    public const string SectionName = "Security";

    /// <summary>Maximum age of the <c>auth_time</c> claim accepted by <c>DELETE /api/me</c>.</summary>
    public int ReauthMaxAgeMinutes { get; set; } = 5;
}

/// <summary><c>RateLimit:*</c>.</summary>
public sealed class RateLimitSettings
{
    public const string SectionName = "RateLimit";

    /// <summary>Requests allowed per minute and per user (or per IP for anonymous requests).</summary>
    public int PermitsPerMinute { get; set; } = 120;
}

/// <summary><c>Database:*</c>.</summary>
public sealed class DatabaseSettings
{
    public const string SectionName = "Database";

    /// <summary>Apply pending EF Core migrations when the application starts.</summary>
    public bool MigrateOnStartup { get; set; } = true;
}
