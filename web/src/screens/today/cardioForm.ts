import type { Cardio, CardioFieldKey, CardioInput, Machine, MachineField } from '../../api/types'
import { CARDIO_FIELD_KEYS } from '../../api/types'
import { formatNumber, isBlank, parseDecimal, toInputValue } from '../../lib/numbers'

export type CardioFieldValues = Partial<Record<CardioFieldKey, string>>
export type CardioFieldErrors = Partial<Record<CardioFieldKey, string>>

export const WEIGHT_LIMITS = { min: 20, max: 400 } as const
export const NOTE_MAX = 200

export function isIntegerField(field: MachineField): boolean {
  return Number.isInteger(field.step) && field.step >= 1
}

export function fieldRangeHint(field: MachineField): string {
  return `De ${formatNumber(field.min, 2)} a ${formatNumber(field.max, 2)} ${field.unit}`
}

export function cardioToFieldValues(session: Cardio | null): CardioFieldValues {
  const values: CardioFieldValues = {}
  if (!session) return values
  for (const key of CARDIO_FIELD_KEYS) values[key] = toInputValue(session[key])
  return values
}

/** Validates the dynamic fields of a machine against its descriptor (required, min, max, integer step). */
export function validateCardioFields(
  machine: Machine,
  values: CardioFieldValues,
):
  | { ok: true; fields: Pick<CardioInput, CardioFieldKey> }
  | { ok: false; errors: CardioFieldErrors } {
  const errors: CardioFieldErrors = {}
  const fields: Pick<CardioInput, CardioFieldKey> = {
    durationMin: null,
    avgSpeedKmh: null,
    inclinePercent: null,
    resistanceLevel: null,
  }
  for (const field of machine.fields) {
    const raw = values[field.key] ?? ''
    if (isBlank(raw)) {
      if (field.required) errors[field.key] = 'Obligatorio.'
      continue
    }
    const n = parseDecimal(raw)
    if (n === null) {
      errors[field.key] = 'Escribe un número.'
    } else if (isIntegerField(field) && !Number.isInteger(n)) {
      errors[field.key] = 'Escribe un número entero.'
    } else if (n < field.min || n > field.max) {
      errors[field.key] = `${fieldRangeHint(field)}.`
    } else {
      fields[field.key] = n
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, fields }
}

/** Parses the optional "tu peso" input shown on 422 weight_required. */
export function parseWeightOverride(raw: string): { value: number | null; error: string | null } {
  if (isBlank(raw)) return { value: null, error: null }
  const n = parseDecimal(raw)
  if (n === null || n < WEIGHT_LIMITS.min || n > WEIGHT_LIMITS.max)
    return { value: null, error: `Entre ${WEIGHT_LIMITS.min} y ${WEIGHT_LIMITS.max} kg.` }
  return { value: n, error: null }
}
