namespace FinallyLoseWeight.Api.Tests.Infrastructure;

// Response shapes written from docs/API.md, independent of the API's own DTO types, so the integration
// suite checks the wire contract (black box). Diary dates stay strings to assert the exact "YYYY-MM-DD"
// format; enums stay strings to assert the camelCase values.

public sealed record ProfileDto(
    string DisplayName,
    int? HeightCm,
    decimal? TargetWeightKg,
    int? DailyKcalTarget,
    DateTimeOffset ConsentAt,
    string PrivacyVersion,
    string CurrentPrivacyVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record WeightDto(string Date, decimal WeightKg, string? Note);

public sealed record MealDto(
    Guid Id,
    string Date,
    string MealType,
    string Description,
    int Kcal,
    decimal? ProteinG,
    decimal? CarbsG,
    decimal? FatG,
    DateTimeOffset CreatedAt);

public sealed record StepsDto(string Date, int Steps);

public sealed record MachineFieldDto(string Key, string Label, string Unit, decimal Min, decimal Max, decimal Step, bool Required);

public sealed record MachineDto(string Id, string Name, IReadOnlyList<MachineFieldDto> Fields);

public sealed record EstimateDto(
    int KcalGross,
    int KcalNet,
    decimal WeightKgUsed,
    string WeightSource,
    string Formula,
    string FormulaVersion);

public sealed record CardioDto(
    Guid Id,
    string Date,
    string Machine,
    string MachineName,
    decimal? DurationMin,
    decimal? AvgSpeedKmh,
    decimal? InclinePercent,
    decimal? ResistanceLevel,
    decimal WeightKgUsed,
    int KcalGross,
    int KcalNet,
    string FormulaVersion,
    string? Note,
    DateTimeOffset CreatedAt);

public sealed record DayTotalsDto(int KcalIn, decimal ProteinG, decimal CarbsG, decimal FatG, int KcalCardioGross, int KcalCardioNet);

public sealed record DayDto(
    string Date,
    WeightDto? Weight,
    IReadOnlyList<MealDto> Meals,
    int? Steps,
    IReadOnlyList<CardioDto> Cardio,
    DayTotalsDto Totals,
    int? DailyKcalTarget);

public sealed record StatsDayDto(string Date, decimal? WeightKg, decimal? WeightTrendKg, int? KcalIn, int KcalCardioNet, int? Steps);

public sealed record StatsDto(string From, string To, IReadOnlyList<StatsDayDto> Days);

public sealed record ExportDto(
    DateTimeOffset ExportedAt,
    ProfileDto? Profile,
    IReadOnlyList<WeightDto> Weights,
    IReadOnlyList<MealDto> Meals,
    IReadOnlyList<StepsDto> Steps,
    IReadOnlyList<CardioDto> Cardio);

/// <summary>Property names of every documented object, for exact-shape assertions.</summary>
public static class ContractShapes
{
    public static readonly string[] Profile =
        [
            "displayName", "heightCm", "targetWeightKg", "dailyKcalTarget", "consentAt", "privacyVersion",
            "currentPrivacyVersion", "createdAt", "updatedAt",
        ];

    public static readonly string[] Weight = ["date", "weightKg", "note"];

    public static readonly string[] Meal =
        ["id", "date", "mealType", "description", "kcal", "proteinG", "carbsG", "fatG", "createdAt"];

    public static readonly string[] Steps = ["date", "steps"];

    public static readonly string[] Machine = ["id", "name", "fields"];

    public static readonly string[] MachineField = ["key", "label", "unit", "min", "max", "step", "required"];

    public static readonly string[] Estimate = ["kcalGross", "kcalNet", "weightKgUsed", "weightSource", "formula", "formulaVersion"];

    public static readonly string[] Cardio =
    [
        "id", "date", "machine", "machineName", "durationMin", "avgSpeedKmh", "inclinePercent", "resistanceLevel",
        "weightKgUsed", "kcalGross", "kcalNet", "formulaVersion", "note", "createdAt",
    ];

    public static readonly string[] Day = ["date", "weight", "meals", "steps", "cardio", "totals", "dailyKcalTarget"];

    public static readonly string[] DayTotals = ["kcalIn", "proteinG", "carbsG", "fatG", "kcalCardioGross", "kcalCardioNet"];

    public static readonly string[] Stats = ["from", "to", "days"];

    public static readonly string[] StatsDay = ["date", "weightKg", "weightTrendKg", "kcalIn", "kcalCardioNet", "steps"];

    public static readonly string[] Export = ["exportedAt", "profile", "weights", "meals", "steps", "cardio"];
}
