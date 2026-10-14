import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** Milliseconds; 0 keeps it until dismissed. */
  duration?: number
}

export interface ToastApi {
  show: (options: ToastOptions) => void
  success: (message: string) => void
  error: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

const noop: ToastApi = { show: () => {}, success: () => {}, error: () => {} }

/** Toast API; a no-op outside <ToastProvider> (handy in tests). */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop
}
