import { getApp, getApps, initializeApp } from '@firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from '@firebase/auth'
import type { FirebaseWebConfig } from '../config'

let authInstance: Auth | null = null

/**
 * Firebase is used ONLY for authentication (ID tokens). All data goes through our API.
 * Persistence: IndexedDB first, localStorage as fallback (keeps the session in the installed PWA).
 */
export function initFirebaseAuth(config: FirebaseWebConfig): Auth {
  if (authInstance) return authInstance
  const app = getApps().length > 0 ? getApp() : initializeApp(config)
  try {
    authInstance = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    // Already initialized (e.g. during hot reload).
    authInstance = getAuth(app)
  }
  authInstance.languageCode = 'es'
  return authInstance
}
