import { Navigate, useParams } from 'react-router'
import { useDay } from '../../api/hooks'
import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { ErrorBlock, Skeleton, StaleDataNotice } from '../../components/ui/States'
import { isValidIsoDate } from '../../lib/dates'
import { useToday } from '../../lib/useToday'
import { CardioCard } from './CardioCard'
import { DateSwitcher } from './DateSwitcher'
import { MealsCard } from './MealsCard'
import { StepsCard } from './StepsCard'
import { SummaryCard } from './SummaryCard'
import { WeightCard } from './WeightCard'

export function TodayScreen() {
  const { date: param } = useParams()
  const today = useToday()
  // Invalid or future dates fall back to today.
  if (param !== undefined && (!isValidIsoDate(param) || param > today)) return <Navigate to="/" replace />
  const date = param ?? today
  return <DayView key={date} date={date} today={today} />
}

function DayView({ date, today }: { date: string; today: string }) {
  const day = useDay(date)
  const isToday = date === today
  return (
    <>
      <ScreenHeader title={isToday ? 'Hoy' : 'Diario'} />
      <ScreenBody>
        <DateSwitcher date={date} today={today} />
        {day.isPending ? (
          <div className={DAY_GRID} role="status" aria-label="Cargando el día">
            <Skeleton className="h-44 md:col-span-2 lg:col-span-3" />
            <Skeleton className="h-28 lg:col-start-3 lg:row-start-2" />
            <Skeleton className="h-64 md:col-span-2 lg:col-start-1 lg:row-span-4 lg:row-start-2" />
            <Skeleton className="h-28 lg:col-start-3 lg:row-start-3" />
            <Skeleton className="h-28 md:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-4" />
          </div>
        ) : day.data === undefined ? (
          <ErrorBlock error={day.error} onRetry={() => void day.refetch()} retrying={day.isFetching} />
        ) : (
          <>
            {/* A failed refetch keeps the cards (and any open sheet) mounted with the last data. */}
            {day.isError && <StaleDataNotice error={day.error} onRetry={() => void day.refetch()} retrying={day.isFetching} />}
            <div className={DAY_GRID}>
              <div className="md:col-span-2 lg:col-span-3">
                <SummaryCard day={day.data} />
              </div>
              <div className="lg:col-start-3 lg:row-start-2">
                <WeightCard date={date} weight={day.data.weight} />
              </div>
              <div className="md:col-span-2 lg:col-start-1 lg:row-span-4 lg:row-start-2">
                <MealsCard date={date} meals={day.data.meals} isToday={isToday} />
              </div>
              <div className="lg:col-start-3 lg:row-start-3">
                <StepsCard date={date} steps={day.data.steps} />
              </div>
              <div className="md:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-4">
                <CardioCard date={date} sessions={day.data.cardio} />
              </div>
            </div>
          </>
        )}
      </ScreenBody>
    </>
  )
}

/**
 * Phones: one column in reading order. Tablets: weight and steps side by side (dense packing pulls steps up
 * next to weight), meals and cardio full width. Desktops: meals on the left two thirds, weight, steps and
 * cardio stacked on the right; the last `1fr` row absorbs the extra height when meals is the taller side.
 */
const DAY_GRID =
  'grid gap-4 md:grid-flow-row-dense md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr] [&>*]:min-w-0 [&>div>section]:h-full'
