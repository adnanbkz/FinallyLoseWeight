import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onIdTokenChanged, signOut as firebaseSignOut, type Auth, type User } from '@firebase/auth'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from './context'
import { consumeRedirectResult } from './actions'
import { authErrorMessage, isAuthCancellation } from './authErrors'

interface SessionState {
  ready: boolean
  user: User | null
  version: number
}

const REDIRECT_RESULT_TIMEOUT_MS = 10_000

export function AuthProvider({ auth, children }: { auth: Auth; children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<SessionState>({ ready: false, user: null, version: 0 })
  const [redirect, setRedirect] = useState<{ pending: boolean; error: string | null }>({
    pending: true,
    error: null,
  })
  const lastUid = useRef<string | null | undefined>(undefined)

  // onIdTokenChanged also fires on token refreshes, so `emailVerified` changes are picked up.
  useEffect(
    () =>
      onIdTokenChanged(auth, (user) => {
        const uid = user?.uid ?? null
        // Never show one user's cached health data to another user.
        if (lastUid.current !== undefined && lastUid.current !== uid) queryClient.clear()
        lastUid.current = uid
        setSession((prev) => ({ ready: true, user, version: prev.version + 1 }))
      }),
    [auth, queryClient],
  )

  // Completes a Google sign-in/re-auth that used signInWithRedirect (installed PWA / iOS).
  useEffect(() => {
    let active = true
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), REDIRECT_RESULT_TIMEOUT_MS))
    Promise.race([consumeRedirectResult(auth), timeout]).then(
      () => {
        if (active) setRedirect((prev) => ({ ...prev, pending: false }))
      },
      (error: unknown) => {
        if (active) setRedirect({ pending: false, error: isAuthCancellation(error) ? null : authErrorMessage(error) })
      },
    )
    return () => {
      active = false
    }
  }, [auth])

  const clearRedirectError = useCallback(() => setRedirect((prev) => ({ ...prev, error: null })), [])

  const refreshUser = useCallback(async () => {
    const current = auth.currentUser
    if (!current) return
    await current.reload()
    await current.getIdToken(true)
    setSession((prev) => ({ ...prev, user: auth.currentUser, version: prev.version + 1 }))
  }, [auth])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    queryClient.clear()
  }, [auth, queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const status = !session.ready || redirect.pending ? 'loading' : session.user ? 'signedIn' : 'signedOut'
    return {
      status,
      user: session.user,
      auth,
      version: session.version,
      redirectError: redirect.error,
      clearRedirectError,
      refreshUser,
      signOut,
    }
  }, [session, redirect, auth, clearRedirectError, refreshUser, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
