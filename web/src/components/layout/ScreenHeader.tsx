import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '../ui/styles'
import { CONTENT_WIDTH, type ContentWidth } from './navItems'

export interface ScreenHeaderProps {
  title: ReactNode
  /** Short line under the title. */
  subtitle?: ReactNode
  /** Small line above the title (e.g. a greeting). */
  eyebrow?: ReactNode
  /** Shows a back button. A string is the fallback route when there is no history. */
  back?: boolean | string
  actions?: ReactNode
  width?: ContentWidth
}

/**
 * Sticky, translucent page header with a large title. Under the iOS status bar (black-translucent, white
 * text) a brand strip fills the safe area so the clock stays readable; elsewhere the inset is 0.
 */
export function ScreenHeader({ title, subtitle, eyebrow, back, actions, width = 'wide' }: ScreenHeaderProps) {
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
        'sticky top-0 z-30 pt-safe',
        'border-b border-slate-900/[0.06] bg-slate-50/75 backdrop-blur-xl backdrop-saturate-150',
        'dark:border-white/[0.06] dark:bg-slate-950/70',
        "before:absolute before:inset-x-0 before:top-0 before:h-[env(safe-area-inset-top)] before:bg-linear-to-r before:from-brand-700 before:to-brand-600 before:content-['']",
      )}
    >
      <div className={cn('mx-auto flex min-h-16 items-center gap-2 px-safe py-2 md:min-h-20 md:px-8', CONTENT_WIDTH[width])}>
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="-ml-2 inline-flex size-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-7" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="truncate text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-400">{eyebrow}</p>}
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl dark:text-white">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}
