using FinallyLoseWeight.Api.Configuration;
using FinallyLoseWeight.Api.Data.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FinallyLoseWeight.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    /// <summary>
    /// Validates Firebase ID tokens (RS256, keys from Google's OpenID metadata). The options are built
    /// through the options pipeline so tests can <c>PostConfigure&lt;JwtBearerOptions&gt;</c> to trust a
    /// local signing key without any network access.
    /// </summary>
    public static IServiceCollection AddFirebaseAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<FirebaseSettings>>((options, firebase) =>
            {
                var projectId = firebase.Value.ProjectId.Trim();
                var issuer = FirebaseSettings.IssuerFor(projectId);

                options.Authority = issuer;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = projectId,
                    ValidateLifetime = true,
                    RequireExpirationTime = true,
                    ValidateIssuerSigningKey = true,
                    RequireSignedTokens = true,
                    NameClaimType = FirebaseClaimTypes.Subject,
                };
                options.Events = new JwtBearerEvents
                {
                    // The UID is the primary key of every user's data: a token without a usable
                    // 'sub' is not a valid Firebase ID token, whatever its signature says.
                    OnTokenValidated = context =>
                    {
                        var uid = context.Principal?.GetUid();
                        if (uid is null || uid.Length > UserProfile.UidMaxLength)
                        {
                            context.Fail("The token has no valid 'sub' claim.");
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();

        return services;
    }

    /// <summary>Registers <see cref="AccessPolicies"/> and the problem+json result handler.</summary>
    public static IServiceCollection AddAccessPolicies(this IServiceCollection services)
    {
        services.AddSingleton<InvitationList>();
        services.AddScoped<IAuthorizationHandler, AccessAuthorizationHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ProblemDetailsAuthorizationResultHandler>();

        services.AddAuthorizationBuilder()
            // Defence in depth: an endpoint that forgets to declare a policy still needs a valid token.
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(AccessPolicies.AuthenticatedUser, policy => policy.RequireAuthenticatedUser())
            .AddPolicy(AccessPolicies.InvitedUser, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new AccessRequirement(RequireProfile: false)))
            .AddPolicy(AccessPolicies.RegisteredUser, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new AccessRequirement(RequireProfile: true)));

        return services;
    }
}
