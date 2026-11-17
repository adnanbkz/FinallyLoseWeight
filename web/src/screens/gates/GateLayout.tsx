import type { ReactNode } from 'react'
import { Activity, Footprints, Scale, Utensils } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'

const FEATURES = [
  { Icon: Scale, title: 'Peso y tendencia', text: 'Tu media de 7 días, sin sustos por un mal día.' },
  { Icon: Utensils, title: 'Comidas y macros', text: 'Calorías que te quedan, de un vistazo.' },
  { Icon: Footprints, title: 'Pasos', text: 'Tu actividad diaria, siempre a mano.' },
  { Icon: Activity, title: 'Cardio', text: 'Calculamos las calorías de cada sesión.' },
]

/**
 * Full-screen layout for pre-app screens (login, verification, onboarding…). Phones and tablets: brand band
 * on top with the content overlapping it. Desktops: brand panel on the left half, content centered on the right.
 * `showcase` adds a short list of what the app does to the desktop panel (login only).
 */
export function GateLayout({
  title,
  subtitle,
  children,
  footer,
  showcase = false,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  showcase?: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="relative isolate overflow-hidden bg-brand-700 pt-safe text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-1/2 lg:items-center lg:justify-center dark:bg-brand-900">
        {/* Mesh of soft light behind the brand. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-brand-500 via-brand-700 to-teal-900 dark:from-brand-700 dark:via-brand-900 dark:to-slate-950" aria-hidden="true" />
        <div className="absolute -top-24 -left-20 -z-10 size-80 rounded-full bg-brand-300/30 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-24 -bottom-32 -z-10 size-[28rem] rounded-full bg-teal-300/20 blur-3xl" aria-hidden="true" />
        <div
          className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 px-safe pt-10 pb-16 text-center lg:max-w-lg lg:items-start lg:gap-5 lg:px-14 lg:py-0 lg:text-left">
          <Logo className="size-16 rounded-[22%] shadow-2xl shadow-black/25 ring-1 ring-white/25 lg:size-20" />
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">{title}</h1>
          {subtitle && <p className="max-w-sm text-white/85 lg:text-lg">{subtitle}</p>}
          {showcase && (
            <ul className="mt-6 hidden w-full grid-cols-2 gap-3 lg:grid">
              {FEATURES.map(({ Icon, title: featureTitle, text }) => (
                <li key={featureTitle} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                  <Icon className="mb-2 size-5 text-brand-100" aria-hidden="true" />
                  <p className="font-semibold">{featureTitle}</p>
                  <p className="mt-0.5 text-sm text-white/75">{text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <main
        className="relative mx-auto -mt-8 flex w-full max-w-md flex-1 flex-col gap-4 px-safe lg:mt-0 lg:justify-center lg:py-12"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
        {footer && <div className="mt-auto pt-4 lg:mt-0">{footer}</div>}
      </main>
    </div>
  )
}
