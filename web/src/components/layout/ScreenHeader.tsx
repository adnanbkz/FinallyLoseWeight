import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '../ui/styles'
import { CONTENT_WIDTH, type ContentWidth } from './navItems'

export interface ScreenHeaderProps {
  title: ReactNode
  /** Short line under the title on tablets / desktops (hidden on phones to keep the app bar compact). */
  subtitle?: ReactNode
  /** Shows a back button. A string is the fallback route when there is no history. */
  back?: boolean | string
  actions?: ReactNode
  width?: ContentWidth
}

/**
 * Sticky app bar. On phones it is brand-colored and extends under the iOS status bar (black-translucent);
 * from `md` it becomes a light, translucent page header aligned with the content column.
 */
export function ScreenHeader({ title, subtitle, back, actions, width = 'wide' }: ScreenHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    const fallback = typeof back === 'string' ? back : '/'
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) void navigate(-1)
    else void navigate(fallback, { replace: true })
  }
  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-brand-700 pt-safe text-white shadow-sm dark:bg-brand-900',
        'md:border-b md:border-slate-200/80 md:bg-slate-50/85 md:text-slate-900 md:shadow-none md:backdrop-blur-md',
        'md:dark:border-slate-800 md:dark:bg-slate-950/85 md:dark:text-slate-50',
      )}
    >
      <div className={cn('mx-auto flex min-h-14 items-center gap-1 px-safe md:min-h-18 md:gap-2 md:px-8', CONTENT_WIDTH[width])}>
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className={cn(
              '-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-white',
              'md:hover:bg-slate-200/70 md:focus-visible:outline-brand-500 md:dark:hover:bg-slate-800',
            )}
          >
            <ChevronLeft className="size-7" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold md:text-2xl md:font-bold md:tracking-tight">{title}</h1>
          {subtitle && <p className="hidden truncate text-sm text-slate-500 md:block dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}
