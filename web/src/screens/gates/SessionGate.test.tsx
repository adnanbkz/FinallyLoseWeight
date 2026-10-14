import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/errors'
import { queryKeys } from '../../api/hooks'
import { createQueryClient } from '../../api/queryClient'
import type { DaySummary, Profile } from '../../api/types'
import { createFakeApi, renderWithProviders } from '../../test/utils'
import { SessionGate } from './SessionGate'

const profile: Profile = {
  displayName: 'Ana',
  heightCm: 165,
  targetWeightKg: 60,
  dailyKcalTarget: 1800,
  consentAt: '2026-10-14T08:30:00Z',
  privacyVersion: '1',
  currentPrivacyVersion: '1',
  createdAt: '2026-10-14T08:30:00Z',
  updatedAt: '2026-10-14T08:30:00Z',
}

function emptyDay(date: string): DaySummary {
  return {
    date,
    weight: null,
    meals: [],
    steps: null,
    cardio: [],
    totals: { kcalIn: 0, proteinG: 0, carbsG: 0, fatG: 0, kcalCardioGross: 0, kcalCardioNet: 0 },
    dailyKcalTarget: 1800,
  }
}

/** Lets TanStack Query deliver its (setTimeout-batched) observer updates and React re-render. */
const flushUpdates = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)))

/** Fake API: `/api/me` answers with `me()`, `/api/days/{date}` with `day()` (an empty day by default). */
function apiWith(me: () => unknown, day: (date: string) => unknown = emptyDay) {
  const api = createFakeApi()
  api.get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me()
    if (path.startsWith('/api/days/')) return day(path.slice('/api/days/'.length))
    throw new Error(`Unexpected GET ${path}`)
  })
  return api
}

describe('<SessionGate>', () => {
  it('keeps the app and an open sheet when a background refetch of the profile fails', async () => {
    const user = userEvent.setup()
    let failing = false
    const api = apiWith(() => {
      if (failing) throw new ApiError({ status: 0, code: 'network_error' })
      return profile
    })
    const { queryClient } = renderWithProviders(<SessionGate />, { api })

    await user.click(await screen.findByRole('button', { name: 'Añadir a desayuno' }))
    await user.type(screen.getByLabelText('Qué has comido'), 'Tostada con tomate')

    failing = true
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.me }))
    await flushUpdates()

    expect(queryClient.getQueryState(queryKeys.me)?.status).toBe('error')
    expect(screen.queryByText('No hemos podido cargar la app')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Qué has comido')).toHaveValue('Tostada con tomate')
  })

  it('keeps the day cards and an open sheet when a background refetch of the day fails', async () => {
    const user = userEvent.setup()
    let failing = false
    const api = apiWith(
      () => profile,
      (date) => {
        if (failing) throw new ApiError({ status: 503 })
        return emptyDay(date)
      },
    )
    const { queryClient } = renderWithProviders(<SessionGate />, { api })

    await user.click(await screen.findByRole('button', { name: 'Añadir a desayuno' }))
    await user.type(screen.getByLabelText('Qué has comido'), 'Tostada con tomate')

    failing = true
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.days }))

    expect(await screen.findByText('No se ha podido actualizar.')).toBeInTheDocument()
    expect(screen.getByLabelText('Qué has comido')).toHaveValue('Tostada con tomate')
  })

  it('still shows the error screen when the first load fails', async () => {
    const api = apiWith(() => {
      throw new ApiError({ status: 503 })
    })
    renderWithProviders(<SessionGate />, { api })

    expect(await screen.findByText('No hemos podido cargar la app')).toBeInTheDocument()
  })

  it('goes to onboarding when the profile disappears, even with a cached profile', async () => {
    let deleted = false
    const api = apiWith(() => {
      if (deleted) throw new ApiError({ status: 404, code: 'profile_not_found' })
      return profile
    })
    const { queryClient } = renderWithProviders(<SessionGate />, { api })
    await screen.findByRole('button', { name: 'Añadir a desayuno' })

    deleted = true
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.me }))

    expect(await screen.findByRole('heading', { name: 'Te damos la bienvenida' })).toBeInTheDocument()
  })

  it('re-checks the profile when a data request says profile_required', async () => {
    // The profile was deleted from another device right after /api/me answered.
    let meCalls = 0
    const api = apiWith(
      () => {
        meCalls += 1
        if (meCalls > 1) throw new ApiError({ status: 404, code: 'profile_not_found' })
        return profile
      },
      () => {
        throw new ApiError({ status: 403, code: 'profile_required' })
      },
    )
    renderWithProviders(<SessionGate />, { api, queryClient: createQueryClient() })

    expect(await screen.findByRole('heading', { name: 'Te damos la bienvenida' })).toBeInTheDocument()
  })

  it('asks for consent again when the privacy notice changed, sending the current profile', async () => {
    const user = userEvent.setup()
    const api = apiWith(() => ({ ...profile, currentPrivacyVersion: '2' }))
    api.put.mockResolvedValue({ ...profile, privacyVersion: '2', currentPrivacyVersion: '2' })
    renderWithProviders(<SessionGate />, { api })

    expect(await screen.findByRole('heading', { name: 'Hemos actualizado el aviso de privacidad' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aceptar y continuar' }))
    expect(api.put).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: /consentimiento explícito/ }))
    await user.click(screen.getByRole('button', { name: 'Aceptar y continuar' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/me', {
        displayName: 'Ana',
        heightCm: 165,
        targetWeightKg: 60,
        dailyKcalTarget: 1800,
        acceptPrivacy: true,
      }),
    )
    expect(await screen.findByRole('button', { name: 'Añadir a desayuno' })).toBeInTheDocument()
  })
})
