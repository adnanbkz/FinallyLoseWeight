import { useNavigate } from 'react-router'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatDayLabel, formatLongDate, isValidIsoDate } from '../../lib/dates'
import { Button } from '../../components/ui/Button'
import { cn, surfaceClass } from '../../components/ui/styles'
import { dayPath } from '../../lib/paths'

/** Previous / next day (never beyond today), native date picker and "Hoy". */
export function DateSwitcher({ date, today }: { date: string; today: string }) {
  const navigate = useNavigate()
  const go = (target: string) => {
    if (!isValidIsoDate(target) || target > today) return
    void navigate(dayPath(target, today), { replace: true })
  }
  const isToday = date === today
  const label = formatDayLabel(date, today)
  const showLong = label === 'Hoy' || label === 'Ayer'

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <div className={cn('flex items-center gap-1 rounded-full p-1 md:w-96', surfaceClass)}>
        <Button variant="ghost" size="icon" aria-label="Día anterior" onClick={() => go(addDays(date, -1))}>
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Button>
        <label className="relative flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center rounded-full px-2 text-center transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/5">
          <span className="flex items-center gap-1.5 font-bold text-slate-900 capitalize dark:text-slate-50">
            <CalendarDays className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {label}
          </span>
          {showLong && <span className="text-xs text-slate-500 dark:text-slate-400">{formatLongDate(date)}</span>}
          <input
            type="date"
            aria-label="Elegir fecha"
            value={date}
            max={today}
            onChange={(e) => go(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker()
              } catch {
                // not supported: the native control still opens on tap
              }
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Día siguiente"
          disabled={isToday}
          onClick={() => go(addDays(date, 1))}
          className={cn(isToday && 'invisible')}
        >
          <ChevronRight className="size-6" aria-hidden="true" />
        </Button>
      </div>
      {!isToday && (
        <Button variant="secondary" size="sm" className="self-center md:self-auto" onClick={() => go(today)}>
          Volver a hoy
        </Button>
      )}
    </div>
  )
}
