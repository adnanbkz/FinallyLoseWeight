import type { ReactNode } from 'react'
import { cardClass, cn, toneChip, type Tone } from './styles'

export interface CardProps {
  title?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Accessible name for the section when there is no visible title. */
  label?: string
  /** Accent of the icon chip (the metric this card is about). */
  tone?: Tone
}

export function Card({ title, icon, action, children, className, label, tone = 'brand' }: CardProps) {
  return (
    <section className={cn(cardClass, className)} aria-label={label}>
      {(title || action) && (
        <header className="mb-4 flex min-h-10 items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-3 text-base font-bold text-slate-900 dark:text-slate-50">
              {icon && (
                <span
                  className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 [&>svg]:size-[1.15rem]', toneChip[tone])}
                  aria-hidden="true"
                >
                  {icon}
                </span>
              )}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
