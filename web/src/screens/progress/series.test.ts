// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { StatsDay } from '../../api/types'
import { addDays } from '../../lib/dates'
import { niceScale, summarize, toBars, weekStart, weightDomain } from './series'

function day(date: string, overrides: Partial<StatsDay> = {}): StatsDay {
  return { date, weightKg: null, weightTrendKg: null, kcalIn: null, kcalCardioNet: 0, steps: null, ...overrides }
}

describe('weekStart', () => {
  it('returns the Monday of the ISO week', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12') // Wednesday
    expect(weekStart('2026-10-12')).toBe('2026-10-12') // Monday
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // Sunday
  })
})

describe('toBars', () => {
  it('keeps unlogged days as null (not zero)', () => {
    const bars = toBars([day('2026-10-13', { kcalIn: 1800 }), day('2026-10-14')], 'day', (d) => d.kcalIn)
    expect(bars.map((b) => b.value)).toEqual([1800, null])
  })

  it('averages logged days per week and per month', () => {
    const days = [
      day('2026-10-12', { steps: 8000 }),
      day('2026-10-13', { steps: 10000 }),
      day('2026-10-14'),
      day('2026-10-19', { steps: 5000 }),
    ]
    const weeks = toBars(days, 'week', (d) => d.steps)
    expect(weeks.map((w) => [w.key, w.value, w.loggedDays])).toEqual([
      ['2026-10-12', 9000, 2],
      ['2026-10-19', 5000, 1],
    ])
    const months = toBars([day('2026-09-30', { steps: 100 }), ...days], 'month', (d) => d.steps)
    expect(months.map((m) => [m.key, m.value])).toEqual([
      ['2026-09', 100],
      ['2026-10', 23000 / 3],
    ])
    expect(months[1]?.longLabel).toBe('Octubre de 2026')
    expect(months.map((m) => /\d/.test(m.label))).toEqual([false, false]) // same year: no year suffix
  })

  it('adds the year to month labels when the range spans two years (1-year view)', () => {
    // rangeEndingAt('2026-10-14', 365) starts on 2025-10-15: October appears at both ends.
    const days = Array.from({ length: 365 }, (_, i) => day(addDays('2025-10-15', i), { steps: 1000 }))
    const months = toBars(days, 'month', (d) => d.steps)
    expect(months).toHaveLength(13)
    expect(months[0]?.label).toBe('oct 25')
    expect(months[12]?.label).toBe('oct 26')
    expect(new Set(months.map((m) => m.label)).size).toBe(13)
  })
})

describe('summarize', () => {
  it('computes latest weight, trend change and averages', () => {
    const days = Array.from({ length: 5 }, (_, i) =>
      day(addDays('2026-10-10', i), {
        weightKg: i % 2 === 0 ? 75 - i * 0.2 : null,
        weightTrendKg: 75 - i * 0.1,
        kcalIn: i < 2 ? 2000 : null,
        steps: 8000,
      }),
    )
    const s = summarize(days)
    expect(s.latestWeight).toEqual({ date: '2026-10-14', kg: 74.2 })
    expect(s.trendChange).toBeCloseTo(-0.4)
    expect(s.avgKcal).toBe(2000)
    expect(s.avgSteps).toBe(8000)
    expect(s.daysWithWeight).toBe(3)
  })

  it('is empty-safe', () => {
    expect(summarize([day('2026-10-14')])).toMatchObject({ latestWeight: null, trendChange: null, avgKcal: null })
  })
})

describe('weightDomain', () => {
  it('pads the data range and includes a nearby target', () => {
    const days = [day('2026-10-13', { weightKg: 80.2 }), day('2026-10-14', { weightTrendKg: 79.6 })]
    expect(weightDomain(days, null)).toEqual([79, 81])
    expect(weightDomain(days, 75)).toEqual([74, 81])
    expect(weightDomain(days, 60)).toEqual([79, 81])
    expect(weightDomain([day('2026-10-14')], 75)).toBeNull()
  })
})

describe('niceScale', () => {
  it('produces round ticks', () => {
    expect(niceScale(74, 81)).toEqual({ domain: [74, 82], ticks: [74, 76, 78, 80, 82] })
    expect(niceScale(0, 2400, 6)).toEqual({ domain: [0, 2500], ticks: [0, 500, 1000, 1500, 2000, 2500] })
    expect(niceScale(0, 11500, 6).ticks).toEqual([0, 2500, 5000, 7500, 10000, 12500])
    expect(niceScale(0, 0, 6).domain[1]).toBeGreaterThan(0)
  })
})
