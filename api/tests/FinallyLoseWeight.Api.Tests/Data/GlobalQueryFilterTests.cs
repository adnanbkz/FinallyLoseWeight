using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Data;
using FinallyLoseWeight.Api.Data.Entities;
using FinallyLoseWeight.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace FinallyLoseWeight.Api.Tests.Data;

/// <summary>
/// The global query filters alone (without the explicit <c>UserId</c> filters of the endpoints) must keep
/// every user inside their own rows, and match nothing when there is no current user.
/// </summary>
public class GlobalQueryFilterTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private sealed class FixedUser(string? uid) : ICurrentUser
    {
        public string? Uid => uid;
    }

    private AppDbContext CreateContext(string? uid)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, api.ConnectionString);
        return new AppDbContext(options.Options, new FixedUser(uid));
    }

    [Fact]
    public async Task Unfiltered_queries_only_see_the_current_users_rows()
    {
        var alice = $"alice-{Guid.NewGuid():N}";
        var bob = $"bob-{Guid.NewGuid():N}";
        await using (var seed = CreateContext(uid: null))
        {
            foreach (var uid in new[] { alice, bob })
            {
                var now = DateTime.UtcNow;
                seed.UserProfiles.Add(new UserProfile
                {
                    Uid = uid,
                    DisplayName = uid,
                    PrivacyVersion = "1",
                    ConsentAt = now,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                seed.WeightEntries.Add(new WeightEntry
                {
                    Id = Guid.CreateVersion7(),
                    UserId = uid,
                    Date = new DateOnly(2026, 10, 14),
                    WeightKg = 70m,
                });
                seed.MealEntries.Add(new MealEntry
                {
                    Id = Guid.CreateVersion7(),
                    UserId = uid,
                    Date = new DateOnly(2026, 10, 14),
                    MealType = MealType.Lunch,
                    Description = "x",
                    Kcal = 100,
                    CreatedAt = now,
                });
                seed.DailySteps.Add(new DailySteps
                {
                    Id = Guid.CreateVersion7(),
                    UserId = uid,
                    Date = new DateOnly(2026, 10, 14),
                    Steps = 1000,
                });
                seed.CardioSessions.Add(new CardioSession
                {
                    Id = Guid.CreateVersion7(),
                    UserId = uid,
                    Date = new DateOnly(2026, 10, 14),
                    Machine = "incline-treadmill",
                    DurationMin = 30m,
                    WeightKgUsed = 70m,
                    FormulaVersion = "acsm-v1",
                    CreatedAt = now,
                });
            }

            await seed.SaveChangesAsync();
        }

        await using var asAlice = CreateContext(alice);
        Assert.Equal([alice], await asAlice.UserProfiles.Select(p => p.Uid).ToListAsync());
        Assert.Equal([alice], await asAlice.WeightEntries.Select(w => w.UserId).ToListAsync());
        Assert.Equal([alice], await asAlice.MealEntries.Select(m => m.UserId).ToListAsync());
        Assert.Equal([alice], await asAlice.DailySteps.Select(s => s.UserId).ToListAsync());
        Assert.Equal([alice], await asAlice.CardioSessions.Select(c => c.UserId).ToListAsync());

        // Bulk deletes are filtered too: Alice cannot delete Bob's rows even by naming them.
        Assert.Equal(0, await asAlice.WeightEntries.Where(w => w.UserId == bob).ExecuteDeleteAsync());

        await using var anonymous = CreateContext(uid: null);
        Assert.False(await anonymous.WeightEntries.AnyAsync());
        Assert.False(await anonymous.UserProfiles.AnyAsync());
        Assert.Equal(1, (await api.CountRowsAsync(bob)).Weights);
    }
}
