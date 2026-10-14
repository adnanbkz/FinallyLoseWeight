using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinallyLoseWeight.Api.Data;

/// <summary>
/// Per-user isolation has two layers: every query in the endpoints filters by the UID explicitly, and
/// every per-user entity also has a global query filter bound to <see cref="ICurrentUser"/>. Outside an
/// authenticated request the UID is null and the filters match nothing (fail closed); use
/// <c>IgnoreQueryFilters()</c> only for deliberate cross-user maintenance code (and tests).
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser)
    : DbContext(options)
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();

    public DbSet<MealEntry> MealEntries => Set<MealEntry>();

    public DbSet<DailySteps> DailySteps => Set<DailySteps>();

    public DbSet<CardioSession> CardioSessions => Set<CardioSession>();

    /// <summary>UID used by the global query filters. EF Core reads it again for every query.</summary>
    private string? CurrentUserId => currentUser.Uid;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserProfile>(profile =>
        {
            profile.HasKey(p => p.Uid);
            profile.Property(p => p.Uid).HasMaxLength(UserProfile.UidMaxLength);
            profile.Property(p => p.DisplayName).HasMaxLength(UserProfile.DisplayNameMaxLength);
            profile.Property(p => p.TargetWeightKg).HasPrecision(5, 2);
            profile.Property(p => p.PrivacyVersion).HasMaxLength(UserProfile.PrivacyVersionMaxLength);
            profile.HasQueryFilter(p => p.Uid == CurrentUserId);
        });

        modelBuilder.Entity<WeightEntry>(weight =>
        {
            ConfigureUserOwned(weight);
            weight.Property(w => w.Id).ValueGeneratedNever();
            weight.Property(w => w.WeightKg).HasPrecision(5, 2);
            weight.Property(w => w.Note).HasMaxLength(WeightEntry.NoteMaxLength);
            weight.HasIndex(w => new { w.UserId, w.Date }).IsUnique();
            weight.HasQueryFilter(w => w.UserId == CurrentUserId);
        });

        modelBuilder.Entity<MealEntry>(meal =>
        {
            ConfigureUserOwned(meal);
            meal.Property(m => m.Id).ValueGeneratedNever();
            meal.Property(m => m.MealType).HasConversion<string>().HasMaxLength(16);
            meal.Property(m => m.Description).HasMaxLength(MealEntry.DescriptionMaxLength);
            meal.Property(m => m.ProteinG).HasPrecision(6, 2);
            meal.Property(m => m.CarbsG).HasPrecision(6, 2);
            meal.Property(m => m.FatG).HasPrecision(6, 2);
            meal.HasIndex(m => new { m.UserId, m.Date });
            meal.HasQueryFilter(m => m.UserId == CurrentUserId);
        });

        modelBuilder.Entity<DailySteps>(steps =>
        {
            ConfigureUserOwned(steps);
            steps.Property(s => s.Id).ValueGeneratedNever();
            steps.HasIndex(s => new { s.UserId, s.Date }).IsUnique();
            steps.HasQueryFilter(s => s.UserId == CurrentUserId);
        });

        modelBuilder.Entity<CardioSession>(cardio =>
        {
            ConfigureUserOwned(cardio);
            cardio.Property(c => c.Id).ValueGeneratedNever();
            cardio.Property(c => c.Machine).HasMaxLength(CardioSession.MachineMaxLength);
            cardio.Property(c => c.DurationMin).HasPrecision(6, 2);
            cardio.Property(c => c.AvgSpeedKmh).HasPrecision(5, 2);
            cardio.Property(c => c.InclinePercent).HasPrecision(5, 2);
            cardio.Property(c => c.ResistanceLevel).HasPrecision(5, 2);
            cardio.Property(c => c.WeightKgUsed).HasPrecision(5, 2);
            cardio.Property(c => c.FormulaVersion).HasMaxLength(CardioSession.FormulaVersionMaxLength);
            cardio.Property(c => c.Note).HasMaxLength(CardioSession.NoteMaxLength);
            cardio.HasIndex(c => new { c.UserId, c.Date });
            cardio.HasQueryFilter(c => c.UserId == CurrentUserId);
        });
    }

    /// <summary>Owner column + FK to the profile with ON DELETE CASCADE.</summary>
    private static void ConfigureUserOwned<TEntity>(EntityTypeBuilder<TEntity> entity)
        where TEntity : class
    {
        entity.Property<string>("UserId").HasMaxLength(UserProfile.UidMaxLength);
        entity.HasOne<UserProfile>()
            .WithMany()
            .HasForeignKey("UserId")
            .OnDelete(DeleteBehavior.Cascade);
    }
}
