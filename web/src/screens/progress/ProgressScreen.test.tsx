import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestOptions } from '../../api/client'
import type { Profile, Stats, StatsDay } from '../../api/types'
import { addDays, diffDays } from '../../lib/dates'
import { createFakeApi, renderWithProviders } from '../../test/utils'
import ProgressScreen from './ProgressScreen'

const TODAY = '2026-10-14'
const NOW = new Date('2026-10-14T10:00:00Z')

const profile: Profile = {
  displayName: 'Ana',
  heightCm: 165,
  targetWeightKg: 68,
  dailyKcalTarget: 2000,
  consentAt: '2026-10-01T08:30:00Z',
  privacyVersion: '1',
  currentPrivacyVersion: '1',
  createdAt: '2026-10-01T08:30:00Z',
  updatedAt: '2026-10-01T08:30:00Z',
}

type DayValues = Record<string, Partial<StatsDay>>

/** /api/stats answering every requested range with `values` (other days unlogged). */
function apiWith(values: DayValues, me: Profile = profile) {
  const api = createFakeApi()
  api.get.mockImplementation(async (path: string, options?: RequestOptions) => {
    if (path === '/api/me') return me
    if (path === '/api/stats') {
      const { from, to } = options!.query as { from: string; to: string }
      const days: StatsDay[] = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => {
        const date = addDays(from, i)
        return { date, weightKg: null, weightTrendKg: null, kcalIn: null, kcalCardioNet: 0, steps: null, ...values[date] }
      })
      return { from, to, days } satisfies Stats
    }
    throw new Error(`Unexpected GET ${path}`)
  })
  return api
}

/** Value of a summary tile, by its label. */
function tile(label: string): string {
  return screen.getByText(label).nextElementSibling?.textContent ?? ''
}

const statsRequests = (api: ReturnType<typeof createFakeApi>) =>
  api.get.mock.calls.filter(([path]) => path === '/api/stats').map(([, options]) => options?.query)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks (and jsdom has no layout):
  // report a phone-sized box so the charts really render.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        const entry = { target, contentRect: { width: 360, height: 220 } } as unknown as ResizeObserverEntry
        this.callback([entry], this as unknown as ResizeObserver)
      }
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('<ProgressScreen>', () => {
  it('summarizes the last 30 days: latest weight, 7-day trend change and averages of the logged days', async () => {
    const api = apiWith({
      '2026-09-20': { weightKg: 75, weightTrendKg: 75.2, kcalIn: 2100, steps: 6000 },
      '2026-10-13': { weightKg: 73.4, weightTrendKg: 73.9, kcalIn: 1900, steps: 10000 },
    })
    renderWithProviders(<ProgressScreen />, { api })

    await waitFor(() => expect(tile('Último peso')).toBe('73,4 kg'))
    expect(statsRequests(api)).toEqual([{ from: '2026-09-15', to: TODAY }])
    expect(tile('Cambio (media 7 días)')).toBe('−1,3 kg')
    expect(screen.getByText('en 30 días')).toBeInTheDocument()
    // Means over the logged days only (2), not the 30 days of the range.
    expect(tile('Media de kcal')).toBe('2000')
    expect(tile('Media de pasos')).toBe('8000')
    expect(screen.getByText('Objetivo 2000 kcal')).toBeInTheDocument()
    // Weight, kcal and steps charts are drawn.
    expect(document.querySelectorAll('svg.recharts-surface').length).toBeGreaterThanOrEqual(3)
  })

  it('loads a longer period when the range changes', async () => {
    const user = userEvent.setup()
    const api = apiWith({ '2026-10-13': { weightKg: 73.4, weightTrendKg: 73.9 } })
    renderWithProviders(<ProgressScreen />, { api })
    await waitFor(() => expect(tile('Último peso')).toBe('73,4 kg'))

    await user.click(screen.getByRole('radio', { name: '90 días' }))
    await waitFor(() => expect(statsRequests(api)).toContainEqual({ from: '2026-07-17', to: TODAY }))
    // Kcal and steps both switch to weekly means.
    expect(await screen.findAllByText('Media semanal de los días registrados.', {}, { timeout: 3000 })).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: '1 año' }))
    await waitFor(() => expect(statsRequests(api)).toContainEqual({ from: '2025-10-15', to: TODAY }))
  })

  it('shows empty states and a profile link when there is nothing to chart', async () => {
    renderWithProviders(<ProgressScreen />, { api: apiWith({}, { ...profile, dailyKcalTarget: null }) })

    expect(await screen.findByText('Aún no hay pesos en este periodo')).toBeInTheDocument()
    expect(screen.getByText('Sin comidas en este periodo')).toBeInTheDocument()
    expect(screen.getByText('Sin pasos en este periodo')).toBeInTheDocument()
    expect(tile('Último peso')).toBe('—')
    expect(tile('Cambio (media 7 días)')).toBe('—')
    expect(screen.getByRole('link', { name: 'Registrar peso' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('offers the same data as an accessible table, newest day first', async () => {
    renderWithProviders(<ProgressScreen />, {
      api: apiWith({ '2026-10-13': { weightKg: 73.4, weightTrendKg: 73.95, kcalIn: 1900, steps: 10000 } }),
    })

    await screen.findByText('Ver los datos en una tabla')
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(31) // header + 30 days
    expect(rows[1]).toHaveTextContent('14 oct')
    expect(rows[2]).toHaveTextContent('13 oct73,473,95190010.000')
  })
})
