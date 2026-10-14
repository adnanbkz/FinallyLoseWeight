import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

export interface ScreenHeaderProps {
  title: ReactNode
  /** Shows a back button. A string is the fallback route when there is no history. */
  back?: boolean | string
  actions?: ReactNode
}

/** Sticky brand-colored app bar; extends under the iOS status bar (black-translucent). */
export function ScreenHeader({ title, back, actions }: ScreenHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    const fallback = typeof back === 'string' ? back : '/'
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) void navigate(-1)
    else void navigate(fallback, { replace: true })
  }
  return (
    <header className="sticky top-0 z-30 bg-brand-700 pt-safe text-white shadow-sm dark:bg-brand-900">
      <div className="mx-auto flex min-h-14 max-w-lg items-center gap-1 px-safe">
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-white"
          >
            <ChevronLeft className="size-7" aria-hidden="true" />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}
