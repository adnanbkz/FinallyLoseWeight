namespace FinallyLoseWeight.Api.Cardio;

/// <summary>
/// A cardio machine: its catalog descriptor (which drives the PWA form) and its energy formula.
/// Adding a machine = one new implementation registered in DI; the frontend does not change.
/// </summary>
public interface ICardioCalculator
{
    CardioMachine Machine { get; }

    /// <summary>
    /// Estimates the energy of a session. <paramref name="parameters"/> has already been validated
    /// against <see cref="CardioMachine.Fields"/> (required fields present and within range).
    /// </summary>
    CardioCalculation Calculate(CardioParameters parameters, decimal weightKg);
}

/// <summary>Catalog entry returned by <c>GET /api/cardio/machines</c>.</summary>
/// <param name="Id">Stable machine code stored with each session, e.g. <c>incline-treadmill</c>.</param>
/// <param name="Name">Spanish display name.</param>
/// <param name="Fields">Inputs the machine needs, in display order. Must include <c>durationMin</c>.</param>
public sealed record CardioMachine(string Id, string Name, IReadOnlyList<CardioField> Fields);

/// <summary>An input of a machine. <see cref="Key"/> is one of <see cref="CardioFieldKeys"/>.</summary>
public sealed record CardioField(
    string Key, string Label, string Unit, decimal Min, decimal Max, decimal Step, bool Required);

/// <summary>Property names of the cardio request body that a machine can use as fields.</summary>
public static class CardioFieldKeys
{
    public const string DurationMin = "durationMin";
    public const string AvgSpeedKmh = "avgSpeedKmh";
    public const string InclinePercent = "inclinePercent";
    public const string ResistanceLevel = "resistanceLevel";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string>(StringComparer.Ordinal) { DurationMin, AvgSpeedKmh, InclinePercent, ResistanceLevel };
}

/// <summary>Session inputs. Fields the machine does not use are <c>null</c>.</summary>
public sealed record CardioParameters(
    decimal DurationMin, decimal? AvgSpeedKmh, decimal? InclinePercent, decimal? ResistanceLevel);

/// <summary>Result of a calculation. Net = gross minus the resting metabolism (3.5 ml/kg/min).</summary>
/// <param name="Formula">Equation used, e.g. <c>acsm-walking</c> / <c>acsm-running</c>.</param>
/// <param name="FormulaVersion">Version stored with the session, e.g. <c>acsm-v1</c>.</param>
public sealed record CardioCalculation(int KcalGross, int KcalNet, string Formula, string FormulaVersion);
