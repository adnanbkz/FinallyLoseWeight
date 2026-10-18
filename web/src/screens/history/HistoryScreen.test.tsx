import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import type { Stats, StatsDay } from '../../api/types'
import { addDays } from '../../lib/dates'
import { createFakeApi, renderWithProviders } from '../../test/utils'
import { HistoryScreen } from './HistoryScreen'

const TODAY = '2026-10-14'
// 00:30 in Madrid on 14 October (still 13 October in UTC): "today" must be the local day.
const NOW = new Date('2026-10-13T22:30:00Z')
const FROM = '2026-09-15'

function stats(values: Record<string, Partial<StatsDay>> = {}): Stats {
  const days: StatsDay[] = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(FROM, i)
    return { date, weightKg: null, weightTrendKg: null, kcalIn: null, kcalCardioNet: 0, steps: null, ...values[date] }
  })
  return { from: FROM, to: TODAY, days }
}

function DayRoute() {
  const { date } = useParams()
  return <h1>Día {date}</h1>
}

function renderHistory(response: () => Promise<Stats>) {
  const api = createFakeApi()
  api.get.mockImplementation(async (path: string) => {
    if (path === '/api/stats') return response()
    throw new Error(`Unexpected GET ${path}`)
  })
  const view = renderWithProviders(
    <Routes>
      <Route path="/historial" element={<HistoryScreen />} />
      <Route path="/" element={<h1>Hoy</h1>} />
      <Route path="/dia/:date" element={<DayRoute />} />
    </Routes>,
    { api, route: '/historial' },
  )
  return { ...view, api }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('<HistoryScreen>', () => {
  it('asks for the last 30 local days and lists them newest first', async () => {
    const { api } = renderHistory(async () =>
      stats({
        [TODAY]: { weightKg: 72.4, kcalIn: 1850, steps: 9000, kcalCardioNet: 310 },
        '2026-10-12': { weightKg: 72.9, kcalIn: null, steps: 12500 },
      }),
    )

    const list = await screen.findByRole('list', { name: 'Días' })
    expect(api.get).toHaveBeenCalledWith('/api/stats', expect.objectContaining({ query: { from: FROM, to: TODAY } }))

    const rows = within(list).getAllByRole('button')
    expect(rows).toHaveLength(30)
    expect(rows[0]).toHaveTextContent('Hoy')
    expect(rows[0]).toHaveTextContent('Peso: 72,4 kg')
    expect(rows[0]).toHaveTextContent('Calorías: 1850 kcal')
    expect(rows[0]).toHaveTextContent('Pasos: 9000 pasos')
    expect(rows[0]).toHaveTextContent('Cardio neto: 310 kcal')
    expect(rows[1]).toHaveTextContent('Ayer')
    expect(rows[2]).toHaveTextContent('12.500')
    // Not logged is shown as "sin registro", never as 0 (here: kcal and cardio).
    expect(within(rows[2]!).getAllByLabelText('sin registro')).toHaveLength(2)
    expect(rows[29]).toHaveTextContent('15 sept')
  })

  it('opens a past day in the diary, and today at "/"', async () => {
    const user = userEvent.setup()
    renderHistory(async () => stats({ '2026-10-12': { steps: 12500 }, [TODAY]: { steps: 100 } }))

    const list = await screen.findByRole('list', { name: 'Días' })
    await user.click(within(list).getAllByRole('button')[2]!)
    expect(await screen.findByRole('heading', { name: 'Día 2026-10-12' })).toBeInTheDocument()
  })

  it('navigates to "/" for today', async () => {
    const user = userEvent.setup()
    renderHistory(async () => stats({ [TODAY]: { steps: 100 } }))

    const list = await screen.findByRole('list', { name: 'Días' })
    await user.click(within(list).getAllByRole('button')[0]!)
    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('shows an empty state when nothing was logged (cardio counts as something)', async () => {
    const { unmount } = renderHistory(async () => stats())
    expect(await screen.findByText('Todavía no hay registros')).toBeInTheDocument()
    unmount()

    renderHistory(async () => stats({ '2026-10-01': { kcalCardioNet: 120 } }))
    expect(await screen.findByRole('list', { name: 'Días' })).toBeInTheDocument()
  })

  it('shows the error with a retry button', async () => {
    const user = userEvent.setup()
    let fail = true
    const { api } = renderHistory(async () => {
      if (fail) throw new ApiError({ status: 503 })
      return stats({ [TODAY]: { steps: 100 } })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no está disponible')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('list', { name: 'Días' })).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })
})
