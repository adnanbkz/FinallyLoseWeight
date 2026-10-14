import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'

/** Full-screen layout for pre-app screens (login, verification, onboarding…). */
export function GateLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-linear-to-b from-brand-700 to-brand-600 pt-safe text-white dark:from-brand-900 dark:to-brand-800">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-safe pt-8 pb-14 text-center">
          <Logo className="size-16 drop-shadow-md" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="max-w-sm text-brand-50/90">{subtitle}</p>}
        </div>
      </div>
      <main
        className="mx-auto -mt-8 flex w-full max-w-md flex-1 flex-col gap-4 px-safe"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </main>
    </div>
  )
}
