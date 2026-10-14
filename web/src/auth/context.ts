import { createContext, useContext } from 'react'
import type { Auth, User } from '@firebase/auth'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** Firebase Auth instance (null only in tests). */
  auth: Auth | null
  /** Incremented whenever the current user changes in place (reload, token refresh). */
  version: number
  /** Spanish message when completing a Google redirect sign-in failed. */
  redirectError: string | null
  clearRedirectError: () => void
  /** Reloads the Firebase user and forces a fresh ID token (e.g. after verifying the email). */
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>')
  return value
}

/** Auth instance for screens that run only when Firebase is configured. */
export function useFirebaseAuth(): Auth {
  const { auth } = useAuth()
  if (!auth) throw new Error('Firebase Auth is not initialized')
  return auth
}
