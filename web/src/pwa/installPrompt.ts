import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface InstallState {
  /** Chrome/Edge/Android offered an install prompt we can trigger. */
  canPrompt: boolean
  /** The app was installed during this session. */
  installed: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false }
const listeners = new Set<() => void>()
let listening = false

function setState(next: InstallState) {
  state = next
  listeners.forEach((listener) => listener())
}

/** Call once at startup, before React renders. */
export function listenForInstallPrompt(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    setState({ ...state, canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    setState({ canPrompt: false, installed: true })
  })
}

/** Shows the native install dialog. Returns the user's choice, or null if not available. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const prompt = deferredPrompt
  if (!prompt) return null
  await prompt.prompt()
  const choice = await prompt.userChoice
  deferredPrompt = null
  setState({ canPrompt: false, installed: choice.outcome === 'accepted' || state.installed })
  return choice.outcome
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}
