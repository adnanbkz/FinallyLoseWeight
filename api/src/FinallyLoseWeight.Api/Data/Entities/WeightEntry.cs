namespace FinallyLoseWeight.Api.Data.Entities;

/// <summary>Body weight of a day. Unique per (user, date).</summary>
public sealed class WeightEntry
{
    public const int NoteMaxLength = 200;

    public Guid Id { get; init; }

    public required string UserId { get; init; }

    public DateOnly Date { get; init; }

    public decimal WeightKg { get; set; }

    public string? Note { get; set; }
}
