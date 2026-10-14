import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Flame, Footprints, Scale } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { useProfile, useStats } from '../../api/hooks'
import type { StatsDay } from '../../api/types'
import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { Card } from '../../components/ui/Card'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyBlock, ErrorBlock, Skeleton, StaleDataNotice } from '../../components/ui/States'
import { buttonClass, cn } from '../../components/ui/styles'
import { formatShortDate, rangeEndingAt } from '../../lib/dates'
import { formatNumber, formatSigned } from '../../lib/numbers'
import { useToday } from '../../lib/useToday'
import {
  RANGE_OPTIONS,
  bucketFor,
  dayLongLabel,
  niceScale,
  summarize,
  toBars,
  weightDomain,
  type BarPoint,
  type RangeDays,
} from './series'

const AXIS_TICK = { fontSize: 12, fill: 'var(--chart-muted)' }
const CHART_HEIGHT = 220

export default function ProgressScreen() {
  const today = useToday()
  const [range, setRange] = useState<RangeDays>(30)
  const { from, to } = rangeEndingAt(today, range)
  const stats = useStats(from, to)
  const profile = useProfile()
  const target = profile.data?.targetWeightKg ?? null
  const kcalTarget = profile.data?.dailyKcalTarget ?? null

  return (
    <>
      <ScreenHeader title="Progreso" />
      <ScreenBody>
        {/* One filter row above everything it scopes. */}
        <Segmented
          label="Periodo"
          value={String(range) as `${RangeDays}`}
          onChange={(v) => setRange(Number(v) as RangeDays)}
          options={RANGE_OPTIONS}
        />
        {stats.isPending ? (
          <div className="flex flex-col gap-4" role="status" aria-label="Cargando gráficas">
            <Skeleton className="h-24" />
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : stats.data === undefined ? (
          <ErrorBlock error={stats.error} onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
        ) : (
          // Refetch keeps the previous frame at reduced opacity (no skeleton flash).
          <div className={cn('flex flex-col gap-4 transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
            {stats.isError && (
              <StaleDataNotice error={stats.error} onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
            )}
            <Charts days={stats.data.days} range={range} target={target} kcalTarget={kcalTarget} />
          </div>
        )}
      </ScreenBody>
    </>
  )
}

function Charts({
  days,
  range,
  target,
  kcalTarget,
}: {
  days: StatsDay[]
  range: RangeDays
  target: number | null
  kcalTarget: number | null
}) {
  const summary = summarize(days)
  const bucket = bucketFor(range)
  const kcalBars = toBars(days, bucket, (d) => d.kcalIn)
  const stepBars = toBars(days, bucket, (d) => d.steps)
  const bucketNote = bucket === 'day' ? null : bucket === 'week' ? 'Media semanal de los días registrados.' : 'Media mensual de los días registrados.'

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Último peso"
          value={summary.latestWeight ? `${formatNumber(summary.latestWeight.kg, 1)} kg` : '—'}
          detail={summary.latestWeight ? formatShortDate(summary.latestWeight.date) : 'Sin registros'}
        />
        <StatTile
          label="Cambio (media 7 días)"
          value={summary.trendChange !== null ? `${formatSigned(summary.trendChange)} kg` : '—'}
          detail={summary.trendChange !== null ? `en ${range === 365 ? '1 año' : `${range} días`}` : 'Faltan datos'}
        />
        <StatTile label="Media de kcal" value={summary.avgKcal !== null ? formatNumber(summary.avgKcal) : '—'} detail="por día registrado" />
        <StatTile label="Media de pasos" value={summary.avgSteps !== null ? formatNumber(summary.avgSteps) : '—'} detail="por día registrado" />
      </div>

      <Card title="Peso" icon={<Scale className="size-5" />}>
        <WeightChart days={days} range={range} target={target} />
      </Card>

      <Card title="Calorías ingeridas" icon={<Flame className="size-5" />}>
        <BarsChart
          bars={kcalBars}
          unit="kcal"
          reference={kcalTarget}
          referenceLabel="Objetivo"
          empty={
            <EmptyBlock icon={<Flame className="size-6" />} title="Sin comidas en este periodo">
              Apunta lo que comes en Hoy para ver aquí tu evolución.
            </EmptyBlock>
          }
        />
        {bucketNote && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{bucketNote}</p>}
        {kcalTarget === null && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Define tu objetivo diario en{' '}
            <Link to="/perfil" className="font-medium text-brand-700 underline dark:text-brand-400">
              Perfil
            </Link>{' '}
            para verlo como referencia.
          </p>
        )}
      </Card>

      <Card title="Pasos" icon={<Footprints className="size-5" />}>
        <BarsChart
          bars={stepBars}
          unit="pasos"
          empty={
            <EmptyBlock icon={<Footprints className="size-6" />} title="Sin pasos en este periodo">
              Apunta tus pasos diarios en Hoy.
            </EmptyBlock>
          }
        />
        {bucketNote && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{bucketNote}</p>}
      </Card>

      <DataTable days={days} />
    </>
  )
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      {detail && <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  )
}

// ---------- Weight ----------

interface WeightRow {
  date: string
  label: string
  weightKg: number | null
  weightTrendKg: number | null
}

function WeightTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as WeightRow | undefined
  if (!active || !row) return null
  return (
    <TooltipBox title={dayLongLabel(row.date)}>
      <TooltipRow color="var(--chart-series-1)" dot value={row.weightKg !== null ? `${formatNumber(row.weightKg, 2)} kg` : '—'} label="Peso" />
      <TooltipRow
        color="var(--chart-series-2)"
        value={row.weightTrendKg !== null ? `${formatNumber(row.weightTrendKg, 2)} kg` : '—'}
        label="Media 7 días"
      />
    </TooltipBox>
  )
}

