using System.Numerics;
using FinallyLoseWeight.Api.Cardio;

namespace FinallyLoseWeight.Api.Tests.Cardio;

public class InclineTreadmillCalculatorTests
{
    private readonly InclineTreadmillCalculator _calculator = new();

    private CardioCalculation Calculate(decimal speedKmh, decimal inclinePercent, decimal durationMin, decimal weightKg) =>
        _calculator.Calculate(new CardioParameters(durationMin, speedKmh, inclinePercent, ResistanceLevel: null), weightKg);

    [Fact]
    public void Contract_example_70kg_4_8kmh_12pct_30min_gives_302_gross_265_net()
    {
        var result = Calculate(speedKmh: 4.8m, inclinePercent: 12m, durationMin: 30m, weightKg: 70m);

        Assert.Equal(302, result.KcalGross);
        Assert.Equal(265, result.KcalNet);
        Assert.Equal("acsm-walking", result.Formula);
        Assert.Equal("acsm-v1", result.FormulaVersion);
    }

    [Fact]
    public void Zero_incline_walking_uses_only_the_horizontal_component()
    {
        // S = 80 m/min; VO2 = 8 + 3.5 = 11.5 → 11.5·70/1000·5·30 = 120.75; net 8·10.5 = 84.
        var result = Calculate(speedKmh: 4.8m, inclinePercent: 0m, durationMin: 30m, weightKg: 70m);

        Assert.Equal(121, result.KcalGross);
        Assert.Equal(84, result.KcalNet);
        Assert.Equal("acsm-walking", result.Formula);
    }

    [Fact]
    public void Seven_kmh_is_already_running()
    {
        // S = 116.67 m/min; VO2 = 23.33 + 3.5 → gross 281.75 → 282; net 245.
        var result = Calculate(speedKmh: 7m, inclinePercent: 0m, durationMin: 30m, weightKg: 70m);

        Assert.Equal("acsm-running", result.Formula);
        Assert.Equal(282, result.KcalGross);
        Assert.Equal(245, result.KcalNet);
    }

    [Fact]
    public void Just_below_seven_kmh_is_still_walking()
    {
        // S = 115 m/min; VO2 = 11.5 + 3.5 = 15 → gross 157.5 → 158; net 120.75 → 121.
        var result = Calculate(speedKmh: 6.9m, inclinePercent: 0m, durationMin: 30m, weightKg: 70m);

        Assert.Equal("acsm-walking", result.Formula);
        Assert.Equal(158, result.KcalGross);
        Assert.Equal(121, result.KcalNet);
    }

    [Fact]
    public void Running_with_incline_uses_the_running_grade_coefficient()
    {
        // S = 166.67; VO2 = 33.33 + 0.9·166.67·0.05 (7.5) + 3.5 = 44.33; factor 80/1000·5·20 = 8.
        var result = Calculate(speedKmh: 10m, inclinePercent: 5m, durationMin: 20m, weightKg: 80m);

        Assert.Equal("acsm-running", result.Formula);
        Assert.Equal(355, result.KcalGross); // 354.67
        Assert.Equal(327, result.KcalNet); // 326.67
    }

    [Fact]
    public void Midpoints_round_away_from_zero()
    {
        // S = 100 m/min, 0 %, 50 kg, 1 min: net = 10·50/1000·5 = 2.5 → 3 (banker's rounding would give 2).
        var result = Calculate(speedKmh: 6m, inclinePercent: 0m, durationMin: 1m, weightKg: 50m);

        Assert.Equal(3, result.KcalNet);
        Assert.Equal(3, result.KcalGross); // 3.375
    }

    [Theory]
    // S = 83.33… m/min is a repeating decimal: VO2 = 8.333… + 12 + 3.5 = 23.833…, gross 23.833…·60/1000·5·30 = 214.5.
    [InlineData("5", "8", "30", "60", 215, 183)]
    // S = 48.33… m/min: gross (4.833… + 3.5)·50/1000·5·54 = 112.5; net 65.25.
    [InlineData("2.9", "0", "54", "50", 113, 65)]
    // Net 5·2·55·30/600 = 27.5.
    [InlineData("2", "0", "30", "55", 56, 28)]
    public void Exact_midpoints_with_repeating_speeds_round_away_from_zero(
        string speedKmh, string inclinePercent, string durationMin, string weightKg, int gross, int net)
    {
        static decimal D(string value) => decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture);

