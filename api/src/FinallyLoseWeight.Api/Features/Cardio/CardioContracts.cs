using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Data.Entities;

namespace FinallyLoseWeight.Api.Features.Cardio;

/// <summary>
/// Body of <c>POST /api/cardio/estimate</c>, <c>POST /api/cardio</c> and <c>PUT /api/cardio/{id}</c>.
/// Any kcal sent by the client is ignored (unknown properties are not bound); the server recalculates.
/// </summary>
/// <param name="WeightKg">Optional override; otherwise the latest weight on or before <paramref name="Date"/>.</param>
public sealed record CardioRequest(
    DateOnly? Date,
    string? Machine,
    decimal? DurationMin,
    decimal? AvgSpeedKmh,
    decimal? InclinePercent,
    decimal? ResistanceLevel,
    decimal? WeightKg,
    string? Note)
{
    /// <summary>Value of the property named by a catalog field key (<see cref="CardioFieldKeys"/>).</summary>
    public decimal? GetField(string key) => key switch
    {
        CardioFieldKeys.DurationMin => DurationMin,
        CardioFieldKeys.AvgSpeedKmh => AvgSpeedKmh,
        CardioFieldKeys.InclinePercent => InclinePercent,
        CardioFieldKeys.ResistanceLevel => ResistanceLevel,
        _ => throw new ArgumentOutOfRangeException(nameof(key), key, "Unknown cardio field."),
    };
}

/// <summary>Where the weight used in the calculation came from.</summary>
public enum WeightSource
{
    /// <summary>Latest weight entry on or before the session date.</summary>
    Entry,

    /// <summary><c>weightKg</c> in the request body.</summary>
    Provided,
}

/// <summary>Response of <c>POST /api/cardio/estimate</c>.</summary>
public sealed record CardioEstimateResponse(
    int KcalGross,
    int KcalNet,
    decimal WeightKgUsed,
    WeightSource WeightSource,
    string Formula,
    string FormulaVersion);

/// <summary><c>Cardio</c> in docs/API.md.</summary>
public sealed record CardioResponse(
    Guid Id,
    DateOnly Date,
    string Machine,
    string MachineName,
    decimal DurationMin,
    decimal? AvgSpeedKmh,
    decimal? InclinePercent,
    decimal? ResistanceLevel,
    decimal WeightKgUsed,
    int KcalGross,
    int KcalNet,
    string FormulaVersion,
    string? Note,
    DateTime CreatedAt)
{
    public static CardioResponse From(CardioSession session, CardioCatalog catalog) => new(
        session.Id,
        session.Date,
        session.Machine,
        catalog.GetName(session.Machine),
        session.DurationMin,
        session.AvgSpeedKmh,
        session.InclinePercent,
        session.ResistanceLevel,
        session.WeightKgUsed,
        session.KcalGross,
        session.KcalNet,
        session.FormulaVersion,
        session.Note,
        session.CreatedAt);
}
