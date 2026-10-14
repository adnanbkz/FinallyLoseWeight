using FinallyLoseWeight.Api.Configuration;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Firebase;

public static class FirebaseSetup
{
    private const string FirebaseAppName = "finallyloseweight";

    /// <summary>
    /// Registers <see cref="IFirebaseUsers"/>. With <c>Firebase:ServiceAccountJson</c> it uses the
    /// Admin SDK; without it, Development gets a stand-in that logs a warning (it neither checks nor
    /// deletes users) and every other environment fails when the service is resolved (Program.cs
    /// resolves it at startup, so it fails fast).
    /// </summary>
    public static IServiceCollection AddFirebaseUsers(this IServiceCollection services)
    {
        services.AddSingleton<IFirebaseUsers>(serviceProvider =>
        {
            var settings = serviceProvider.GetRequiredService<IOptions<FirebaseSettings>>().Value;
            if (!string.IsNullOrWhiteSpace(settings.ServiceAccountJson))
            {
                var credential = CredentialFactory
                    .FromJson<ServiceAccountCredential>(settings.ServiceAccountJson)
                    .ToGoogleCredential();
                var app = FirebaseApp.Create(
                    new AppOptions { Credential = credential, ProjectId = settings.ProjectId }, FirebaseAppName);
                return new FirebaseAdminUsers(app);
            }

            if (serviceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment())
            {
                var users = ActivatorUtilities.CreateInstance<DevelopmentFirebaseUsers>(serviceProvider);
                serviceProvider.GetRequiredService<ILogger<DevelopmentFirebaseUsers>>().LogWarning(
                    "Firebase:ServiceAccountJson is not configured: DELETE /api/me will not delete Firebase users.");
                return users;
            }

            throw new InvalidOperationException(
                "Falta Firebase:ServiceAccountJson (contenido JSON de la cuenta de servicio de Firebase). "
                + "Es obligatorio fuera de Development para poder comprobar y borrar cuentas (PUT y DELETE /api/me).");
        });

        return services;
    }
}
