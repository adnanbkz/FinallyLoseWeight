using FinallyLoseWeight.Api.Cardio;
using FinallyLoseWeight.Api.Common;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using FinallyLoseWeight.Api.Features.Weights;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Features.Cardio;

/// <summary>A cardio request that passed validation, with the parameters the machine uses.</summary>
public sealed record CardioInput(
    DateOnly Date,
    ICardioCalculator Calculator,
    CardioParameters Parameters,
    decimal? ProvidedWeightKg,
    string? Note)
{
    /// <summary>
    /// Validates against the catalog: the machine must exist, its required fields must be present and
    /// every field it uses must be within <c>[min, max]</c>. Fields the machine does not use are ignored.
    /// </summary>
    public static CardioInput? Validate(CardioRequest request, CardioCatalog catalog, ValidationErrors errors)
    {
        var date = errors.Required("date", request.Date);

        ICardioCalculator? calculator = null;
        if (string.IsNullOrWhiteSpace(request.Machine))
        {
            errors.Add("machine", ValidationErrors.Messages.Required);
        }
        else if (!catalog.TryGet(request.Machine.Trim(), out calculator))
        {
            errors.Add("machine", "Máquina no reconocida.");
        }

        var values = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var field in calculator?.Machine.Fields ?? [])
        {
            var value = field.Required
                ? errors.RequiredRange(field.Key, request.GetField(field.Key), field.Min, field.Max)
                : errors.Range(field.Key, request.GetField(field.Key), field.Min, field.Max);
            if (value is { } v)
            {
                values[field.Key] = v;
            }
        }

        var weightKg = errors.Range("weightKg", request.WeightKg, WeightEndpoints.MinWeightKg, WeightEndpoints.MaxWeightKg);
        var note = errors.OptionalText("note", request.Note, CardioSession.NoteMaxLength);

        if (errors.HasErrors || calculator is null || date is null)
        {
            return null;
        }

        var parameters = new CardioParameters(
            DurationMin: values[CardioFieldKeys.DurationMin],
            AvgSpeedKmh: values.TryGetValue(CardioFieldKeys.AvgSpeedKmh, out var speed) ? speed : null,
            InclinePercent: values.TryGetValue(CardioFieldKeys.InclinePercent, out var incline) ? incline : null,
            ResistanceLevel: values.TryGetValue(CardioFieldKeys.ResistanceLevel, out var resistance) ? resistance : null);

        return new CardioInput(date.Value, calculator, parameters, weightKg, note);
    }

    /// <summary>
    /// Weight for the calculation: the body's <c>weightKg</c>, else the user's latest weight entry on or
    /// before the session date, else <c>null</c> (→ 422 <c>weight_required</c>).
    /// </summary>
    public async Task<(decimal WeightKg, WeightSource Source)?> ResolveWeightAsync(
        AppDbContext db, string uid, CancellationToken cancellationToken)
    {
        if (ProvidedWeightKg is { } provided)
        {
            return (provided, WeightSource.Provided);
        }

        var latest = await db.WeightEntries.AsNoTracking()
            .Where(w => w.UserId == uid && w.Date <= Date)
            .OrderByDescending(w => w.Date)
            .Select(w => (decimal?)w.WeightKg)
            .FirstOrDefaultAsync(cancellationToken);

        return latest is { } entry ? (entry, WeightSource.Entry) : null;
    }
}
