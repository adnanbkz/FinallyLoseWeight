using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Features.Cardio;
using FinallyLoseWeight.Api.Features.Meals;
using FinallyLoseWeight.Api.Features.Weights;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Summary;

/// <summary>Response of <c>GET /api/days/{date}</c>.</summary>
public sealed record DayResponse(
    DateOnly Date,
    WeightResponse? Weight,
    IReadOnlyList<MealResponse> Meals,
    int? Steps,
    IReadOnlyList<CardioResponse> Cardio,
    DayTotals Totals,
    int? DailyKcalTarget);

/// <summary>Always present; 0 when there is nothing. Macros only add the meals that have them.</summary>
public sealed record DayTotals(
    int KcalIn, decimal ProteinG, decimal CarbsG, decimal FatG, int KcalCardioGross, int KcalCardioNet);

/// <summary>Response of <c>GET /api/stats</c>: one element per day of the range, in order.</summary>
public sealed record StatsResponse(DateOnly From, DateOnly To, IReadOnlyList<StatsDay> Days);

/// <param name="WeightTrendKg">Mean of the weights in <c>[date-6, date]</c>, 2 decimals; null if none.</param>
/// <param name="KcalIn">Sum of the day's meals; null when no meal was logged (not logged ≠ 0).</param>
public sealed record StatsDay(
    DateOnly Date, decimal? WeightKg, decimal? WeightTrendKg, int? KcalIn, int KcalCardioNet, int? Steps);

/// <summary><c>GET /api/days/{date}</c> and <c>GET /api/stats</c>.</summary>
public static class SummaryEndpoints
{
    /// <summary>The weight trend averages this day and the previous six.</summary>
    public const int TrendWindowDays = 7;

    public static IEndpointRouteBuilder MapSummaryEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/days/{date}", GetDay).WithTags("Resúmenes").RequireAuthorization(AccessPolicies.RegisteredUser);
        api.MapGet("/stats", GetStats).WithTags("Resúmenes").RequireAuthorization(AccessPolicies.RegisteredUser);
        return api;
    }

    private static async Task<Results<Ok<DayResponse>, ValidationProblem>> GetDay(
        string date,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        CancellationToken cancellationToken)
    {
        if (!DiaryDate.TryParse(date, out var day))
        {
            return ValidationErrors.Problem("date", ValidationErrors.Messages.InvalidDate);
        }

        var uid = currentUser.RequireUid();

        var weight = await db.WeightEntries.AsNoTracking()
            .SingleOrDefaultAsync(w => w.UserId == uid && w.Date == day, cancellationToken);
        var meals = await db.MealEntries.AsNoTracking()
            .Where(m => m.UserId == uid && m.Date == day)
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);
        var steps = await db.DailySteps.AsNoTracking()
            .Where(s => s.UserId == uid && s.Date == day)
            .Select(s => (int?)s.Steps)
            .SingleOrDefaultAsync(cancellationToken);
        var cardio = await db.CardioSessions.AsNoTracking()
            .Where(c => c.UserId == uid && c.Date == day)
            .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);
        var dailyKcalTarget = await db.UserProfiles.AsNoTracking()
            .Where(p => p.Uid == uid)
            .Select(p => p.DailyKcalTarget)
            .SingleOrDefaultAsync(cancellationToken);

        var totals = new DayTotals(
            KcalIn: meals.Sum(m => m.Kcal),
            ProteinG: meals.Sum(m => m.ProteinG ?? 0m),
            CarbsG: meals.Sum(m => m.CarbsG ?? 0m),
            FatG: meals.Sum(m => m.FatG ?? 0m),
            KcalCardioGross: cardio.Sum(c => c.KcalGross),
            KcalCardioNet: cardio.Sum(c => c.KcalNet));

        return TypedResults.Ok(new DayResponse(
            day,
            weight is null ? null : WeightResponse.From(weight),
            meals.Select(MealResponse.From).ToList(),
            steps,
            cardio.Select(c => CardioResponse.From(c, catalog)).ToList(),
            totals,
            dailyKcalTarget));
    }

    private static async Task<Results<Ok<StatsResponse>, ValidationProblem>> GetStats(
        [FromQuery] string? from,
        [FromQuery] string? to,
        AppDbContext db,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (!DateRange.TryParse(from, to, DateRange.MaxStatsDays, errors, out var range))
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();

        // The trend of the first days needs the weights of the six days before 'from'.
        var trendStart = range.From.SubtractDaysClamped(TrendWindowDays - 1);
        var weights = await db.WeightEntries.AsNoTracking()
            .Where(w => w.UserId == uid && w.Date >= trendStart && w.Date <= range.To)
            .Select(w => new { w.Date, w.WeightKg })
            .ToDictionaryAsync(w => w.Date, w => w.WeightKg, cancellationToken);
        var kcalIn = await db.MealEntries.AsNoTracking()
            .Where(m => m.UserId == uid && m.Date >= range.From && m.Date <= range.To)
            .GroupBy(m => m.Date)
            .Select(g => new { Date = g.Key, Kcal = g.Sum(m => m.Kcal) })
            .ToDictionaryAsync(x => x.Date, x => x.Kcal, cancellationToken);
        var kcalCardioNet = await db.CardioSessions.AsNoTracking()
            .Where(c => c.UserId == uid && c.Date >= range.From && c.Date <= range.To)
            .GroupBy(c => c.Date)
            .Select(g => new { Date = g.Key, Kcal = g.Sum(c => c.KcalNet) })
            .ToDictionaryAsync(x => x.Date, x => x.Kcal, cancellationToken);
        var steps = await db.DailySteps.AsNoTracking()
            .Where(s => s.UserId == uid && s.Date >= range.From && s.Date <= range.To)
            .ToDictionaryAsync(s => s.Date, s => s.Steps, cancellationToken);

        var days = range.EnumerateDays()
            .Select(day => new StatsDay(
                day,
                weights.TryGetValue(day, out var weight) ? weight : null,
                WeightTrend(weights, day),
                kcalIn.TryGetValue(day, out var kcal) ? kcal : null,
                kcalCardioNet.GetValueOrDefault(day),
                steps.TryGetValue(day, out var count) ? count : null))
            .ToList();

        return TypedResults.Ok(new StatsResponse(range.From, range.To, days));
    }

    private static decimal? WeightTrend(IReadOnlyDictionary<DateOnly, decimal> weights, DateOnly day)
    {
        var sum = 0m;
        var count = 0;
        for (var offset = 0; offset < TrendWindowDays && day.DayNumber - offset >= 0; offset++)
        {
            if (weights.TryGetValue(day.AddDays(-offset), out var kg))
            {
                sum += kg;
                count++;
            }
        }

        return count == 0 ? null : Math.Round(sum / count, 2, MidpointRounding.AwayFromZero);
    }
}
