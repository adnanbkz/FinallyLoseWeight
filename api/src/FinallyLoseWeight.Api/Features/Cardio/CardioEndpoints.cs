using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Cardio;

/// <summary><c>/api/cardio</c>: machine catalog, kcal estimate and sessions (kcal always computed server-side).</summary>
public static class CardioEndpoints
{
    public const string Route = "/api/cardio";

    public static IEndpointRouteBuilder MapCardioEndpoints(this IEndpointRouteBuilder api)
    {
        var cardio = api.MapGroup("/cardio").WithTags("Cardio");

        // The catalog only needs an invitation (the sign-up form may show it before the profile exists).
        cardio.MapGet("/machines", GetMachines).RequireAuthorization(AccessPolicies.InvitedUser);

        var sessions = cardio.MapGroup("").RequireAuthorization(AccessPolicies.RegisteredUser);
        sessions.MapPost("/estimate", Estimate);
        sessions.MapGet("", List);
        sessions.MapPost("", Create);
        sessions.MapPut("/{id}", Update);
        sessions.MapDelete("/{id}", Delete);

        return api;
    }

    private static Ok<IReadOnlyList<CardioMachine>> GetMachines(CardioCatalog catalog) =>
        TypedResults.Ok(catalog.Machines);

    private static async Task<Results<Ok<CardioEstimateResponse>, ValidationProblem, ProblemHttpResult>> Estimate(
        CardioRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (CardioInput.Validate(request, catalog, errors) is not { } input)
        {
            return errors.ToProblem();
        }

        if (await input.ResolveWeightAsync(db, currentUser.RequireUid(), cancellationToken) is not { } weight)
        {
            return ApiProblems.WeightRequired();
        }

        var result = input.Calculator.Calculate(input.Parameters, weight.WeightKg);
        return TypedResults.Ok(new CardioEstimateResponse(
            result.KcalGross, result.KcalNet, weight.WeightKg, weight.Source, result.Formula, result.FormulaVersion));
    }

    private static async Task<Results<Ok<List<CardioResponse>>, ValidationProblem>> List(
        [FromQuery] string? from,
        [FromQuery] string? to,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (!DateRange.TryParse(from, to, DateRange.MaxListDays, errors, out var range))
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var sessions = await db.CardioSessions.AsNoTracking()
            .Where(c => c.UserId == uid && c.Date >= range.From && c.Date <= range.To)
            .OrderBy(c => c.Date).ThenBy(c => c.CreatedAt).ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(sessions.Select(c => CardioResponse.From(c, catalog)).ToList());
    }

    private static async Task<Results<Created<CardioResponse>, ValidationProblem, ProblemHttpResult>> Create(
        CardioRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (CardioInput.Validate(request, catalog, errors) is not { } input)
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        if (await input.ResolveWeightAsync(db, uid, cancellationToken) is not { } weight)
        {
            return ApiProblems.WeightRequired();
        }

        var now = time.GetUtcNowForStorage();
        var session = new CardioSession
        {
            Id = Guid.CreateVersion7(now),
            UserId = uid,
            Machine = input.Calculator.Machine.Id,
            FormulaVersion = string.Empty, // Set by Apply together with the kcal.
            CreatedAt = now,
        };
        Apply(session, input, weight.WeightKg);
        db.CardioSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created($"{Route}/{session.Id}", CardioResponse.From(session, catalog));
    }

    private static async Task<Results<Ok<CardioResponse>, ValidationProblem, ProblemHttpResult>> Update(
        string id,
        CardioRequest request,
        AppDbContext db,
        ICurrentUser currentUser,
        CardioCatalog catalog,
        CancellationToken cancellationToken)
    {
        var errors = new ValidationErrors();
        if (CardioInput.Validate(request, catalog, errors) is not { } input)
        {
            return errors.ToProblem();
        }

        var uid = currentUser.RequireUid();
        var session = Guid.TryParse(id, out var sessionId)
            ? await db.CardioSessions.SingleOrDefaultAsync(c => c.Id == sessionId && c.UserId == uid, cancellationToken)
            : null;
        if (session is null)
        {
            return ApiProblems.NotFound();
        }

        if (await input.ResolveWeightAsync(db, uid, cancellationToken) is not { } weight)
        {
            return ApiProblems.WeightRequired();
        }

        Apply(session, input, weight.WeightKg);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(CardioResponse.From(session, catalog));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        string id, AppDbContext db, ICurrentUser currentUser, CancellationToken cancellationToken)
    {
        // An id that is not a UUID cannot exist either: same 404 not_found as an unknown one.
        if (!Guid.TryParse(id, out var sessionId))
        {
            return ApiProblems.NotFound();
        }

        var uid = currentUser.RequireUid();
        var deleted = await db.CardioSessions
            .Where(c => c.Id == sessionId && c.UserId == uid)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? ApiProblems.NotFound() : TypedResults.NoContent();
    }

    /// <summary>Copies the validated inputs and stores a fresh calculation with its formula version.</summary>
    private static void Apply(CardioSession session, CardioInput input, decimal weightKg)
    {
        var result = input.Calculator.Calculate(input.Parameters, weightKg);

        session.Date = input.Date;
        session.Machine = input.Calculator.Machine.Id;
        session.DurationMin = input.Parameters.DurationMin;
        session.AvgSpeedKmh = input.Parameters.AvgSpeedKmh;
        session.InclinePercent = input.Parameters.InclinePercent;
        session.ResistanceLevel = input.Parameters.ResistanceLevel;
        session.WeightKgUsed = weightKg;
        session.KcalGross = result.KcalGross;
        session.KcalNet = result.KcalNet;
        session.FormulaVersion = result.FormulaVersion;
        session.Note = input.Note;
    }
}
