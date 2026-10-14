import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type User,
  type UserCredential,
} from '@firebase/auth'
import { shouldUseAuthRedirect } from '../lib/platform'
import { authErrorCode } from './authErrors'

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

export function signInWithEmail(auth: Auth, email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

/** Creates the account and sends the verification email (a failed send can be retried later). */
export async function signUpWithEmail(auth: Auth, email: string, password: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  try {
    await sendEmailVerification(credential.user)
  } catch (error) {
    console.warn('No se pudo enviar el email de verificación', authErrorCode(error))
  }
  return credential
}

export function sendVerificationEmail(user: User): Promise<void> {
  return sendEmailVerification(user)
}

export function resetPassword(auth: Auth, email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email.trim())
}

/**
 * Google sign-in: popup on desktop browsers; full-page redirect in the installed PWA and on iOS
 * (and as a fallback when the popup is blocked). Returns 'redirect' when the page will navigate away.
 */
export async function signInWithGoogle(auth: Auth): Promise<'done' | 'redirect'> {
  if (shouldUseAuthRedirect()) {
    await signInWithRedirect(auth, googleProvider())
    return 'redirect'
  }
  try {
    await signInWithPopup(auth, googleProvider())
    return 'done'
  } catch (error) {
    if (authErrorCode(error) === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider())
      return 'redirect'
    }
    throw error
  }
}

let redirectResult: Promise<UserCredential | null> | null = null

/** Completes a pending redirect sign-in/re-auth. Safe to call many times (runs once). */
export function consumeRedirectResult(auth: Auth): Promise<UserCredential | null> {
  redirectResult ??= getRedirectResult(auth)
  return redirectResult
}

export function hasPasswordProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID)
}

export function hasGoogleProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID)
}

export async function reauthenticateWithPassword(user: User, password: string): Promise<void> {
  if (!user.email) throw Object.assign(new Error('Missing email'), { code: 'auth/missing-email' })
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
}

/** Re-authenticates a Google user. Returns 'redirect' when the page will navigate away. */
export async function reauthenticateWithGoogle(user: User): Promise<'done' | 'redirect'> {
  if (shouldUseAuthRedirect()) {
    await reauthenticateWithRedirect(user, googleProvider())
    return 'redirect'
  }
  try {
    await reauthenticateWithPopup(user, googleProvider())
    return 'done'
  } catch (error) {
    if (authErrorCode(error) === 'auth/popup-blocked') {
      await reauthenticateWithRedirect(user, googleProvider())
      return 'redirect'
    }
    throw error
  }
}
