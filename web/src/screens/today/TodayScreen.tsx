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
          <div className="flex flex-col gap-4" role="status" aria-label="Cargando el día">
            <Skeleton className="h-44" />
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
            <Skeleton className="h-28" />
          </div>
        ) : day.data === undefined ? (
          <ErrorBlock error={day.error} onRetry={() => void day.refetch()} retrying={day.isFetching} />
        ) : (
          <>
            {/* A failed refetch keeps the cards (and any open sheet) mounted with the last data. */}
            {day.isError && <StaleDataNotice error={day.error} onRetry={() => void day.refetch()} retrying={day.isFetching} />}
            <SummaryCard day={day.data} />
            <WeightCard date={date} weight={day.data.weight} />
            <MealsCard date={date} meals={day.data.meals} isToday={isToday} />
            <StepsCard date={date} steps={day.data.steps} />
            <CardioCard date={date} sessions={day.data.cardio} />
          </>
        )}
      </ScreenBody>
    </>
  )
}
