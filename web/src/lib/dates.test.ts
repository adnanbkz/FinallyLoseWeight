import { describe, expect, it } from 'vitest'
import {
  addDays,
  diffDays,
  formatDayLabel,
  formatShortDate,
  isValidIsoDate,
  parseIsoDate,
  rangeEndingAt,
  toIsoDate,
  todayIso,
} from './dates'

describe('local calendar dates (TZ=Europe/Madrid)', () => {
  it('runs the suite in Madrid time', () => {
    // 14 Oct 2026 is summer time (UTC+2).
    expect(new Date(2026, 9, 14).getTimezoneOffset()).toBe(-120)
  })

  it('uses the local day, not the UTC day, late at night', () => {
    // 00:30 in Madrid on 15 Oct is still 14 Oct in UTC.
    const lateNight = new Date('2026-10-14T22:30:00Z')
    expect(lateNight.toISOString().slice(0, 10)).toBe('2026-10-14')
    expect(todayIso(lateNight)).toBe('2026-10-15')
    expect(toIsoDate(lateNight)).toBe('2026-10-15')
  })

  it('pads months and days', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 9))).toBe('2026-01-05')
  })

  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('2026-10-14')).toBe(true)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-1-01')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate(undefined)).toBe(false)
  })

  it('parses as local noon and rejects invalid input', () => {
    const d = parseIsoDate('2026-10-14')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 14, 12])
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError)
  })

  it('adds days across month/year boundaries and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    // DST ends in Spain on 25 Oct 2026 and starts on 29 Mar 2026.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })

  it('counts whole days between dates, also across DST', () => {
    expect(diffDays('2026-10-14', '2026-10-14')).toBe(0)
    expect(diffDays('2026-10-20', '2026-10-30')).toBe(10)
    expect(diffDays('2026-03-30', '2026-03-20')).toBe(-10)
  })

  it('builds inclusive ranges ending at a date', () => {
    expect(rangeEndingAt('2026-10-14', 30)).toEqual({ from: '2026-09-15', to: '2026-10-14' })
    expect(rangeEndingAt('2026-10-14', 1)).toEqual({ from: '2026-10-14', to: '2026-10-14' })
  })

  it('formats labels in Spanish', () => {
    expect(formatDayLabel('2026-10-14', '2026-10-14')).toBe('Hoy')
    expect(formatDayLabel('2026-10-13', '2026-10-14')).toBe('Ayer')
    expect(formatDayLabel('2026-10-12', '2026-10-14')).toBe('Lunes, 12 de octubre')
    expect(formatDayLabel('2025-12-31', '2026-10-14')).toBe('Miércoles, 31 de diciembre de 2025')
    expect(formatShortDate('2026-10-14')).toBe('14 oct')
  })
})
