import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  viewport.addEventListener('resize', callback)
  viewport.addEventListener('scroll', callback)
  return () => {
    viewport.removeEventListener('resize', callback)
    viewport.removeEventListener('scroll', callback)
  }
}

function getSnapshot(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  const inset = window.innerHeight - viewport.height - viewport.offsetTop
  return inset > 40 ? Math.round(inset) : 0
}

/**
 * Height (px) of the on-screen keyboard overlapping the layout viewport (iOS Safari and Android
 * Chrome do not resize fixed elements). Used to lift bottom sheets above the keyboard.
 */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
