namespace FinallyLoseWeight.Api.Data.Entities;

/// <summary>
/// One row per user, keyed by the Firebase UID. Every other per-user table references it with
/// ON DELETE CASCADE. The email is deliberately not stored (Firebase already has it).
/// </summary>
public sealed class UserProfile
{
    public const int UidMaxLength = 128;
    public const int DisplayNameMaxLength = 40;
    public const int PrivacyVersionMaxLength = 20;

    public required string Uid { get; init; }

    /// <summary>Alias shown in the app (not necessarily a real name).</summary>
    public required string DisplayName { get; set; }

    public int? HeightCm { get; set; }

    public decimal? TargetWeightKg { get; set; }

    public int? DailyKcalTarget { get; set; }

    /// <summary>When the user last gave explicit consent to process health data (UTC).</summary>
    public DateTime ConsentAt { get; set; }

    /// <summary>Version of the privacy notice accepted at <see cref="ConsentAt"/>.</summary>
    public required string PrivacyVersion { get; set; }

    public DateTime CreatedAt { get; init; }

    public DateTime UpdatedAt { get; set; }
}
