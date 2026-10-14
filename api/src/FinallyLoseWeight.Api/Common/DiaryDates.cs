using System.Globalization;

namespace FinallyLoseWeight.Api.Common;

/// <summary>Diary dates: the user's local day as <c>YYYY-MM-DD</c>, chosen by the client.</summary>
public static class DiaryDate
{
    public const string Format = "yyyy-MM-dd";

    /// <summary>Strict <c>YYYY-MM-DD</c> parsing (no other formats, no time part).</summary>
    public static bool TryParse(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value, Format, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    public static string ToIsoString(this DateOnly date) => date.ToString(Format, CultureInfo.InvariantCulture);

    /// <summary><paramref name="date"/> minus <paramref name="days"/>, clamped to <see cref="DateOnly.MinValue"/>.</summary>
    public static DateOnly SubtractDaysClamped(this DateOnly date, int days) =>
        date.DayNumber >= days ? date.AddDays(-days) : DateOnly.MinValue;
}

/// <summary>Inclusive range of diary dates taken from the <c>from</c>/<c>to</c> query parameters.</summary>
public readonly record struct DateRange(DateOnly From, DateOnly To)
{
    /// <summary>Maximum length of list endpoints (<c>/api/weights</c>, <c>/api/meals</c>, ...).</summary>
    public const int MaxListDays = 1100;

    /// <summary>Maximum length of <c>/api/stats</c>.</summary>
    public const int MaxStatsDays = 366;

    /// <summary>Number of days in the range, both ends included.</summary>
    public int Days => To.DayNumber - From.DayNumber + 1;

    /// <summary>
    /// Validates <c>from</c>/<c>to</c>: both required, <c>YYYY-MM-DD</c>, <c>from ≤ to</c> and at most
    /// <paramref name="maxDays"/> days counting both ends. Errors go to the <c>from</c>/<c>to</c> keys.
    /// </summary>
    public static bool TryParse(string? from, string? to, int maxDays, ValidationErrors errors, out DateRange range)
    {
        range = default;
        var fromValid = ParseRequired("from", from, errors, out var fromDate);
        var toValid = ParseRequired("to", to, errors, out var toDate);
        if (!fromValid || !toValid)
        {
            return false;
        }

        if (fromDate > toDate)
        {
            errors.Add("from", "La fecha inicial no puede ser posterior a la final.");
            return false;
        }

        var candidate = new DateRange(fromDate, toDate);
        if (candidate.Days > maxDays)
        {
            errors.Add("to", $"El rango no puede superar los {maxDays} días.");
            return false;
        }

        range = candidate;
        return true;
    }

    public IEnumerable<DateOnly> EnumerateDays()
    {
        for (var day = From; day <= To; day = day.AddDays(1))
        {
            yield return day;
            if (day == DateOnly.MaxValue)
            {
                yield break;
            }
        }
    }

    private static bool ParseRequired(string field, string? value, ValidationErrors errors, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add(field, ValidationErrors.Messages.Required);
            return false;
        }

        if (!DiaryDate.TryParse(value, out date))
        {
            errors.Add(field, ValidationErrors.Messages.InvalidDate);
            return false;
        }

        return true;
    }
}
