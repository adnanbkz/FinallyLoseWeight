import type { CardioFieldKey, CardioFormula, MealType } from '../api/types'

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
}

/** Sensible default meal type for the current hour (Spanish meal times). */
export function defaultMealType(hour: number): MealType {
  if (hour < 11) return 'breakfast'
  if (hour < 17) return 'lunch'
  if (hour < 20) return 'snack'
  return 'dinner'
}

/** Fallback labels/units when the machine catalog is not loaded. */
export const CARDIO_FIELD_FALLBACK: Record<CardioFieldKey, { label: string; unit: string }> = {
  durationMin: { label: 'Tiempo', unit: 'min' },
  avgSpeedKmh: { label: 'Velocidad media', unit: 'km/h' },
  inclinePercent: { label: 'Pendiente', unit: '%' },
  resistanceLevel: { label: 'Resistencia', unit: 'nivel' },
}

export const FORMULA_LABELS: Record<CardioFormula, string> = {
  'acsm-walking': 'caminando',
  'acsm-running': 'corriendo',
}
