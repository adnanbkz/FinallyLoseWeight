import type { ReactNode } from 'react'
import { cardClass, cn } from './styles'

export interface CardProps {
  title?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Accessible name for the section when there is no visible title. */
  label?: string
}

export function Card({ title, icon, action, children, className, label }: CardProps) {
  return (
    <section className={cn(cardClass, className)} aria-label={label}>
      {(title || action) && (
        <header className="mb-3 flex min-h-8 items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
              {icon && (
                <span className="text-brand-600 dark:text-brand-400" aria-hidden="true">
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
