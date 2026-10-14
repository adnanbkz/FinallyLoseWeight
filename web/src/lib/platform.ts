interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

/** True when running as an installed PWA (Android/desktop display-mode or iOS home-screen app). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as NavigatorWithStandalone
  if (nav.standalone === true) return true
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
}

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/**
 * Popups are unreliable in installed PWAs and on iOS (they open a separate browser context),
 * so in those cases Google sign-in uses a full-page redirect instead.
 */
export function shouldUseAuthRedirect(): boolean {
  return isStandalone() || isIOS()
}
