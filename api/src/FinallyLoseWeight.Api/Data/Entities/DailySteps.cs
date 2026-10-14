namespace FinallyLoseWeight.Api.Data.Entities;

/// <summary>Step count of a day. Unique per (user, date).</summary>
public sealed class DailySteps
{
    public Guid Id { get; init; }

    public required string UserId { get; init; }

    public DateOnly Date { get; init; }

    public int Steps { get; set; }
}
