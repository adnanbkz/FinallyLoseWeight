/**
 * Google re-authentication via redirect reloads the page. This flag (sessionStorage, 5 min)
 * lets the delete-account sheet resume at its final step after coming back.
 */
const KEY = 'flw.pendingAccountDeletion'
const MAX_AGE_MS = 5 * 60_000

export function markPendingDeletion(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // storage unavailable: the user will just have to start again
  }
}

export function peekPendingDeletion(): boolean {
  try {
    const value = sessionStorage.getItem(KEY)
    return value !== null && Date.now() - Number(value) < MAX_AGE_MS
  } catch {
    return false
  }
}

export function clearPendingDeletion(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
