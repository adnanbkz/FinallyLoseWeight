using FinallyLoseWeight.Api.Configuration;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Common;

public static class CorsSetup
{
    /// <summary>
    /// Default CORS policy for the PWA origins in <c>Cors:AllowedOrigins</c> (none configured = no
    /// cross-origin access). Bearer tokens only, so credentials (cookies) are not allowed.
    /// </summary>
    public static IServiceCollection AddApiCors(this IServiceCollection services)
    {
        services.AddCors();
        services.AddOptions<CorsOptions>()
            .Configure<IOptions<CorsSettings>>((options, settings) =>
            {
                var origins = SettingsList.Parse(settings.Value.AllowedOrigins)
                    .Select(origin => origin.TrimEnd('/'))
                    .ToArray();

                options.AddDefaultPolicy(policy => policy
                    .WithOrigins(origins)
                    .WithMethods(HttpMethods.Get, HttpMethods.Post, HttpMethods.Put, HttpMethods.Delete)
                    .WithHeaders("Authorization", "Content-Type")
                    .WithExposedHeaders("Content-Disposition", "Retry-After")
                    .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));
            });

        return services;
    }
}
