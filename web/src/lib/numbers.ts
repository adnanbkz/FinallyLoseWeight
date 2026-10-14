/**
 * Number parsing/formatting for Spanish users: accepts "72,5" and "72.5"; formats with es-ES.
 */

const DECIMAL_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/
const PLAIN_INT_RE = /^[+-]?\d+$/
// Thousands separators: "8.500", "12 000", "1.234.567" (dot, space or NBSP groups of three).
const GROUPED_INT_RE = /^[+-]?\d{1,3}([.\s\u00a0\u202f]\d{3})+$/

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

/**
 * Parses a decimal typed by a person. Accepts comma or dot as decimal separator.
 * Returns `null` when the input is empty or not a valid number.
 */
export function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null
  const trimmed = value.trim().replace(/[\s\u00a0\u202f]/g, '')
  if (trimmed === '' || !DECIMAL_RE.test(trimmed)) return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Parses an integer typed by a person. Accepts thousands separators ("8.500", "8 500").
 * Rejects decimals ("12,5"). Returns `null` when empty or invalid.
 */
export function parseInteger(value: string | null | undefined): number | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  let digits: string
  if (PLAIN_INT_RE.test(trimmed)) digits = trimmed
  else if (GROUPED_INT_RE.test(trimmed)) digits = trimmed.replace(/[.\s\u00a0\u202f]/g, '')
  else return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

/** Rounds to `decimals` places, half away from zero (robust to float artifacts such as 1.005). */
export function roundTo(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return value
  const sign = value < 0 ? -1 : 1
  const shifted = Math.round(Number(`${Math.abs(value)}e${decimals}`))
  const result = sign * Number(`${shifted}e-${decimals}`)
  if (Number.isFinite(result)) return result
  const factor = 10 ** decimals
  return (sign * Math.round(Math.abs(value) * factor)) / factor
}

const formatters = new Map<string, Intl.NumberFormat>()
function getFormatter(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max })
    formatters.set(key, f)
  }
  return f
}

/** es-ES number, e.g. 72.5 → "72,5"; 18500 → "18.500". */
export function formatNumber(value: number, maxDecimals = 0, minDecimals = 0): string {
  return getFormatter(minDecimals, maxDecimals).format(value)
}

/** Value for an editable input: es-ES decimal comma, no grouping. 72.5 → "72,5". */
export function toInputValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}

export const formatKg = (value: number) => `${formatNumber(value, 1)} kg`
export const formatKcal = (value: number) => `${formatNumber(Math.round(value))} kcal`
export const formatGrams = (value: number) => `${formatNumber(value, 0)} g`
export const formatSteps = (value: number) => formatNumber(value, 0)

/** "+0,4" / "−1,2" (with a real minus sign) for weight changes. */
export function formatSigned(value: number, maxDecimals = 1): string {
  const rounded = roundTo(value, maxDecimals)
  if (rounded === 0) return formatNumber(0, maxDecimals)
  const abs = formatNumber(Math.abs(rounded), maxDecimals)
  return rounded > 0 ? `+${abs}` : `−${abs}`
}
