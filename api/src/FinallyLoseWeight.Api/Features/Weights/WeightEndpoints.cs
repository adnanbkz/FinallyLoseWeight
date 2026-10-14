using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Weights;

/// <summary>Body of <c>PUT /api/weights/{date}</c>.</summary>
public sealed record WeightRequest(decimal? WeightKg, string? Note);

/// <summary><c>Weight</c> in docs/API.md.</summary>
public sealed record WeightResponse(DateOnly Date, decimal WeightKg, string? Note)
{
    public static WeightResponse From(WeightEntry entry) => new(entry.Date, entry.WeightKg, entry.Note);
}

/// <summary><c>/api/weights</c>: one weight per day (PUT creates or replaces).</summary>
public static class WeightEndpoints
{
    public const decimal MinWeightKg = 20m;
    public const decimal MaxWeightKg = 400m;

    public static IEndpointRouteBuilder MapWeightEndpoints(this IEndpointRouteBuilder api)
    {
        var weights = api.MapGroup("/weights").WithTags("Peso").RequireAuthorization(AccessPolicies.RegisteredUser);
        weights.MapGet("", List);
        weights.MapPut("/{date}", Upsert);
        weights.MapDelete("/{date}", Delete);
        return api;
    }

    private static async Task<Results<Ok<List<WeightResponse>>, ValidationProblem>> List(
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
        var weights = await db.WeightEntries.AsNoTracking()
            .Where(w => w.UserId == uid && w.Date >= range.From && w.Date <= range.To)
            .OrderBy(w => w.Date)
            .Select(w => new WeightResponse(w.Date, w.WeightKg, w.Note))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(weights);
    }

    private static async Task<Results<Ok<WeightResponse>, ValidationProblem>> Upsert(
        string date,
        WeightRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (!DiaryDate.TryParse(date, out var day))
        {
            errors.Add("date", ValidationErrors.Messages.InvalidDate);
        }

        var weightKg = errors.RequiredRange("weightKg", request.WeightKg, MinWeightKg, MaxWeightKg);
        var note = errors.OptionalText("note", request.Note, WeightEntry.NoteMaxLength);
        if (errors.HasErrors)
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var entry = await db.RetryOnUniqueViolationAsync(async () =>
        {
            var existing = await db.WeightEntries
                .SingleOrDefaultAsync(w => w.UserId == uid && w.Date == day, cancellationToken);
            if (existing is null)
            {
                existing = new WeightEntry { Id = Guid.CreateVersion7(), UserId = uid, Date = day };
                db.WeightEntries.Add(existing);
            }

            existing.WeightKg = weightKg!.Value;
            existing.Note = note;
            await db.SaveChangesAsync(cancellationToken);
            return existing;
        });

        return TypedResults.Ok(WeightResponse.From(entry));
    }

    private static async Task<Results<NoContent, ProblemHttpResult, ValidationProblem>> Delete(
        string date, AppDbContext db, ICurrentUser currentUser, CancellationToken cancellationToken)
    {
        if (!DiaryDate.TryParse(date, out var day))
        {
            return ValidationErrors.Problem("date", ValidationErrors.Messages.InvalidDate);
        }

        var uid = currentUser.RequireUid();
        var deleted = await db.WeightEntries
            .Where(w => w.UserId == uid && w.Date == day)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? ApiProblems.NotFound() : TypedResults.NoContent();
    }
}
