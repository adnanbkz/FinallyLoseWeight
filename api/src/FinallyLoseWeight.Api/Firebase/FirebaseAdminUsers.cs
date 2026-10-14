using FirebaseAdmin;
using FirebaseAdmin.Auth;

namespace FinallyLoseWeight.Api.Firebase;

/// <summary>Firebase Admin SDK implementation. Owns a named <see cref="FirebaseApp"/>.</summary>
public sealed class FirebaseAdminUsers(FirebaseApp app) : IFirebaseUsers, IDisposable
{
    private readonly FirebaseAuth _auth = FirebaseAuth.GetAuth(app);

    public async Task<bool> IsActiveAsync(string uid, CancellationToken cancellationToken)
    {
        try
        {
            var user = await _auth.GetUserAsync(uid, cancellationToken);
            return !user.Disabled;
        }
        catch (FirebaseAuthException exception) when (exception.AuthErrorCode == AuthErrorCode.UserNotFound)
        {
            return false;
        }
    }

    public async Task DeleteUserAsync(string uid, CancellationToken cancellationToken)
    {
        try
        {
            await _auth.DeleteUserAsync(uid, cancellationToken);
        }
        catch (FirebaseAuthException exception) when (exception.AuthErrorCode == AuthErrorCode.UserNotFound)
        {
            // Already deleted (e.g. a retried request): deletion is idempotent.
        }
    }

    public void Dispose() => app.Delete();
}

/// <summary>Development-only stand-in used when no service account is configured.</summary>
public sealed class DevelopmentFirebaseUsers(ILogger<DevelopmentFirebaseUsers> logger) : IFirebaseUsers
{
    public Task<bool> IsActiveAsync(string uid, CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "Firebase:ServiceAccountJson is not configured: the Firebase user was NOT checked (Development only).");
        return Task.FromResult(true);
    }

    public Task DeleteUserAsync(string uid, CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "Firebase:ServiceAccountJson is not configured: the Firebase user was NOT deleted (Development only).");
        return Task.CompletedTask;
    }
}
