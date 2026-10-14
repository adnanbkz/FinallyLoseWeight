namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// A fake Firebase user. Every factory call returns a <b>new UID</b>, so tests sharing one
/// <see cref="ApiFactory"/> (one database per test class) never see each other's data.
/// The email decides the invitation: see <see cref="InvitedEmails"/>.
/// </summary>
public sealed record TestUser(string Uid, string? Email)
{
    public const string AliceEmail = "alice@flw.test";
    public const string BobEmail = "bob@flw.test";
    public const string CarolEmail = "carol@flw.test";
    public const string NotInvitedEmail = "mallory@flw.test";

    /// <summary>Emails invited by <see cref="ApiFactory"/>.</summary>
    public static IReadOnlyList<string> InvitedEmails { get; } = [AliceEmail, BobEmail, CarolEmail];

    /// <summary>
    /// Raw <c>Access:AllowedEmails</c> value configured by <see cref="ApiFactory"/>: the invited emails with
    /// odd casing, spaces and an empty item, to exercise the case-insensitive, trimmed matching.
    /// </summary>
    public const string AllowedEmailsSetting = " Alice@FLW.test , bob@flw.test,,CAROL@flw.test ";

    public static TestUser Alice() => WithEmail(AliceEmail);

    public static TestUser Bob() => WithEmail(BobEmail);

    public static TestUser Carol() => WithEmail(CarolEmail);

    /// <summary>A user with a valid token whose email is not in the allowlist.</summary>
    public static TestUser NotInvited() => WithEmail(NotInvitedEmail);

    /// <summary>A user with a new random UID and the given email (may be <c>null</c>: token without email).</summary>
    public static TestUser WithEmail(string? email) => new($"test-{Guid.NewGuid():N}", email);
}
