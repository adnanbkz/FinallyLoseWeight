import { describe, expect, it } from 'vitest'
import type { Meal } from '../../api/types'
import { mealToForm, validateMealForm, type MealFormValues } from './mealForm'

const values = (overrides: Partial<MealFormValues> = {}): MealFormValues => ({
  mealType: 'lunch',
  description: 'Pollo con arroz',
  kcal: '650',
  proteinG: '',
  carbsG: '',
  fatG: '',
  ...overrides,
})

describe('validateMealForm', () => {
  it('builds the API body: trimmed text, integer kcal, decimal-comma macros and null for blanks', () => {
    const result = validateMealForm(values({ description: '  Pollo con arroz ', kcal: '1.200', proteinG: '45,5', fatG: '0' }), '2026-10-14')
    expect(result).toEqual({
      ok: true,
      input: { date: '2026-10-14', mealType: 'lunch', description: 'Pollo con arroz', kcal: 1200, proteinG: 45.5, carbsG: null, fatG: 0 },
    })
  })

  it('accepts 0 kcal (e.g. a coffee without sugar)', () => {
    expect(validateMealForm(values({ kcal: '0' }), '2026-10-14').ok).toBe(true)
  })

  it.each([
    ['', 'Indica las calorías (puede ser 0).'],
    ['12,5', 'Un número entero entre 0 y 5000.'],
    ['-1', 'Un número entero entre 0 y 5000.'],
    ['5001', 'Un número entero entre 0 y 5000.'],
    ['abc', 'Un número entero entre 0 y 5000.'],
  ])('rejects kcal %j', (kcal, message) => {
    expect(validateMealForm(values({ kcal }), '2026-10-14')).toEqual({ ok: false, errors: { kcal: message } })
  })

  it('requires a description of at most 200 characters', () => {
    expect(validateMealForm(values({ description: '   ' }), '2026-10-14')).toEqual({
      ok: false,
      errors: { description: 'Describe qué has comido.' },
    })
    expect(validateMealForm(values({ description: 'x'.repeat(200) }), '2026-10-14').ok).toBe(true)
    expect(validateMealForm(values({ description: 'x'.repeat(201) }), '2026-10-14')).toEqual({
      ok: false,
      errors: { description: 'Máximo 200 caracteres.' },
    })
  })

  it('validates every macro between 0 and 1000 g and reports all errors at once', () => {
    expect(validateMealForm(values({ proteinG: '1000,5', carbsG: '-2', fatG: 'mucha' }), '2026-10-14')).toEqual({
      ok: false,
      errors: { proteinG: 'Entre 0 y 1000 g.', carbsG: 'Entre 0 y 1000 g.', fatG: 'Entre 0 y 1000 g.' },
    })
  })
})

describe('mealToForm', () => {
  it('starts empty with the suggested meal type for a new meal', () => {
    expect(mealToForm(null, 'dinner')).toEqual({ mealType: 'dinner', description: '', kcal: '', proteinG: '', carbsG: '', fatG: '' })
  })

  it('prefills an existing meal with decimal commas and keeps its own type', () => {
    const meal: Meal = {
      id: 'm1',
      date: '2026-10-14',
      mealType: 'breakfast',
      description: 'Tostada',
      kcal: 320,
      proteinG: 10.5,
      carbsG: null,
      fatG: 8,
      createdAt: '2026-10-14T07:00:00Z',
    }
    expect(mealToForm(meal, 'dinner')).toEqual({
      mealType: 'breakfast',
      description: 'Tostada',
      kcal: '320',
      proteinG: '10,5',
      carbsG: '',
      fatG: '8',
    })
  })
})
