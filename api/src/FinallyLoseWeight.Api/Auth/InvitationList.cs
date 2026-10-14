using FinallyLoseWeight.Api.Configuration;
using Microsoft.Extensions.Options;

namespace FinallyLoseWeight.Api.Auth;

/// <summary>Invite-only access: the emails listed in <c>Access:AllowedEmails</c>.</summary>
public sealed class InvitationList(IOptionsMonitor<AccessSettings> settings)
{
    /// <summary>
    /// Case-insensitive and whitespace-tolerant match against the allowlist.
    /// An empty allowlist invites nobody (fail closed).
    /// </summary>
    public bool IsInvited(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        var normalized = email.Trim();
        return SettingsList.Parse(settings.CurrentValue.AllowedEmails)
            .Any(allowed => string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));
    }

    public bool IsEmpty => SettingsList.Parse(settings.CurrentValue.AllowedEmails).Count == 0;
}
