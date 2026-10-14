/**
 * Calendar-date helpers. Diary dates are local calendar days formatted as "YYYY-MM-DD".
 *
 * Never use `Date.prototype.toISOString()` to obtain a calendar date: it converts to UTC and
 * returns the wrong day late at night / early in the morning in Spain.
 */

export type IsoDate = string

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Formats the local calendar day of `date` as "YYYY-MM-DD". */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Today's local calendar day. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now)
}

export function isValidIsoDate(value: string | null | undefined): value is IsoDate {
  if (!value) return false
  const match = ISO_DATE_RE.exec(value)
  if (!match) return false
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12)
  return toIsoDate(date) === value
}

/**
 * Parses "YYYY-MM-DD" as a local Date at 12:00 (noon avoids any DST edge at midnight).
 * Throws on invalid input.
 */
export function parseIsoDate(value: IsoDate): Date {
  const match = ISO_DATE_RE.exec(value)
  if (!match || !isValidIsoDate(value)) throw new RangeError(`Fecha no válida: ${value}`)
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d), 12)
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86_400_000)
}

/** ISO dates compare correctly as strings. */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function minIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b
}

/** Inclusive range of `days` days ending at `end`. */
export function rangeEndingAt(end: IsoDate, days: number): { from: IsoDate; to: IsoDate } {
  return { from: addDays(end, -(days - 1)), to: end }
}

const weekdayDayMonth = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const weekdayDayMonthYear = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const shortWeekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const longDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('es-ES') + s.slice(1) : s)
const stripDot = (s: string) => s.replace(/\./g, '')

/** "Hoy", "Ayer" or e.g. "Lunes, 12 de octubre" (adds the year when it is not the current one). */
export function formatDayLabel(value: IsoDate, today: IsoDate = todayIso()): string {
  const delta = diffDays(value, today)
  if (delta === 0) return 'Hoy'
  if (delta === 1) return 'Ayer'
  if (delta === -1) return 'Mañana'
  const date = parseIsoDate(value)
  const sameYear = value.slice(0, 4) === today.slice(0, 4)
  return capitalize((sameYear ? weekdayDayMonth : weekdayDayMonthYear).format(date))
}

/** e.g. "12 oct" */
export function formatShortDate(value: IsoDate): string {
  return stripDot(shortDayMonth.format(parseIsoDate(value)))
}

/** e.g. "lun" */
export function formatShortWeekday(value: IsoDate): string {
  return stripDot(shortWeekday.format(parseIsoDate(value)))
}

/** e.g. "12 de octubre de 2026" */
export function formatLongDate(value: IsoDate): string {
  return longDate.format(parseIsoDate(value))
}

/** Formats an ISO 8601 instant (UTC) as a local date, e.g. "14 de octubre de 2026". */
export function formatInstantDate(instant: string): string {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) return '—'
  return longDate.format(date)
}

/** Milliseconds until the next local midnight (used to roll "today" over). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  return Math.max(1000, next.getTime() - now.getTime())
}
