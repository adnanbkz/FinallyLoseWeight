using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FinallyLoseWeight.Api.Data;

public static class DbContextExtensions
{
    /// <summary>True when the save failed on a unique index / primary key (PostgreSQL 23505).</summary>
    public static bool IsUniqueViolation(this DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    /// <summary>
    /// Runs a read-then-insert-or-update operation and, if a concurrent request inserted the same
    /// natural key first (unique violation), runs it once more on a clean change tracker so the
    /// second attempt finds and updates the row that won the race.
    /// </summary>
    public static async Task<T> RetryOnUniqueViolationAsync<T>(this DbContext db, Func<Task<T>> operation)
    {
        try
        {
            return await operation();
        }
        catch (DbUpdateException exception) when (exception.IsUniqueViolation())
        {
            db.ChangeTracker.Clear();
            return await operation();
        }
    }
}
