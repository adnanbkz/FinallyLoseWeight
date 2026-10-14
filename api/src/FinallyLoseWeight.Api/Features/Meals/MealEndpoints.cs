using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Meals;

/// <summary>Body of <c>POST /api/meals</c> and <c>PUT /api/meals/{id}</c>.</summary>
public sealed record MealRequest(
    DateOnly? Date,
    MealType? MealType,
    string? Description,
    int? Kcal,
    decimal? ProteinG,
    decimal? CarbsG,
    decimal? FatG);

/// <summary><c>Meal</c> in docs/API.md: the request body plus <c>id</c> and <c>createdAt</c>.</summary>
public sealed record MealResponse(
    Guid Id,
    DateOnly Date,
    MealType MealType,
    string Description,
    int Kcal,
    decimal? ProteinG,
    decimal? CarbsG,
    decimal? FatG,
    DateTime CreatedAt)
{
    public static MealResponse From(MealEntry meal) => new(
        meal.Id, meal.Date, meal.MealType, meal.Description, meal.Kcal,
        meal.ProteinG, meal.CarbsG, meal.FatG, meal.CreatedAt);
}

/// <summary><c>/api/meals</c>: several meals per day.</summary>
public static class MealEndpoints
{
    public const string Route = "/api/meals";
    public const int MaxKcal = 5000;
    public const decimal MaxMacroGrams = 1000m;

    public static IEndpointRouteBuilder MapMealEndpoints(this IEndpointRouteBuilder api)
    {
        var meals = api.MapGroup("/meals").WithTags("Comidas").RequireAuthorization(AccessPolicies.RegisteredUser);
        meals.MapGet("", List);
        meals.MapPost("", Create);
        meals.MapPut("/{id}", Update);
        meals.MapDelete("/{id}", Delete);
        return api;
    }

    private static async Task<Results<Ok<List<MealResponse>>, ValidationProblem>> List(
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
        var meals = await db.MealEntries.AsNoTracking()
            .Where(m => m.UserId == uid && m.Date >= range.From && m.Date <= range.To)
            .OrderBy(m => m.Date).ThenBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(meals.Select(MealResponse.From).ToList());
    }

    private static async Task<Results<Created<MealResponse>, ValidationProblem>> Create(
        MealRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (Validate(request, errors) is not { } input)
        {
            return errors.ToProblem();
        }

        var now = time.GetUtcNowForStorage();
        var meal = new MealEntry
        {
            Id = Guid.CreateVersion7(now),
            UserId = currentUser.RequireUid(),
            Description = input.Description,
            CreatedAt = now,
        };
        Apply(meal, input);
        db.MealEntries.Add(meal);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created($"{Route}/{meal.Id}", MealResponse.From(meal));
    }

    private static async Task<Results<Ok<MealResponse>, ProblemHttpResult, ValidationProblem>> Update(
        string id,
        MealRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (Validate(request, errors) is not { } input)
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var meal = Guid.TryParse(id, out var mealId)
            ? await db.MealEntries.SingleOrDefaultAsync(m => m.Id == mealId && m.UserId == uid, cancellationToken)
            : null;
        if (meal is null)
        {
            return ApiProblems.NotFound();
        }

        Apply(meal, input);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(MealResponse.From(meal));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        string id, AppDbContext db, ICurrentUser currentUser, CancellationToken cancellationToken)
    {
        // An id that is not a UUID cannot exist either: same 404 not_found as an unknown one.
        if (!Guid.TryParse(id, out var mealId))
        {
            return ApiProblems.NotFound();
        }

        var uid = currentUser.RequireUid();
        var deleted = await db.MealEntries
            .Where(m => m.Id == mealId && m.UserId == uid)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? ApiProblems.NotFound() : TypedResults.NoContent();
    }

    private sealed record ValidMeal(
        DateOnly Date, MealType MealType, string Description, int Kcal,
        decimal? ProteinG, decimal? CarbsG, decimal? FatG);

    private static ValidMeal? Validate(MealRequest request, ValidationErrors errors)
    {
        var date = errors.Required("date", request.Date);
        var mealType = errors.Required("mealType", request.MealType);
        if (mealType is { } type && !Enum.IsDefined(type))
        {
            errors.Add("mealType", ValidationErrors.Messages.InvalidValue);
        }

        var description = errors.RequiredText("description", request.Description, MealEntry.DescriptionMaxLength);
        var kcal = errors.RequiredRange("kcal", request.Kcal, 0, MaxKcal);
        var protein = errors.Range("proteinG", request.ProteinG, 0m, MaxMacroGrams);
        var carbs = errors.Range("carbsG", request.CarbsG, 0m, MaxMacroGrams);
        var fat = errors.Range("fatG", request.FatG, 0m, MaxMacroGrams);

        return errors.HasErrors
            ? null
            : new ValidMeal(date!.Value, mealType!.Value, description!, kcal!.Value, protein, carbs, fat);
    }

    private static void Apply(MealEntry meal, ValidMeal input)
    {
        meal.Date = input.Date;
        meal.MealType = input.MealType;
        meal.Description = input.Description;
        meal.Kcal = input.Kcal;
        meal.ProteinG = input.ProteinG;
        meal.CarbsG = input.CarbsG;
        meal.FatG = input.FatG;
    }
}
