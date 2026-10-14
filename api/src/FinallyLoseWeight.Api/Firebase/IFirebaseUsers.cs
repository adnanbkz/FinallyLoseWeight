namespace FinallyLoseWeight.Api.Firebase;

/// <summary>Firebase Authentication users, through the Admin SDK.</summary>
public interface IFirebaseUsers
{
    /// <summary>
    /// <c>true</c> when the user still exists and is not disabled. ID tokens stay valid for up to an hour
    /// after the account is deleted or disabled, so this is checked before creating a profile
    /// (<c>PUT /api/me</c>): otherwise a leftover token could recreate data nobody can erase any more.
    /// </summary>
    Task<bool> IsActiveAsync(string uid, CancellationToken cancellationToken);

    /// <summary>Deletes the user (last step of <c>DELETE /api/me</c>). Must succeed (not throw) when the
    /// user no longer exists, so the account deletion stays idempotent.</summary>
    Task DeleteUserAsync(string uid, CancellationToken cancellationToken);
}
