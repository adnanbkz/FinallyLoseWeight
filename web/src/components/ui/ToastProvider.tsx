import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toastContext'
import { cn } from './styles'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 shrink-0 text-brand-400" aria-hidden="true" />,
  error: <XCircle className="size-5 shrink-0 text-red-400" aria-hidden="true" />,
  info: <Info className="size-5 shrink-0 text-sky-400" aria-hidden="true" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    ({ message, tone = 'info', duration }: ToastOptions) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, message, tone }])
      const ms = duration ?? (tone === 'error' ? 6000 : 3000)
      if (ms > 0) setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show({ message, tone: 'success' }),
      error: (message) => show({ message, tone: 'error' }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md animate-sheet-in items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg',
              'dark:bg-slate-100 dark:text-slate-900',
            )}
          >
            {ICONS[toast.tone]}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Cerrar aviso"
              className="-mr-2 inline-flex size-9 items-center justify-center rounded-full opacity-70 hover:opacity-100"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
