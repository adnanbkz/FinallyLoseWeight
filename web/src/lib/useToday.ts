import { useSyncExternalStore } from 'react'
import { msUntilNextLocalMidnight, todayIso } from './dates'

function subscribe(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>
  const schedule = () => {
    timer = setTimeout(() => {
      callback()
      schedule()
    }, msUntilNextLocalMidnight())
  }
  schedule()
  // Phones suspend timers in the background: re-check when the app comes back.
  document.addEventListener('visibilitychange', callback)
  window.addEventListener('focus', callback)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', callback)
    window.removeEventListener('focus', callback)
  }
}

/** Today's local date ("YYYY-MM-DD"); re-renders when the day changes. */
export function useToday(): string {
  return useSyncExternalStore(subscribe, todayIso, todayIso)
}
