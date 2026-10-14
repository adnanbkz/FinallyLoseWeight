// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Machine } from '../../api/types'
import { parseWeightOverride, validateCardioFields } from './cardioForm'

const treadmill: Machine = {
  id: 'incline-treadmill',
  name: 'Cinta inclinada',
  fields: [
    { key: 'inclinePercent', label: 'Pendiente', unit: '%', min: 0, max: 40, step: 0.5, required: true },
    { key: 'durationMin', label: 'Tiempo', unit: 'min', min: 1, max: 600, step: 1, required: true },
    { key: 'avgSpeedKmh', label: 'Velocidad media', unit: 'km/h', min: 0.5, max: 25, step: 0.1, required: true },
  ],
}

describe('validateCardioFields', () => {
  it('parses comma decimals and nulls the fields the machine does not use', () => {
    const result = validateCardioFields(treadmill, { inclinePercent: '12', durationMin: '30', avgSpeedKmh: '4,8' })
    expect(result).toEqual({
      ok: true,
      fields: { inclinePercent: 12, durationMin: 30, avgSpeedKmh: 4.8, resistanceLevel: null },
    })
  })

  it('requires required fields and enforces min/max and integer steps', () => {
    const result = validateCardioFields(treadmill, { inclinePercent: '41', durationMin: '30,5', avgSpeedKmh: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.inclinePercent).toMatch(/De 0 a 40 %/)
      expect(result.errors.durationMin).toMatch(/entero/)
      expect(result.errors.avgSpeedKmh).toBe('Obligatorio.')
    }
  })

  it('allows optional fields to stay empty', () => {
    const bike: Machine = {
      id: 'bike',
      name: 'Bici',
      fields: [
        { key: 'durationMin', label: 'Tiempo', unit: 'min', min: 1, max: 600, step: 1, required: true },
        { key: 'resistanceLevel', label: 'Resistencia', unit: 'nivel', min: 1, max: 20, step: 1, required: false },
      ],
    }
    expect(validateCardioFields(bike, { durationMin: '45' })).toEqual({
      ok: true,
      fields: { durationMin: 45, avgSpeedKmh: null, inclinePercent: null, resistanceLevel: null },
    })
  })
})

describe('parseWeightOverride', () => {
  it('accepts comma decimals within 20–400 kg', () => {
    expect(parseWeightOverride('70,5')).toEqual({ value: 70.5, error: null })
    expect(parseWeightOverride('')).toEqual({ value: null, error: null })
    expect(parseWeightOverride('10').error).toMatch(/20 y 400/)
  })
})
