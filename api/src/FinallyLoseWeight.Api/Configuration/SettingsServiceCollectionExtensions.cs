namespace FinallyLoseWeight.Api.Configuration;

public static class SettingsServiceCollectionExtensions
{
    /// <summary>Binds and validates every settings section. Invalid values fail at startup.</summary>
    public static IServiceCollection AddAppSettings(this IServiceCollection services)
    {
        services.AddOptions<FirebaseSettings>()
            .BindConfiguration(FirebaseSettings.SectionName)
            .Validate(s => !string.IsNullOrWhiteSpace(s.ProjectId),
                "Falta Firebase:ProjectId (id del proyecto de Firebase usado para validar los tokens).")
            .ValidateOnStart();

        services.AddOptions<AccessSettings>().BindConfiguration(AccessSettings.SectionName);
        services.AddOptions<CorsSettings>().BindConfiguration(CorsSettings.SectionName);

        services.AddOptions<PrivacySettings>()
            .BindConfiguration(PrivacySettings.SectionName)
            .Validate(s => !string.IsNullOrWhiteSpace(s.CurrentVersion) && s.CurrentVersion.Length <= 20,
                "Privacy:CurrentVersion debe tener entre 1 y 20 caracteres.")
            .ValidateOnStart();

        services.AddOptions<SecuritySettings>()
            .BindConfiguration(SecuritySettings.SectionName)
            .Validate(s => s.ReauthMaxAgeMinutes > 0, "Security:ReauthMaxAgeMinutes debe ser mayor que 0.")
            .ValidateOnStart();

        services.AddOptions<RateLimitSettings>()
            .BindConfiguration(RateLimitSettings.SectionName)
            .Validate(s => s.PermitsPerMinute > 0, "RateLimit:PermitsPerMinute debe ser mayor que 0.")
            .ValidateOnStart();

        services.AddOptions<DatabaseSettings>().BindConfiguration(DatabaseSettings.SectionName);

        return services;
    }
}
