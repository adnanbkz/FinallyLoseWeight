namespace FinallyLoseWeight.Api.Data.Entities;

public enum MealType
{
    Breakfast,
    Lunch,
    Dinner,
    Snack,
}

/// <summary>A meal of a day. Several per (user, date).</summary>
public sealed class MealEntry
{
    public const int DescriptionMaxLength = 200;

    public Guid Id { get; init; }

    public required string UserId { get; init; }

    public DateOnly Date { get; set; }

    public MealType MealType { get; set; }

    public required string Description { get; set; }

    public int Kcal { get; set; }

    public decimal? ProteinG { get; set; }

    public decimal? CarbsG { get; set; }

    public decimal? FatG { get; set; }

    public DateTime CreatedAt { get; init; }
}
