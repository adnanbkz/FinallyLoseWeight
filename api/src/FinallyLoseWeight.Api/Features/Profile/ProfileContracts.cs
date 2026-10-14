using FinallyLoseWeight.Api.Data.Entities;
using FinallyLoseWeight.Api.Features.Cardio;
using FinallyLoseWeight.Api.Features.Meals;
using FinallyLoseWeight.Api.Features.Steps;
using FinallyLoseWeight.Api.Features.Weights;

namespace FinallyLoseWeight.Api.Features.Profile;

/// <summary>Body of <c>PUT /api/me</c>. Full replacement of the editable fields.</summary>
/// <param name="AcceptPrivacy">Must be <c>true</c> when creating; <c>true</c> on update re-stamps consent.</param>
public sealed record ProfileRequest(
    string? DisplayName,
    int? HeightCm,
    decimal? TargetWeightKg,
    int? DailyKcalTarget,
    bool? AcceptPrivacy);

/// <summary><c>Profile</c> in docs/API.md.</summary>
/// <param name="PrivacyVersion">Version of the privacy notice the user accepted (at <paramref name="ConsentAt"/>).</param>
/// <param name="CurrentPrivacyVersion">Version currently in force (<c>Privacy:CurrentVersion</c>). When it differs
/// from <paramref name="PrivacyVersion"/>, the client asks the user to accept the notice again.</param>
public sealed record ProfileResponse(
    string DisplayName,
    int? HeightCm,
    decimal? TargetWeightKg,
    int? DailyKcalTarget,
    DateTime ConsentAt,
    string PrivacyVersion,
    string CurrentPrivacyVersion,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static ProfileResponse From(UserProfile profile, string currentPrivacyVersion) => new(
        profile.DisplayName,
        profile.HeightCm,
        profile.TargetWeightKg,
        profile.DailyKcalTarget,
        profile.ConsentAt,
        profile.PrivacyVersion,
        currentPrivacyVersion,
        profile.CreatedAt,
        profile.UpdatedAt);
}

/// <summary>Body of <c>GET /api/me/export</c> (GDPR art. 15/20).</summary>
public sealed record ExportResponse(
    DateTime ExportedAt,
    ProfileResponse? Profile,
    IReadOnlyList<WeightResponse> Weights,
    IReadOnlyList<MealResponse> Meals,
    IReadOnlyList<StepsResponse> Steps,
    IReadOnlyList<CardioResponse> Cardio);
