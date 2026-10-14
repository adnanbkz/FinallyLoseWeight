import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/errors'
import type { Cardio, CardioEstimate, CardioInput, Machine } from '../../api/types'
import { createFakeApi, renderWithProviders } from '../../test/utils'
import { CardioSheet } from './CardioSheet'

const machines: Machine[] = [
  {
    id: 'incline-treadmill',
    name: 'Cinta inclinada',
    fields: [
      { key: 'inclinePercent', label: 'Pendiente', unit: '%', min: 0, max: 40, step: 0.5, required: true },
      { key: 'durationMin', label: 'Tiempo', unit: 'min', min: 1, max: 600, step: 1, required: true },
      { key: 'avgSpeedKmh', label: 'Velocidad media', unit: 'km/h', min: 0.5, max: 25, step: 0.1, required: true },
    ],
  },
]

const estimate: CardioEstimate = {
  kcalGross: 302,
  kcalNet: 265,
  weightKgUsed: 70,
  weightSource: 'provided',
  formula: 'acsm-walking',
  formulaVersion: 'acsm-v1',
}

describe('<CardioSheet>', () => {
  it('builds the form from the catalog and asks for a weight on 422 weight_required', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    api.get.mockResolvedValue(machines)
    api.post.mockImplementation(async (_path: string, body: unknown) => {
      if ((body as CardioInput).weightKg == null) throw new ApiError({ status: 422, code: 'weight_required' })
      return estimate
    })
    renderWithProviders(<CardioSheet date="2026-10-14" session={null} onClose={() => {}} />, { api })

    await user.type(await screen.findByLabelText('Pendiente (%)'), '12')
    await user.type(screen.getByLabelText('Tiempo (min)'), '30')
    await user.type(screen.getByLabelText('Velocidad media (km/h)'), '4,8')

    // Debounced estimate → 422 → weight input appears.
    const weight = await screen.findByLabelText('Tu peso', {}, { timeout: 3000 })
    expect(api.post).toHaveBeenCalledWith(
      '/api/cardio/estimate',
      expect.objectContaining({ machine: 'incline-treadmill', inclinePercent: 12, durationMin: 30, avgSpeedKmh: 4.8, weightKg: null }),
      expect.anything(),
    )

    await user.type(weight, '70')
    await waitFor(() => expect(screen.getByText(/265/)).toBeInTheDocument(), { timeout: 3000 })
    expect(api.post).toHaveBeenLastCalledWith(
      '/api/cardio/estimate',
      expect.objectContaining({ weightKg: 70 }),
      expect.anything(),
    )
    expect(screen.getByText(/indicado aquí/)).toBeInTheDocument()
  })

  it('says the estimate needs a weight instead of "Calculando…" on 422 weight_required', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    api.get.mockResolvedValue(machines)
    api.post.mockRejectedValue(new ApiError({ status: 422, code: 'weight_required' }))
    renderWithProviders(<CardioSheet date="2026-10-14" session={null} onClose={() => {}} />, { api })

    await user.type(await screen.findByLabelText('Pendiente (%)'), '0')
    await user.type(screen.getByLabelText('Tiempo (min)'), '30')
    await user.type(screen.getByLabelText('Velocidad media (km/h)'), '6,9')

    expect(await screen.findByText('Indica tu peso para ver la estimación.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText('Calculando…')).not.toBeInTheDocument()
  })

  it('keeps the weight used when editing, so a note-only edit saves without retyping it', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const session: Cardio = {
      id: '0192f0c4-0000-7000-8000-000000000001',
      date: '2026-05-01',
      machine: 'incline-treadmill',
      machineName: 'Cinta inclinada',
      durationMin: 30,
      avgSpeedKmh: 4.8,
      inclinePercent: 12,
      resistanceLevel: null,
      weightKgUsed: 80,
      kcalGross: 345,
      kcalNet: 303,
      formulaVersion: 'acsm-v1',
      note: null,
      createdAt: '2026-05-01T08:00:00Z',
    }
    api.get.mockResolvedValue(machines)
    api.post.mockImplementation(async (_path: string, body: unknown) => {
      // No weight registered on or before 2026-05-01: only a provided weight works.
      if ((body as CardioInput).weightKg == null) throw new ApiError({ status: 422, code: 'weight_required' })
      return { ...estimate, kcalGross: 345, kcalNet: 303, weightKgUsed: 80 }
    })
    api.put.mockResolvedValue({ ...session, note: 'Con chaleco' })
    renderWithProviders(<CardioSheet date="2026-05-01" session={session} onClose={() => {}} />, { api })

    expect(await screen.findByLabelText('Tu peso')).toHaveValue('80')
    await user.type(screen.getByLabelText(/Nota/), 'Con chaleco')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        `/api/cardio/${session.id}`,
        expect.objectContaining({ date: '2026-05-01', weightKg: 80, note: 'Con chaleco' }),
      ),
    )
    expect(screen.queryByText('Indica tu peso para calcular las calorías.')).not.toBeInTheDocument()
  })
})
