using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Configuration;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using FinallyLoseWeight.Api.Firebase;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Features.Profile;

/// <summary><c>GET /api/me</c> and <c>PUT /api/me</c> (invited users; no profile needed yet).</summary>
public static class ProfileEndpoints
{
    public const string Route = "/api/me";

    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder api)
    {
        var me = api.MapGroup("/me").WithTags("Perfil").RequireAuthorization(AccessPolicies.InvitedUser);
        me.MapGet("", GetProfile);
        me.MapPut("", UpsertProfile);
        return api;
    }

    private static async Task<Results<Ok<ProfileResponse>, ProblemHttpResult>> GetProfile(
        AppDbContext db, ICurrentUser currentUser, IOptions<PrivacySettings> privacy, CancellationToken cancellationToken)
    {
        var uid = currentUser.RequireUid();
        var profile = await db.UserProfiles.AsNoTracking()
            .SingleOrDefaultAsync(p => p.Uid == uid, cancellationToken);

        return profile is null
            ? ApiProblems.ProfileNotFound()
            : TypedResults.Ok(ProfileResponse.From(profile, privacy.Value.CurrentVersion));
    }

    private static async Task<Results<Created<ProfileResponse>, Ok<ProfileResponse>, ValidationProblem, ProblemHttpResult>> UpsertProfile(
        ProfileRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        IFirebaseUsers firebaseUsers,
        IOptions<PrivacySettings> privacy,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var uid = currentUser.RequireUid();

        return await db.RetryOnUniqueViolationAsync<Results<Created<ProfileResponse>, Ok<ProfileResponse>, ValidationProblem, ProblemHttpResult>>(async () =>
        {
            var profile = await db.UserProfiles.SingleOrDefaultAsync(p => p.Uid == uid, cancellationToken);
            var isNew = profile is null;

            var errors = new ValidationErrors();
            var displayName = errors.RequiredText("displayName", request.DisplayName, UserProfile.DisplayNameMaxLength);
            var heightCm = errors.Range("heightCm", request.HeightCm, 100, 250);
            var targetWeightKg = errors.Range("targetWeightKg", request.TargetWeightKg, 30m, 300m);
            var dailyKcalTarget = errors.Range("dailyKcalTarget", request.DailyKcalTarget, 800, 6000);
            var acceptPrivacy = request.AcceptPrivacy == true;
            if (isNew && !acceptPrivacy)
            {
                errors.Add("acceptPrivacy", "Debes aceptar la política de privacidad para crear tu perfil.");
            }

            if (errors.HasErrors)
            {
                return errors.ToProblem();
            }

            // ID tokens are stateless and outlive DELETE /api/me (up to 1 h): a token from another device
            // must not recreate a profile, and then health data, for a Firebase user that no longer exists
            // (nobody could sign in again to export or erase it). One Admin SDK call per sign-up.
            if (isNew && !await firebaseUsers.IsActiveAsync(uid, cancellationToken))
            {
                return ApiProblems.AccountInactive();
            }

            var now = time.GetUtcNowForStorage();
            if (profile is null)
            {
                profile = new UserProfile
                {
                    Uid = uid,
                    DisplayName = displayName!,
                    PrivacyVersion = privacy.Value.CurrentVersion,
                    CreatedAt = now,
                };
                db.UserProfiles.Add(profile);
            }

            if (acceptPrivacy)
            {
                profile.ConsentAt = now;
                profile.PrivacyVersion = privacy.Value.CurrentVersion;
            }

            profile.DisplayName = displayName!;
            profile.HeightCm = heightCm;
            profile.TargetWeightKg = targetWeightKg;
            profile.DailyKcalTarget = dailyKcalTarget;
            profile.UpdatedAt = now;

            await db.SaveChangesAsync(cancellationToken);

            var response = ProfileResponse.From(profile, privacy.Value.CurrentVersion);
            return isNew ? TypedResults.Created(Route, response) : TypedResults.Ok(response);
        });
    }
}
