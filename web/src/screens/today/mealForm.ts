import type { Meal, MealInput, MealType } from '../../api/types'
import { isBlank, parseDecimal, parseInteger, toInputValue } from '../../lib/numbers'

export interface MealFormValues {
  mealType: MealType
  description: string
  kcal: string
  proteinG: string
  carbsG: string
  fatG: string
}

export type MealFormErrors = Partial<Record<keyof MealFormValues, string>>

export const MEAL_LIMITS = { description: 200, kcalMax: 5000, macroMax: 1000 } as const

export function mealToForm(meal: Meal | null, mealType: MealType): MealFormValues {
  return {
    mealType: meal?.mealType ?? mealType,
    description: meal?.description ?? '',
    kcal: toInputValue(meal?.kcal),
    proteinG: toInputValue(meal?.proteinG),
    carbsG: toInputValue(meal?.carbsG),
    fatG: toInputValue(meal?.fatG),
  }
}

export function validateMealForm(
  values: MealFormValues,
  date: string,
): { ok: true; input: MealInput } | { ok: false; errors: MealFormErrors } {
  const errors: MealFormErrors = {}
  const description = values.description.trim()
  if (!description) errors.description = 'Describe qué has comido.'
  else if (description.length > MEAL_LIMITS.description) errors.description = `Máximo ${MEAL_LIMITS.description} caracteres.`

  const kcal = parseInteger(values.kcal)
  if (isBlank(values.kcal)) errors.kcal = 'Indica las calorías (puede ser 0).'
  else if (kcal === null || kcal < 0 || kcal > MEAL_LIMITS.kcalMax)
    errors.kcal = `Un número entero entre 0 y ${MEAL_LIMITS.kcalMax}.`

  const macro = (key: 'proteinG' | 'carbsG' | 'fatG'): number | null => {
    if (isBlank(values[key])) return null
    const n = parseDecimal(values[key])
    if (n === null || n < 0 || n > MEAL_LIMITS.macroMax) {
      errors[key] = `Entre 0 y ${MEAL_LIMITS.macroMax} g.`
      return null
    }
    return n
  }
  const proteinG = macro('proteinG')
  const carbsG = macro('carbsG')
  const fatG = macro('fatG')

  if (Object.keys(errors).length > 0 || kcal === null) return { ok: false, errors }
  return { ok: true, input: { date, mealType: values.mealType, description, kcal, proteinG, carbsG, fatG } }
}
