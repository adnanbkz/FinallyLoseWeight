namespace FinallyLoseWeight.Api.Configuration;

/// <summary>Parses comma-separated configuration values such as <c>Access:AllowedEmails</c>.</summary>
public static class SettingsList
{
    /// <summary>Splits on commas, trims every item and drops empty ones. <c>null</c> yields an empty list.</summary>
    public static IReadOnlyList<string> Parse(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
}
