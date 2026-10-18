import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'

/**
 * Full-screen layout for pre-app screens (login, verification, onboarding…). Phones and tablets: brand band
 * on top with the content overlapping it. Desktops: brand panel on the left half, content centered on the right.
 */
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
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="relative overflow-hidden bg-linear-to-b from-brand-700 to-brand-600 pt-safe text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-1/2 lg:items-center lg:justify-center lg:bg-linear-to-br dark:from-brand-900 dark:to-brand-800">
        {/* Soft decorative glow, desktop only. */}
        <div
          className="pointer-events-none absolute -right-32 -bottom-32 hidden size-[28rem] rounded-full bg-brand-400/20 blur-3xl lg:block"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 px-safe pt-8 pb-14 text-center lg:items-start lg:gap-5 lg:px-12 lg:py-0 lg:text-left">
          <Logo className="size-16 drop-shadow-md lg:size-20" />
          <h1 className="text-2xl font-bold tracking-tight lg:text-4xl">{title}</h1>
          {subtitle && <p className="max-w-sm text-brand-50/90 lg:text-lg">{subtitle}</p>}
        </div>
      </div>
      <main
        className="mx-auto -mt-8 flex w-full max-w-md flex-1 flex-col gap-4 px-safe lg:mt-0 lg:justify-center lg:py-12"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
        {footer && <div className="mt-auto pt-4 lg:mt-0">{footer}</div>}
      </main>
    </div>
  )
}
