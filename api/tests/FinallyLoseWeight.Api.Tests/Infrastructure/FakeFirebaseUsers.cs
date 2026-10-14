using System.Collections.Concurrent;
using FinallyLoseWeight.Api.Firebase;

namespace FinallyLoseWeight.Api.Tests.Infrastructure;

/// <summary>
/// Replaces the Firebase Admin SDK in tests. Every user is active until the API deletes it
/// (<see cref="DeletedUids"/>) or a test disables it (<see cref="Disable"/>).
/// </summary>
public sealed class FakeFirebaseUsers : IFirebaseUsers
{
    private readonly ConcurrentQueue<string> _deletedUids = new();
    private readonly ConcurrentDictionary<string, bool> _disabledUids = new();
    private Exception? _nextFailure;

    /// <summary>UIDs passed to <see cref="DeleteUserAsync"/>, in call order (repeats included).</summary>
    public IReadOnlyCollection<string> DeletedUids => _deletedUids.ToArray();

    /// <summary>Makes the next delete call throw <paramref name="exception"/> once (simulates a Firebase outage).</summary>
    public void FailNextCall(Exception exception) => Volatile.Write(ref _nextFailure, exception);

    /// <summary>Simulates an account disabled in the Firebase console.</summary>
    public void Disable(string uid) => _disabledUids[uid] = true;

    public Task<bool> IsActiveAsync(string uid, CancellationToken cancellationToken) =>
        Task.FromResult(!_deletedUids.Contains(uid) && !_disabledUids.ContainsKey(uid));

    public Task DeleteUserAsync(string uid, CancellationToken cancellationToken)
    {
        if (Interlocked.Exchange(ref _nextFailure, null) is { } failure)
        {
            return Task.FromException(failure);
        }

        _deletedUids.Enqueue(uid);
        return Task.CompletedTask;
    }
}
