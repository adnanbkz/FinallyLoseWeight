namespace FinallyLoseWeight.Api.Common;

public static class TimeProviderExtensions
{
    /// <summary>
    /// UTC now truncated to whole microseconds (PostgreSQL <c>timestamptz</c> precision), so the value
    /// returned right after saving is identical to the one read back later.
    /// </summary>
    public static DateTime GetUtcNowForStorage(this TimeProvider time)
    {
        var now = time.GetUtcNow().UtcDateTime;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMicrosecond, DateTimeKind.Utc);
    }
}
