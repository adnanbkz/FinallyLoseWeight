using System.Diagnostics.CodeAnalysis;

namespace FinallyLoseWeight.Api.Cardio;

/// <summary>All registered <see cref="ICardioCalculator"/>s, in registration order.</summary>
public sealed class CardioCatalog
{
    private readonly Dictionary<string, ICardioCalculator> _calculators;

    public CardioCatalog(IEnumerable<ICardioCalculator> calculators)
    {
        var list = calculators.ToList();
        foreach (var calculator in list)
        {
            EnsureValid(calculator.Machine);
        }

        _calculators = list.ToDictionary(c => c.Machine.Id, StringComparer.Ordinal);
        Machines = list.Select(c => c.Machine).ToList();
    }

    public IReadOnlyList<CardioMachine> Machines { get; }

    public bool TryGet(string? machineId, [NotNullWhen(true)] out ICardioCalculator? calculator)
    {
        calculator = null;
        return machineId is not null && _calculators.TryGetValue(machineId, out calculator);
    }

    /// <summary>Display name of a machine; falls back to the id for machines no longer in the catalog.</summary>
    public string GetName(string machineId) =>
        TryGet(machineId, out var calculator) ? calculator.Machine.Name : machineId;

    private static void EnsureValid(CardioMachine machine)
    {
        var unknown = machine.Fields.Select(f => f.Key).Where(key => !CardioFieldKeys.All.Contains(key)).ToList();
        if (unknown.Count > 0)
        {
            throw new InvalidOperationException(
                $"Cardio machine '{machine.Id}' declares unknown fields: {string.Join(", ", unknown)}.");
        }

        if (!machine.Fields.Any(f => f.Key == CardioFieldKeys.DurationMin && f.Required))
        {
            throw new InvalidOperationException(
                $"Cardio machine '{machine.Id}' must declare '{CardioFieldKeys.DurationMin}' as a required field.");
        }
    }
}
