import { describe, expect, it } from 'vitest'
import { formatKg, formatNumber, formatSigned, parseDecimal, parseInteger, roundTo, toInputValue } from './numbers'

describe('parseDecimal', () => {
  it.each([
    ['72,5', 72.5],
    ['72.5', 72.5],
    [' 72,50 ', 72.5],
    ['72', 72],
    ['0,5', 0.5],
    [',5', 0.5],
    ['72,', 72],
    ['-1,5', -1.5],
  ])('parses %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '72,5,1', '7a', '1.2.3', '--1'])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })

  it('handles null/undefined', () => {
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal(undefined)).toBeNull()
  })
})

describe('parseInteger', () => {
  it.each([
    ['8500', 8500],
    ['8.500', 8500],
    ['8 500', 8500],
    ['1.234.567', 1234567],
    ['0', 0],
    [' 12 ', 12],
  ])('parses %j as %d', (input, expected) => {
    expect(parseInteger(input)).toBe(expected)
  })

  it.each(['', '12,5', '12.5', '8.50', 'abc', '1e3'])('rejects %j', (input) => {
    expect(parseInteger(input)).toBeNull()
  })
})

describe('formatting (es-ES)', () => {
  it('uses a decimal comma and thousands dots', () => {
    expect(formatNumber(72.5, 1)).toBe('72,5')
    expect(formatNumber(18500)).toBe('18.500')
    expect(formatKg(72.46)).toBe('72,5 kg')
  })

  it('produces input values with a comma', () => {
    expect(toInputValue(72.5)).toBe('72,5')
    expect(toInputValue(null)).toBe('')
    expect(toInputValue(2200)).toBe('2200')
  })

  it('signs changes with a real minus sign', () => {
    expect(formatSigned(-1.24)).toBe('−1,2')
    expect(formatSigned(0.35)).toBe('+0,4')
    expect(formatSigned(0.01)).toBe('0')
  })

  it('rounds half away from zero', () => {
    expect(roundTo(2.5)).toBe(3)
    expect(roundTo(-2.5)).toBe(-3)
    expect(roundTo(1.005, 2)).toBe(1.01)
  })
})
