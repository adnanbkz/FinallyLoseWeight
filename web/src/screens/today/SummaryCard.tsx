import { Link } from 'react-router'
import { Flame } from 'lucide-react'
import type { DaySummary } from '../../api/types'
import { Card } from '../../components/ui/Card'
import { cn } from '../../components/ui/styles'
import { formatNumber } from '../../lib/numbers'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-slate-50/80 px-2 py-2 text-center ring-1 ring-slate-100 md:py-3 dark:bg-slate-800/60 dark:ring-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={cn(
          'text-base font-semibold tabular-nums md:text-lg',
          tone === 'good' && 'text-brand-700 dark:text-brand-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2.5 rounded-full', color)} aria-hidden="true" />
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {label} <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(grams, 0)} g</strong>
      </span>
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

  return (
    <Card
      title="Balance del día"
      icon={<Flame className="size-5" />}
      className="bg-linear-to-br from-white via-white to-brand-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/60"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 md:text-4xl dark:text-slate-50">
            {formatNumber(kcalIn)}
            <span className="ml-1 text-base font-medium tracking-normal text-slate-500 dark:text-slate-400">kcal ingeridas</span>
          </p>
        </div>
        {remaining !== null && (
          <p className={cn('text-right text-sm font-medium', over ? 'text-red-600 dark:text-red-400' : 'text-brand-700 dark:text-brand-400')}>
            {over ? (
              <>
                Te has pasado
                <br />
                <span className="text-lg font-bold tabular-nums">{formatNumber(-remaining)} kcal</span>
              </>
            ) : (
              <>
                Te quedan
                <br />
                <span className="text-lg font-bold tabular-nums">{formatNumber(remaining)} kcal</span>
              </>
            )}
          </p>
        )}
      </div>

      {budget !== null && (
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-label="Calorías ingeridas respecto a las disponibles"
          aria-valuemin={0}
          aria-valuemax={Math.max(budget, 0)}
          aria-valuenow={kcalIn}
          aria-valuetext={`${formatNumber(kcalIn)} de ${formatNumber(budget)} kcal`}
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', over ? 'bg-red-500' : 'bg-brand-500')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Objetivo" value={target !== null ? formatNumber(target) : '—'} />
        <Stat label="Cardio neto" value={cardioNet > 0 ? `+${formatNumber(cardioNet)}` : '0'} tone={cardioNet > 0 ? 'good' : undefined} />
        <Stat label="Disponibles" value={budget !== null ? formatNumber(budget) : '—'} />
      </div>

      {target === null && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/perfil" className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400">
            Define tu objetivo diario
          </Link>{' '}
          para ver cuánto te queda.
        </p>
      )}

      {hasMacros && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Macro label="Proteína" grams={totals.proteinG} color="bg-sky-500" />
          <Macro label="Hidratos" grams={totals.carbsG} color="bg-amber-500" />
          <Macro label="Grasa" grams={totals.fatG} color="bg-rose-500" />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Disponibles = objetivo + cardio neto.</p>
    </Card>
  )
}