        var result = Calculate(D(speedKmh), D(inclinePercent), D(durationMin), D(weightKg));

        Assert.Equal((gross, net), (result.KcalGross, result.KcalNet));
    }

    [Fact]
    public void Matches_exact_rational_arithmetic_on_a_grid_of_typical_inputs()
    {
        // Reference: the contract formula with exact fractions (numerator / denominator, BigInteger),
        // rounded half away from zero. Inputs in tenths: speed 2.0–9.0 km/h, incline 0–15 %, 50–100 kg.
        for (var speedTenths = 20; speedTenths <= 90; speedTenths += 3)
        {
            for (var inclineTenths = 0; inclineTenths <= 150; inclineTenths += 15)
            {
                for (var kg = 50; kg <= 100; kg += 5)
                {
                    foreach (var minutes in new[] { 1, 20, 30, 45, 54, 60 })
                    {
                        var result = Calculate(speedTenths / 10m, inclineTenths / 10m, minutes, kg);
                        var (gross, net) = ExactKcal(speedTenths, inclineTenths, kg, minutes);
                        Assert.True((gross, net) == (result.KcalGross, result.KcalNet),
                            $"{speedTenths / 10m} km/h, {inclineTenths / 10m} %, {minutes} min, {kg} kg: "
                            + $"expected {gross}/{net}, got {result.KcalGross}/{result.KcalNet}");
                    }
                }
            }
        }
    }

    /// <summary>Contract formula in exact rational arithmetic (speed and incline in tenths).</summary>
    private static (int Gross, int Net) ExactKcal(int speedTenths, int inclineTenths, int kg, int minutes)
    {
        // S = v·1000/60 = speedTenths·100/60 and G = inclineTenths/1000. VO2 net = a·S + b·S·G with
        // (a, b) = (0.1, 1.8) walking or (0.2, 0.9) running. Over the common denominator 10·60·1000:
        // a·S = aTenths·s·1000 / D and b·S·G = bTenths·s·inclineTenths / D, with s = speedTenths·100.
        const int denominator = 10 * 60 * 1000;
        var running = speedTenths >= 70;
        BigInteger s = speedTenths * 100;
        BigInteger aTenths = running ? 2 : 1;
        BigInteger bTenths = running ? 9 : 18;
        var netNumerator = aTenths * s * 1000 + bTenths * s * inclineTenths;
        var grossNumerator = netNumerator + (BigInteger)35 * denominator / 10; // + 3.5
        // kcal = VO2 · kg / 1000 · 5 · min
        var kcalDenominator = (BigInteger)denominator * 1000;
        return (
            RoundHalfAwayFromZero(grossNumerator * kg * 5 * minutes, kcalDenominator),
            RoundHalfAwayFromZero(netNumerator * kg * 5 * minutes, kcalDenominator));
    }

    /// <summary>Non-negative fractions only: floor((2·n + d) / (2·d)).</summary>
    private static int RoundHalfAwayFromZero(BigInteger numerator, BigInteger denominator) =>
        (int)((2 * numerator + denominator) / (2 * denominator));

    [Fact]
    public void Descriptor_matches_the_contract()
    {
        var machine = _calculator.Machine;

        Assert.Equal("incline-treadmill", machine.Id);
        Assert.Equal("Cinta inclinada", machine.Name);
        Assert.Collection(machine.Fields,
            f => Assert.Equal(new CardioField("inclinePercent", "Pendiente", "%", 0m, 40m, 0.5m, true), f),
            f => Assert.Equal(new CardioField("durationMin", "Tiempo", "min", 1m, 600m, 1m, true), f),
            f => Assert.Equal(new CardioField("avgSpeedKmh", "Velocidad media", "km/h", 0.5m, 25m, 0.1m, true), f));
    }

    [Fact]
    public void Missing_speed_or_incline_is_a_programming_error()
    {
        Assert.Throws<ArgumentException>(() =>
            _calculator.Calculate(new CardioParameters(30m, AvgSpeedKmh: null, InclinePercent: 5m, null), 70m));
        Assert.Throws<ArgumentException>(() =>
            _calculator.Calculate(new CardioParameters(30m, AvgSpeedKmh: 5m, InclinePercent: null, null), 70m));
    }
}
