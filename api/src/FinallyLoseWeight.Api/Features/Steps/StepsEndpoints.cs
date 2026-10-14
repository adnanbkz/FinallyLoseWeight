using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Steps;

/// <summary>Body of <c>PUT /api/steps/{date}</c>.</summary>
public sealed record StepsRequest(int? Steps);

/// <summary><c>Steps</c> in docs/API.md.</summary>
public sealed record StepsResponse(DateOnly Date, int Steps)
{
    public static StepsResponse From(DailySteps entry) => new(entry.Date, entry.Steps);
}

/// <summary><c>/api/steps</c>: one step count per day (PUT creates or replaces).</summary>
public static class StepsEndpoints
{
    public const int MaxSteps = 150_000;

    public static IEndpointRouteBuilder MapStepsEndpoints(this IEndpointRouteBuilder api)
    {
        var steps = api.MapGroup("/steps").WithTags("Pasos").RequireAuthorization(AccessPolicies.RegisteredUser);
        steps.MapGet("", List);
        steps.MapPut("/{date}", Upsert);
        steps.MapDelete("/{date}", Delete);
        return api;
    }

    private static async Task<Results<Ok<List<StepsResponse>>, ValidationProblem>> List(
        [FromQuery] string? from,
        [FromQuery] string? to,
        AppDbContext db,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (!DateRange.TryParse(from, to, DateRange.MaxListDays, errors, out var range))
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var steps = await db.DailySteps.AsNoTracking()
            .Where(s => s.UserId == uid && s.Date >= range.From && s.Date <= range.To)
            .OrderBy(s => s.Date)
            .Select(s => new StepsResponse(s.Date, s.Steps))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(steps);
    }

    private static async Task<Results<Ok<StepsResponse>, ValidationProblem>> Upsert(
        string date,
        StepsRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (!DiaryDate.TryParse(date, out var day))
        {
            errors.Add("date", ValidationErrors.Messages.InvalidDate);
        }

        var count = errors.RequiredRange("steps", request.Steps, 0, MaxSteps);
        if (errors.HasErrors)
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var entry = await db.RetryOnUniqueViolationAsync(async () =>
        {
            var existing = await db.DailySteps
                .SingleOrDefaultAsync(s => s.UserId == uid && s.Date == day, cancellationToken);
            if (existing is null)
            {
                existing = new DailySteps { Id = Guid.CreateVersion7(), UserId = uid, Date = day };
                db.DailySteps.Add(existing);
            }

            existing.Steps = count!.Value;
            await db.SaveChangesAsync(cancellationToken);
            return existing;
        });

        return TypedResults.Ok(StepsResponse.From(entry));
    }

    private static async Task<Results<NoContent, ProblemHttpResult, ValidationProblem>> Delete(
        string date, AppDbContext db, ICurrentUser currentUser, CancellationToken cancellationToken)
    {
        if (!DiaryDate.TryParse(date, out var day))
        {
            return ValidationErrors.Problem("date", ValidationErrors.Messages.InvalidDate);
        }

        var uid = currentUser.RequireUid();
        var deleted = await db.DailySteps
            .Where(s => s.UserId == uid && s.Date == day)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? ApiProblems.NotFound() : TypedResults.NoContent();
    }
}