function WeightChart({ days, range, target }: { days: StatsDay[]; range: RangeDays; target: number | null }) {
  const domain = weightDomain(days, target)
  if (!domain) {
    return (
      <EmptyBlock
        icon={<Scale className="size-6" />}
        title="Aún no hay pesos en este periodo"
        action={
          <Link to="/" className={buttonClass('secondary', 'sm')}>
            Registrar peso
          </Link>
        }
      >
        Pésate cada mañana y verás aquí tu evolución y tu media de 7 días.
      </EmptyBlock>
    )
  }
  const rows: WeightRow[] = days.map((d) => ({
    date: d.date,
    label: formatShortDate(d.date),
    weightKg: d.weightKg,
    weightTrendKg: d.weightTrendKg,
  }))
  const showDots = range <= 30
  const targetInDomain = target !== null && target >= domain[0] && target <= domain[1]
  const axis = niceScale(domain[0], domain[1], 5)

  return (
    <figure>
      <Legend
        items={[
          { label: 'Peso diario', color: 'var(--chart-series-1)', kind: showDots ? 'dot' : 'line' },
          { label: 'Media 7 días', color: 'var(--chart-series-2)', kind: 'line' },
          ...(targetInDomain ? [{ label: `Objetivo ${formatNumber(target, 1)} kg`, color: 'var(--chart-muted)', kind: 'dashed' as const }] : []),
        ]}
      />
      <div style={{ height: CHART_HEIGHT }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={axis.domain}
              ticks={axis.ticks}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => formatNumber(v, 1)}
            />
            {targetInDomain && <ReferenceLine y={target} stroke="var(--chart-muted)" strokeDasharray="4 4" />}
            <Tooltip content={WeightTooltip} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="weightKg"
              name="Peso"
              stroke={showDots ? 'transparent' : 'var(--chart-series-1)'}
              strokeWidth={2}
              connectNulls
              dot={showDots ? { r: 4, fill: 'var(--chart-series-1)', stroke: 'var(--chart-surface)', strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: 'var(--chart-series-1)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="weightTrendKg"
              name="Media 7 días"
              stroke="var(--chart-series-2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={false}
              activeDot={{ r: 4, fill: 'var(--chart-series-2)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {target !== null && !targetInDomain && (
        <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tu objetivo: {formatNumber(target, 1)} kg.</figcaption>
      )}
    </figure>
  )
}

// ---------- Bars (kcal / steps) ----------

function BarTooltip({ active, payload, unit }: TooltipContentProps & { unit: string }) {
  const point = payload?.[0]?.payload as BarPoint | undefined
  if (!active || !point) return null
  return (
    <TooltipBox title={point.longLabel}>
      <TooltipRow color="var(--chart-series-1)" value={point.value !== null ? `${formatNumber(point.value)} ${unit}` : 'Sin registro'} />
      {point.loggedDays > 1 && <p className="text-xs text-slate-500 dark:text-slate-400">Media de {point.loggedDays} días</p>}
    </TooltipBox>
  )
}

function BarsChart({
  bars,
  unit,
  reference,
  referenceLabel,
  empty,
}: {
  bars: BarPoint[]
  unit: string
  reference?: number | null
  referenceLabel?: string
  empty: ReactNode
}) {
  if (!bars.some((b) => b.value !== null)) return <>{empty}</>
  const maxValue = Math.max(0, reference ?? 0, ...bars.map((b) => b.value ?? 0))
  const axis = niceScale(0, maxValue, 6)

  return (
    <figure>
      {reference != null && (
        <Legend items={[{ label: `${referenceLabel ?? 'Referencia'} ${formatNumber(reference)} ${unit}`, color: 'var(--chart-muted)', kind: 'dashed' }]} />
      )}
    <div style={{ height: CHART_HEIGHT }} className={reference != null ? 'mt-2' : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip content={(props) => <BarTooltip {...props} unit={unit} />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }} isAnimationActive={false} />
          <Bar dataKey="value" name={unit} fill="var(--chart-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          {reference != null && <ReferenceLine y={reference} stroke="var(--chart-muted)" strokeDasharray="4 4" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
    </figure>
  )
}

// ---------- Shared bits ----------

function Legend({ items }: { items: Array<{ label: string; color: string; kind: 'dot' | 'line' | 'dashed' }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300" aria-label="Leyenda">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          {item.kind === 'dot' ? (
            <span className="size-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          ) : item.kind === 'dashed' ? (
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: item.color }} aria-hidden="true" />
          ) : (
            <span className="h-0.5 w-4 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function TooltipRow({ color, value, label, dot }: { color: string; value: string; label?: string; dot?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      {dot ? (
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      ) : (
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden="true" />
      )}
      <strong className="font-semibold text-slate-900 dark:text-slate-50">{value}</strong>
      {label && <span className="text-slate-500 dark:text-slate-400">{label}</span>}
    </p>
  )
}

/** Table twin of the charts (accessible, no hover needed). */
function DataTable({ days }: { days: StatsDay[] }) {
  const rows = [...days].reverse()
  return (
    <details className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <summary className="min-h-12 cursor-pointer content-center px-4 font-medium text-slate-700 dark:text-slate-200">
        Ver los datos en una tabla
      </summary>
      <div className="max-h-96 overflow-auto px-2 pb-3">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-white text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-2 py-2 font-medium">Día</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Peso</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Media 7 d</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Kcal</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Pasos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-600 dark:text-slate-300">
                  {formatShortDate(d.date)}
                </th>
                <td className="px-2 py-1.5 text-right">{d.weightKg !== null ? formatNumber(d.weightKg, 2) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{d.weightTrendKg !== null ? formatNumber(d.weightTrendKg, 2) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{d.kcalIn !== null ? formatNumber(d.kcalIn) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{d.steps !== null ? formatNumber(d.steps) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
