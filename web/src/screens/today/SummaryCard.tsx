import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Flame } from 'lucide-react'
import type { DaySummary } from '../../api/types'
import { cn } from '../../components/ui/styles'
import { formatNumber } from '../../lib/numbers'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 ring-inset backdrop-blur-sm">
      <span className="truncate text-xs font-medium text-white/80">{label}</span>
      <span className="text-lg font-bold tabular-nums md:text-xl">{value}</span>
    </div>
  )
}

const MACROS = [
  { key: 'proteinG', label: 'Proteína', kcalPerGram: 4, color: 'bg-sky-300' },
  { key: 'carbsG', label: 'Hidratos', kcalPerGram: 4, color: 'bg-amber-300' },
  { key: 'fatG', label: 'Grasa', kcalPerGram: 9, color: 'bg-rose-300' },
] as const

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2.5 rounded-full ring-2 ring-white/20', color)} aria-hidden="true" />
      <span className="text-sm text-white/80">
        {label} <strong className="font-bold tabular-nums text-white">{formatNumber(grams, 0)} g</strong>
      </span>
    </div>
  )
}

/** Circular gauge: kcal eaten against the kcal available today. */
function Ring({ ratio, over, children, progress }: { ratio: number; over: boolean; children: ReactNode; progress?: object }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-32 shrink-0 md:size-40" {...progress}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/15" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', over ? 'text-amber-300' : 'text-white', ratio === 0 && 'opacity-0')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Daily balance: kcal eaten vs target, plus net cardio kcal (net is what counts in the balance). */
export function SummaryCard({ day }: { day: DaySummary }) {
  const { totals, dailyKcalTarget: target } = day
  const kcalIn = Math.round(totals.kcalIn)
  const cardioNet = Math.round(totals.kcalCardioNet)
  const budget = target !== null ? target + cardioNet : null
  const remaining = budget !== null ? budget - kcalIn : null
  const ratio = budget && budget > 0 ? Math.min(1, kcalIn / budget) : 0
  const over = remaining !== null && remaining < 0
  const hasMacros = totals.proteinG > 0 || totals.carbsG > 0 || totals.fatG > 0
  const macroKcal = MACROS.map((m) => totals[m.key] * m.kcalPerGram)
  const macroTotal = macroKcal.reduce((a, b) => a + b, 0)

  const progress =
    budget !== null
      ? {
          role: 'progressbar',
          'aria-label': 'Calorías ingeridas respecto a las disponibles',
          'aria-valuemin': 0,
          'aria-valuemax': Math.max(budget, 0),
          'aria-valuenow': kcalIn,
          'aria-valuetext': `${formatNumber(kcalIn)} de ${formatNumber(budget)} kcal`,
        }
      : undefined

  return (
    <section
      aria-label="Balance del día"
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] p-5 text-white shadow-glow md:p-7',
        'bg-linear-to-br from-brand-600 via-brand-700 to-teal-800 dark:from-brand-700 dark:via-brand-800 dark:to-teal-950 dark:shadow-none',
      )}
    >
      {/* Decorative light. */}
      <div className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 -z-10 size-64 rounded-full bg-teal-300/20 blur-3xl" aria-hidden="true" />

      <h2 className="flex items-center gap-2 text-sm font-semibold text-white/85">
        <Flame className="size-4" aria-hidden="true" />
        Balance del día
      </h2>

      <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
      <div className="mt-4 flex items-center gap-5 md:gap-8">
        <Ring ratio={ratio} over={over} progress={progress}>
          <span className="text-3xl leading-none font-extrabold tracking-tight tabular-nums md:text-4xl">{formatNumber(kcalIn)}</span>
          <span className="mt-1 text-xs font-medium text-white/75">kcal ingeridas</span>
        </Ring>

        <div className="min-w-0 flex-1">
          {remaining !== null ? (
            <p className="text-sm font-medium text-white/80">
              {over ? 'Te has pasado' : 'Te quedan'}
              <br />
              <span className={cn('text-4xl leading-tight font-extrabold tracking-tight tabular-nums md:text-5xl', over ? 'text-amber-200' : 'text-white')}>
                {formatNumber(over ? -remaining : remaining)}
                <span className="ml-1 text-xl font-bold tracking-normal md:text-2xl"> kcal</span>
              </span>
            </p>
          ) : (
            <p className="text-sm text-white/85">
              <Link to="/perfil" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Define tu objetivo diario
              </Link>{' '}
              para ver cuánto te queda.
            </p>
          )}
          <p className="mt-1 text-xs text-white/75">Disponibles = objetivo + cardio neto.</p>
        </div>
      </div>

      <div>
      <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3 lg:mt-4">
        <Stat label="Objetivo" value={target !== null ? formatNumber(target) : '—'} />
        <Stat label="Cardio neto" value={cardioNet > 0 ? `+${formatNumber(cardioNet)}` : '0'} />
        <Stat label="Disponibles" value={budget !== null ? formatNumber(budget) : '—'} />
      </div>

      {hasMacros && (
        <div className="mt-5">
          {macroTotal > 0 && (
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              {MACROS.map((m, i) => (
                <div key={m.key} className={cn('h-full first:rounded-l-full last:rounded-r-full', m.color)} style={{ width: `${(macroKcal[i]! / macroTotal) * 100}%` }} />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {MACROS.map((m) => (
              <Macro key={m.key} label={m.label} grams={totals[m.key]} color={m.color} />
            ))}
          </div>
        </div>
      )}
      </div>
      </div>
    </section>
  )
}
