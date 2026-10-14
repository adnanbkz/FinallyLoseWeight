using System.Globalization;
using Microsoft.AspNetCore.Http.HttpResults;

namespace FinallyLoseWeight.Api.Common;

/// <summary>
/// Collects field errors (camelCase keys, Spanish messages) and turns them into a 400 ValidationProblem.
/// The check helpers return the normalized value so validation and normalization happen in one pass.
/// </summary>
public sealed class ValidationErrors
{
    public const string Title = "Hay errores de validación.";

    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.Ordinal);

    public bool HasErrors => _errors.Count > 0;

    public void Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var messages))
        {
            messages = [];
            _errors[field] = messages;
        }

        messages.Add(message);
    }

    public IDictionary<string, string[]> ToDictionary() =>
        _errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray(), StringComparer.Ordinal);

    public ValidationProblem ToProblem() => TypedResults.ValidationProblem(ToDictionary(), title: Title);

    /// <summary>Single-field shortcut.</summary>
    public static ValidationProblem Problem(string field, string message)
    {
        var errors = new ValidationErrors();
        errors.Add(field, message);
        return errors.ToProblem();
    }

    /// <summary>Non-null value or a "required" error.</summary>
    public T? Required<T>(string field, T? value) where T : struct
    {
        if (value is null)
        {
            Add(field, Messages.Required);
        }

        return value;
    }

    /// <summary>Optional integer in <c>[min, max]</c>; <c>null</c> when missing or out of range.</summary>
    public int? Range(string field, int? value, int min, int max)
    {
        if (value is { } v && (v < min || v > max))
        {
            Add(field, Messages.Range(min, max));
            return null;
        }

        return value;
    }

    /// <summary>Required integer in <c>[min, max]</c>.</summary>
    public int? RequiredRange(string field, int? value, int min, int max) =>
        value is null ? Required(field, value) : Range(field, value, min, max);

    /// <summary>
    /// Optional decimal in <c>[min, max]</c>, rounded to <paramref name="decimals"/> places for storage;
    /// <c>null</c> when missing or out of range.
    /// </summary>
    public decimal? Range(string field, decimal? value, decimal min, decimal max, int decimals = 2)
    {
        if (value is not { } v)
        {
            return null;
        }

        if (v < min || v > max)
        {
            Add(field, Messages.Range(min, max));
            return null;
        }

        return Math.Round(v, decimals, MidpointRounding.AwayFromZero);
    }

    /// <summary>Required decimal in <c>[min, max]</c>.</summary>
    public decimal? RequiredRange(string field, decimal? value, decimal min, decimal max, int decimals = 2) =>
        value is null ? Required(field, value) : Range(field, value, min, max, decimals);

    /// <summary>Required trimmed text of 1..<paramref name="maxLength"/> characters.</summary>
    public string? RequiredText(string field, string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            Add(field, Messages.Required);
            return null;
        }

        if (trimmed.Length > maxLength)
        {
            Add(field, Messages.Length(1, maxLength));
            return null;
        }

        return trimmed;
    }

    /// <summary>Optional trimmed text; blank becomes <c>null</c>.</summary>
    public string? OptionalText(string field, string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        if (trimmed.Length > maxLength)
        {
            Add(field, Messages.MaxLength(maxLength));
            return null;
        }

        return trimmed;
    }

    /// <summary>Spanish validation messages.</summary>
    public static class Messages
    {
        public const string Required = "Este campo es obligatorio.";
        public const string InvalidValue = "El valor no es válido.";
        public const string InvalidDate = "Fecha no válida. Usa el formato AAAA-MM-DD.";

        public static string Range(decimal min, decimal max) => $"Debe estar entre {Format(min)} y {Format(max)}.";

        public static string Length(int min, int max) => $"Debe tener entre {min} y {max} caracteres.";

        public static string MaxLength(int max) => $"No puede superar los {max} caracteres.";

        /// <summary>Spanish number format (decimal comma, no trailing zeros).</summary>
        public static string Format(decimal value) =>
            value.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',');
    }
}
