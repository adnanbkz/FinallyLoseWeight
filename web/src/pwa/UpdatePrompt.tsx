import { RefreshCw, Sparkles } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../components/ui/Button'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000

/** Registers the service worker and shows a "nueva versión disponible" toast when an update is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => undefined)
      }
      setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      // Installed PWAs are resumed rather than reloaded: check when coming back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
    onRegisterError(error) {
      console.error('No se pudo registrar el service worker', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-md animate-sheet-in items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
      >
        <Sparkles className="size-5 shrink-0 text-brand-400 dark:text-brand-600" aria-hidden="true" />
        <p className="flex-1 text-sm font-medium">Nueva versión disponible</p>
        <Button variant="ghostInverse" size="sm" onClick={() => setNeedRefresh(false)}>
          Luego
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
          Actualizar
        </Button>
      </div>
    </div>
  )
}
