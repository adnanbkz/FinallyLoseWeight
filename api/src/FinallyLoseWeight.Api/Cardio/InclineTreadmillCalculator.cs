namespace FinallyLoseWeight.Api.Cardio;

/// <summary>
/// Treadmill with incline, ACSM metabolic equations (formula version <c>acsm-v1</c>, docs/API.md):
/// <list type="bullet">
/// <item><c>S = avgSpeedKmh · 1000 / 60</c> (m/min), <c>G = inclinePercent / 100</c>.</item>
/// <item>Walking (&lt; 7 km/h): <c>VO2 = 0.1·S + 1.8·S·G + 3.5</c>; running (≥ 7 km/h): <c>VO2 = 0.2·S + 0.9·S·G + 3.5</c> (ml/kg/min).</item>
/// <item><c>kcalGross = round(VO2 · kg / 1000 · 5 · min)</c>, <c>kcalNet</c> the same with <c>VO2 − 3.5</c>,
/// rounding half away from zero.</item>
/// </list>
/// <para>
/// <c>S</c> is a repeating decimal for most speeds (5 km/h = 83.33… m/min), so evaluating the formula step by
/// step would truncate it and an exact .5 result could come out as .4999… and round down. The equations are
/// therefore rewritten with a single division at the end, which is exact for exact midpoints:
/// <c>VO2 = n / 3</c> with <c>n = 5·v + 0.9·v·i + 10.5</c> (walking) or <c>n = 10·v + 0.45·v·i + 10.5</c> (running),
/// <c>v</c> in km/h and <c>i</c> in %; then <c>kcal = n · kg · min / 600</c>.
/// </para>
/// </summary>
public sealed class InclineTreadmillCalculator : ICardioCalculator
{
    public const string MachineId = "incline-treadmill";
    public const string FormulaVersion = "acsm-v1";
    public const string WalkingFormula = "acsm-walking";
    public const string RunningFormula = "acsm-running";

    /// <summary>Speeds at or above this use the running equation.</summary>
    public const decimal RunningThresholdKmh = 7m;

    /// <summary>Resting oxygen consumption (1 MET), ml/kg/min.</summary>
    public const decimal RestingVo2 = 3.5m;

    /// <summary>Approximate kcal per litre of O2.</summary>
    private const decimal KcalPerLitreO2 = 5m;

    public CardioMachine Machine { get; } = new(
        MachineId,
        "Cinta inclinada",
        [
            new CardioField(CardioFieldKeys.InclinePercent, "Pendiente", "%", 0m, 40m, 0.5m, Required: true),
            new CardioField(CardioFieldKeys.DurationMin, "Tiempo", "min", 1m, 600m, 1m, Required: true),
            new CardioField(CardioFieldKeys.AvgSpeedKmh, "Velocidad media", "km/h", 0.5m, 25m, 0.1m, Required: true),
        ]);

    public CardioCalculation Calculate(CardioParameters parameters, decimal weightKg)
    {
        var speedKmh = parameters.AvgSpeedKmh
            ?? throw new ArgumentException("The incline treadmill needs the average speed.", nameof(parameters));
        var inclinePercent = parameters.InclinePercent
            ?? throw new ArgumentException("The incline treadmill needs the incline.", nameof(parameters));

        var running = speedKmh >= RunningThresholdKmh;

        // 3·VO2 (see the class remarks): S = v·50/3 and G = i/100, so
        // walking 3·(0.1·S + 1.8·S·G) = 5·v + 0.9·v·i and running 3·(0.2·S + 0.9·S·G) = 10·v + 0.45·v·i.
        var netVo2Times3 = running
            ? 10m * speedKmh + 0.45m * speedKmh * inclinePercent
            : 5m * speedKmh + 0.9m * speedKmh * inclinePercent;
        var grossVo2Times3 = netVo2Times3 + 3m * RestingVo2;

        return new CardioCalculation(
            KcalGross: Kcal(grossVo2Times3, weightKg, parameters.DurationMin),
            KcalNet: Kcal(netVo2Times3, weightKg, parameters.DurationMin),
            Formula: running ? RunningFormula : WalkingFormula,
            FormulaVersion: FormulaVersion);
    }

    /// <summary><c>VO2 · kg / 1000 · 5 · min</c> with <c>VO2 = vo2Times3 / 3</c>: one exact division by 600.</summary>
    private static int Kcal(decimal vo2Times3, decimal weightKg, decimal durationMin) =>
        (int)Math.Round(
            vo2Times3 * weightKg * durationMin * KcalPerLitreO2 / (3m * 1000m),
            MidpointRounding.AwayFromZero);
}
