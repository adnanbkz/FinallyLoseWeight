import { useState } from 'react'
import { Activity, ChevronRight, Plus } from 'lucide-react'
import type { Cardio, Machine } from '../../api/types'
import { CARDIO_FIELD_KEYS } from '../../api/types'
import { useMachines } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyBlock } from '../../components/ui/States'
import { CARDIO_FIELD_FALLBACK } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import { CardioSheet } from './CardioSheet'

/** "30 min · 4,8 km/h · 12 %" using the machine descriptor's units when available. */
function sessionDetails(session: Cardio, machine: Machine | undefined): string {
  const keys = machine ? machine.fields.map((f) => f.key) : CARDIO_FIELD_KEYS
  const parts: string[] = []
  for (const key of keys) {
    const value = session[key]
    if (value === null) continue
    const unit = machine?.fields.find((f) => f.key === key)?.unit ?? CARDIO_FIELD_FALLBACK[key].unit
    parts.push(`${formatNumber(value, 1)} ${unit}`)
  }
  return parts.join(' · ')
}

type Editing = { session: Cardio | null } | null

export function CardioCard({ date, sessions }: { date: string; sessions: Cardio[] }) {
  const machines = useMachines()
  const [editing, setEditing] = useState<Editing>(null)
  const totalNet = sessions.reduce((sum, s) => sum + s.kcalNet, 0)

  return (
    <Card
      title="Cardio"
      icon={<Activity />}
      tone="cardio"
      action={
        <Button size="sm" variant="secondary" onClick={() => setEditing({ session: null })} icon={<Plus className="size-4" aria-hidden="true" />}>
          Añadir
        </Button>
      }
    >
      {sessions.length === 0 ? (
        <EmptyBlock icon={<Activity className="size-6" />} title="Sin cardio este día" className="py-3">
          Registra una sesión de cinta y calcularemos las calorías por ti.
        </EmptyBlock>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ session })}
                  className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{session.machineName}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {sessionDetails(session, machines.data?.find((m) => m.id === session.machine))}
                    </span>
                    {session.note && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{session.note}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums text-rose-600 dark:text-rose-300">
                      {formatNumber(session.kcalNet)} kcal
                    </span>
                    <span className="block text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatNumber(session.kcalGross)} brutas
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            Total neto: <strong className="font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(totalNet)} kcal</strong>
          </p>
        </>
      )}
      {editing && <CardioSheet date={date} session={editing.session} onClose={() => setEditing(null)} />}
    </Card>
  )
}
