import type { StatsDay } from '../../api/types'
import { addDays, formatShortDate, parseIsoDate } from '../../lib/dates'

export type RangeDays = 30 | 90 | 365
export const RANGE_OPTIONS: ReadonlyArray<{ value: `${RangeDays}`; label: string }> = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
]

export interface BarPoint {
  key: string
  /** Axis label. */
  label: string
  /** Tooltip / table label. */
  longLabel: string
  /** Mean of the logged days in the bucket (null when nothing was logged). */
  value: number | null
  loggedDays: number
}

export type Bucket = 'day' | 'week' | 'month'

export function bucketFor(range: RangeDays): Bucket {
  return range <= 30 ? 'day' : range <= 90 ? 'week' : 'month'
}

const monthShort = new Intl.DateTimeFormat('es-ES', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const weekdayDay = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

const clean = (s: string) => s.replace(/\./g, '')

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const day = parseIsoDate(date).getDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

export function dayLongLabel(date: string): string {
  return clean(weekdayDay.format(parseIsoDate(date)))
}

/**
 * Groups daily values into days, ISO weeks or months; each bucket is the mean of its logged days.
 * Monthly labels get a 2-digit year when the buckets span two years ("oct 25" … "oct 26"), so the
 * partial first and last months of the 1-year view are not both just "oct".
 */
export function toBars(days: StatsDay[], bucket: Bucket, pick: (day: StatsDay) => number | null): BarPoint[] {
  const groups = new Map<string, { first: string; sum: number; count: number }>()
  for (const day of days) {
    const key = bucket === 'day' ? day.date : bucket === 'week' ? weekStart(day.date) : day.date.slice(0, 7)
    const group = groups.get(key) ?? { first: day.date, sum: 0, count: 0 }
    const value = pick(day)
    if (value !== null) {
      group.sum += value
      group.count += 1
    }
    groups.set(key, group)
  }
  const years = new Set(Array.from(groups.keys(), (key) => key.slice(0, 4)))
  const withYear = bucket === 'month' && years.size > 1
  return Array.from(groups.entries()).map(([key, g]) => {
    const value = g.count > 0 ? g.sum / g.count : null
    if (bucket === 'day') return { key, label: formatShortDate(key), longLabel: dayLongLabel(key), value, loggedDays: g.count }
    if (bucket === 'week')
      return { key, label: formatShortDate(key), longLabel: `Semana del ${formatShortDate(key)}`, value, loggedDays: g.count }
    const monthDate = parseIsoDate(`${key}-01`)
    const long = monthLong.format(monthDate)
    const month = clean(monthShort.format(monthDate))
    return {
      key,
      label: withYear ? `${month} ${key.slice(2, 4)}` : month,
      longLabel: long.charAt(0).toUpperCase() + long.slice(1),
      value,
      loggedDays: g.count,
    }
  })
}

export interface ProgressSummary {
  latestWeight: { date: string; kg: number } | null
  latestTrend: number | null
  /** Change of the 7-day trend across the range (last − first). */
  trendChange: number | null
  avgKcal: number | null
  avgSteps: number | null
  avgCardioNet: number | null
  daysWithWeight: number
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function summarize(days: StatsDay[]): ProgressSummary {
  let latestWeight: ProgressSummary['latestWeight'] = null
  let firstTrend: number | null = null
  let lastTrend: number | null = null
  const kcal: number[] = []
  const steps: number[] = []
  const cardio: number[] = []
  let daysWithWeight = 0
  for (const day of days) {
    if (day.weightKg !== null) {
      latestWeight = { date: day.date, kg: day.weightKg }
      daysWithWeight += 1
    }
    if (day.weightTrendKg !== null) {
      firstTrend ??= day.weightTrendKg
      lastTrend = day.weightTrendKg
    }
    if (day.kcalIn !== null) kcal.push(day.kcalIn)
    if (day.steps !== null) steps.push(day.steps)
    if (day.kcalIn !== null || day.kcalCardioNet > 0) cardio.push(day.kcalCardioNet)
  }
  return {
    latestWeight,
    latestTrend: lastTrend,
    trendChange: firstTrend !== null && lastTrend !== null && daysWithWeight > 1 ? lastTrend - firstTrend : null,
    avgKcal: mean(kcal),
    avgSteps: mean(steps),
    avgCardioNet: mean(cardio),
    daysWithWeight,
  }
}

/** Y domain for the weight chart: data ± padding, including the target only when it is close. */
export function weightDomain(days: StatsDay[], target: number | null): [number, number] | null {
  const values: number[] = []
  for (const d of days) {
    if (d.weightKg !== null) values.push(d.weightKg)
    if (d.weightTrendKg !== null) values.push(d.weightTrendKg)
  }
  if (values.length === 0) return null
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (target !== null && target >= min - 8 && target <= max + 8) {
    min = Math.min(min, target)
    max = Math.max(max, target)
  }
  return [Math.floor(min - 0.5), Math.ceil(max + 0.5)]
}

/** "Nice" axis: round step (1, 2, 2.5, 5 × 10^n) with at most ~`maxTicks` ticks covering [min, max]. */
export function niceScale(min: number, max: number, maxTicks = 5): { domain: [number, number]; ticks: number[] } {
  let lo = min
  let hi = max
  if (!(hi > lo)) {
    lo -= 1
    hi += 1
  }
  const rawStep = (hi - lo) / Math.max(1, maxTicks - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { domain: [start, end], ticks }
}
