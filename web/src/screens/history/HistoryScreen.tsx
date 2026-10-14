import { useNavigate } from 'react-router'
import { ChevronRight, Flame, Footprints, History, Scale } from 'lucide-react'
import { useStats } from '../../api/hooks'
import type { StatsDay } from '../../api/types'
import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { EmptyBlock, ErrorBlock, Skeleton, StaleDataNotice } from '../../components/ui/States'
import { cardClass, cn } from '../../components/ui/styles'
import { formatDayLabel, formatShortDate, formatShortWeekday, rangeEndingAt } from '../../lib/dates'
import { formatNumber } from '../../lib/numbers'
import { dayPath } from '../../lib/paths'
import { useToday } from '../../lib/useToday'

const HISTORY_DAYS = 30
const ROW_GRID = 'grid grid-cols-[4rem_1fr_1fr_1fr_1rem] items-center gap-2'

function hasAnything(day: StatsDay): boolean {
  return day.weightKg !== null || day.kcalIn !== null || day.steps !== null || day.kcalCardioNet > 0
}

export function HistoryScreen() {
  const today = useToday()
  const { from, to } = rangeEndingAt(today, HISTORY_DAYS)
  const stats = useStats(from, to)
  const navigate = useNavigate()

  return (
    <>
      <ScreenHeader title="Historial" />
      <ScreenBody>
        <p className="text-sm text-slate-500 dark:text-slate-400">Últimos {HISTORY_DAYS} días. Toca un día para verlo o editarlo.</p>
        {stats.isError && stats.data !== undefined && (
          <StaleDataNotice error={stats.error} onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
        )}
        {stats.isPending ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Cargando historial">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : stats.data === undefined ? (
          <ErrorBlock error={stats.error} onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
        ) : !stats.data.days.some(hasAnything) ? (
          <div className={cardClass}>
            <EmptyBlock icon={<History className="size-6" />} title="Todavía no hay registros">
              Cuando apuntes tu peso, comidas o pasos, aparecerán aquí día a día.
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn(cardClass, 'p-0')}>
            <div
              className={cn(ROW_GRID, 'border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400')}
              aria-hidden="true"
            >
              <span>Día</span>
              <span className="flex items-center justify-end gap-1">
                <Scale className="size-3.5" /> kg
              </span>
              <span className="flex items-center justify-end gap-1">
                <Flame className="size-3.5" /> kcal
              </span>
              <span className="flex items-center justify-end gap-1">
                <Footprints className="size-3.5" /> pasos
              </span>
              <span />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800" aria-label="Días">
              {[...stats.data.days].reverse().map((day) => {
                const label = formatDayLabel(day.date, today)
                const relative = label === 'Hoy' || label === 'Ayer'
                return (
                  <li key={day.date}>
                    <button
                      type="button"
                      onClick={() => void navigate(dayPath(day.date, today))}
                      className={cn(
                        ROW_GRID,
                        'min-h-14 w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        !hasAnything(day) && 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">
                          {relative ? label : formatShortWeekday(day.date)}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{formatShortDate(day.date)}</span>
                      </span>
                      <Cell label="Peso" value={day.weightKg !== null ? formatNumber(day.weightKg, 1) : null} unit="kg" />
                      <Cell label="Calorías" value={day.kcalIn !== null ? formatNumber(day.kcalIn) : null} unit="kcal" />
                      <Cell label="Pasos" value={day.steps !== null ? formatNumber(day.steps) : null} unit="pasos" />
                      <ChevronRight className="size-4 justify-self-end text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </ScreenBody>
    </>
  )
}

function Cell({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  return (
    <span className="text-right text-sm tabular-nums">
      <span className="sr-only">{label}: </span>
      {value !== null ? (
        <span className="text-slate-800 dark:text-slate-100">
          {value}
          <span className="sr-only"> {unit}</span>
        </span>
      ) : (
        <span className="text-slate-300 dark:text-slate-600" aria-label="sin registro">
          —
        </span>
      )}
    </span>
  )
}
