namespace FinallyLoseWeight.Api.Data.Entities;

/// <summary>
/// A cardio session. Stores the inputs, the weight used and the formula version next to the result,
/// so history does not change if the formula is tuned later. Parameter columns are nullable so new
/// machines need no schema change (fields a machine does not use are stored as null).
/// </summary>
public sealed class CardioSession
{
    public const int MachineMaxLength = 50;
    public const int FormulaVersionMaxLength = 20;
    public const int NoteMaxLength = 200;

    public Guid Id { get; init; }

    public required string UserId { get; init; }

    public DateOnly Date { get; set; }

    /// <summary>Catalog id of the machine, e.g. <c>incline-treadmill</c>.</summary>
    public required string Machine { get; set; }

    public decimal DurationMin { get; set; }

    public decimal? AvgSpeedKmh { get; set; }

    public decimal? InclinePercent { get; set; }

    public decimal? ResistanceLevel { get; set; }

    public decimal WeightKgUsed { get; set; }

    public int KcalGross { get; set; }

    public int KcalNet { get; set; }

    public required string FormulaVersion { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; init; }
}
