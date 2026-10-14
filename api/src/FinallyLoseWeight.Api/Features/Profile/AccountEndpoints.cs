using System.Security.Claims;
using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Configuration;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Features.Cardio;
using FinallyLoseWeight.Api.Features.Meals;
using FinallyLoseWeight.Api.Features.Steps;
using FinallyLoseWeight.Api.Features.Weights;
using FinallyLoseWeight.Api.Firebase;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Features.Profile;

/// <summary>
/// GDPR endpoints: <c>GET /api/me/export</c> and <c>DELETE /api/me</c>. They only need a valid token,
/// so users can export or erase their data even without a verified email or after losing the invitation.
/// </summary>
public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder api)
    {
        var me = api.MapGroup("/me").WithTags("Cuenta").RequireAuthorization(AccessPolicies.AuthenticatedUser);
        me.MapGet("/export", Export);
        me.MapDelete("", DeleteAccount);
        return api;
    }

    private static async Task<Ok<ExportResponse>> Export(
        HttpContext httpContext,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        IOptions<PrivacySettings> privacy,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var uid = currentUser.RequireUid();

        var profile = await db.UserProfiles.AsNoTracking()
            .SingleOrDefaultAsync(p => p.Uid == uid, cancellationToken);
        var weights = await db.WeightEntries.AsNoTracking()
            .Where(w => w.UserId == uid)
            .OrderBy(w => w.Date)
            .ToListAsync(cancellationToken);
        var meals = await db.MealEntries.AsNoTracking()
            .Where(m => m.UserId == uid)
            .OrderBy(m => m.Date).ThenBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);
        var steps = await db.DailySteps.AsNoTracking()
            .Where(s => s.UserId == uid)
            .OrderBy(s => s.Date)
            .ToListAsync(cancellationToken);
        var cardio = await db.CardioSessions.AsNoTracking()
            .Where(c => c.UserId == uid)
            .OrderBy(c => c.Date).ThenBy(c => c.CreatedAt).ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);

        var exportedAt = time.GetUtcNowForStorage();
        var fileName = $"finallyloseweight-export-{DateOnly.FromDateTime(exportedAt).ToIsoString()}.json";
        httpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";

        return TypedResults.Ok(new ExportResponse(
            exportedAt,
            profile is null ? null : ProfileResponse.From(profile, privacy.Value.CurrentVersion),
            weights.Select(WeightResponse.From).ToList(),
            meals.Select(MealResponse.From).ToList(),
            steps.Select(StepsResponse.From).ToList(),
            cardio.Select(c => CardioResponse.From(c, catalog)).ToList()));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAccount(
        ClaimsPrincipal user,
        ICurrentUser currentUser,
        AppDbContext db,
        IFirebaseUsers firebaseUsers,
        IOptions<SecuritySettings> security,
        TimeProvider time,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        // Require a recent interactive sign-in: a stolen or long-lived session must not be enough.
        var authTime = user.GetAuthTime();
        var maxAge = TimeSpan.FromMinutes(security.Value.ReauthMaxAgeMinutes);
        if (authTime is null || time.GetUtcNow() - authTime.Value > maxAge)
        {
            return ApiProblems.ReauthRequired();
        }

        var uid = currentUser.RequireUid();

        // 1. All rows in one transaction (the execution strategy retries the whole unit on transient errors).
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await db.CardioSessions.Where(c => c.UserId == uid).ExecuteDeleteAsync(cancellationToken);
            await db.MealEntries.Where(m => m.UserId == uid).ExecuteDeleteAsync(cancellationToken);
            await db.DailySteps.Where(s => s.UserId == uid).ExecuteDeleteAsync(cancellationToken);
            await db.WeightEntries.Where(w => w.UserId == uid).ExecuteDeleteAsync(cancellationToken);
            await db.UserProfiles.Where(p => p.Uid == uid).ExecuteDeleteAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

        // 2. Then the Firebase user. Database first: if Firebase went first and the database step failed,
        // the user could no longer sign in to retry and the data would be orphaned. Not cancellable:
        // once the data is gone, finish the job even if the client disconnects.
        await firebaseUsers.DeleteUserAsync(uid, CancellationToken.None);

        loggerFactory.CreateLogger(typeof(AccountEndpoints).FullName!).LogInformation("A user account was deleted.");
        return TypedResults.NoContent();
    }
}
