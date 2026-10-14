using System.Globalization;
using System.Threading.RateLimiting;
using FinallyLoseWeight.Api.Auth;
using FinallyLoseWeight.Api.Configuration;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Common;

public static class RateLimitingSetup
{
    /// <summary>
    /// Global fixed-window limiter: <c>RateLimit:PermitsPerMinute</c> per Firebase UID, or per remote IP
    /// for requests without a valid token. Must run after <c>UseAuthentication</c> so the UID is known.
    /// Endpoints opt out with <c>DisableRateLimiting()</c> (only <c>/health</c>, which never touches the database).
    /// </summary>
    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(PartitionKey(httpContext), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = httpContext.RequestServices
                        .GetRequiredService<IOptions<RateLimitSettings>>().Value.PermitsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                }));

            options.OnRejected = async (context, _) =>
            {
                var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
                    ? Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds))
                    : 60;

                context.HttpContext.Response.Headers.RetryAfter = retryAfter.ToString(CultureInfo.InvariantCulture);
                await ApiProblems.TooManyRequests(retryAfter).ExecuteAsync(context.HttpContext);
            };
        });

        return services;
    }

    private static string PartitionKey(HttpContext httpContext) =>
        httpContext.User.GetUid() is { } uid
            ? $"uid:{uid}"
            : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}
