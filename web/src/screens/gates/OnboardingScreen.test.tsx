import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '../../api/types'
import { renderWithProviders } from '../../test/utils'
import { OnboardingScreen } from './OnboardingScreen'
import { CONSENT_REQUIRED_MESSAGE } from './PrivacyConsent'

const created: Profile = {
  displayName: 'Ana',
  heightCm: 165,
  targetWeightKg: 60.5,
  dailyKcalTarget: 1900,
  consentAt: '2026-10-14T08:30:00Z',
  privacyVersion: '1',
  currentPrivacyVersion: '1',
  createdAt: '2026-10-14T08:30:00Z',
  updatedAt: '2026-10-14T08:30:00Z',
}

describe('<OnboardingScreen>', () => {
  it('does not create the profile without explicit consent', async () => {
    const user = userEvent.setup()
    const { api } = renderWithProviders(<OnboardingScreen />)

    await user.type(screen.getByLabelText('¿Cómo quieres que te llamemos?'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Empezar' }))

    expect(await screen.findByText(CONSENT_REQUIRED_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('sends acceptPrivacy=true and the parsed profile once consent is given', async () => {
    const user = userEvent.setup()
    const { api } = renderWithProviders(<OnboardingScreen />)
    api.put.mockResolvedValue(created)

    await user.type(screen.getByLabelText('¿Cómo quieres que te llamemos?'), '  Ana ')
    await user.type(screen.getByLabelText(/Altura/), '165')
    await user.type(screen.getByLabelText(/Peso objetivo/), '60,5')
    await user.type(screen.getByLabelText(/Objetivo diario de calorías/), '1.900')
    await user.click(screen.getByRole('checkbox', { name: /consentimiento explícito/ }))
    await user.click(screen.getByRole('button', { name: 'Empezar' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/me', {
        displayName: 'Ana',
        heightCm: 165,
        targetWeightKg: 60.5,
        dailyKcalTarget: 1900,
        acceptPrivacy: true,
      }),
    )
    expect(screen.queryByText(CONSENT_REQUIRED_MESSAGE)).not.toBeInTheDocument()
  })

  it('lets the user export or delete the account without creating a profile', async () => {
    renderWithProviders(<OnboardingScreen />)

    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar mis datos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeInTheDocument()
  })

  it('validates ranges before calling the API', async () => {
    const user = userEvent.setup()
    const { api } = renderWithProviders(<OnboardingScreen />)
    await user.type(screen.getByLabelText('¿Cómo quieres que te llamemos?'), 'Ana')
    await user.type(screen.getByLabelText(/Altura/), '30')
    await user.click(screen.getByRole('checkbox', { name: /consentimiento explícito/ }))
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(await screen.findByText('Indica una altura entre 100 y 250 cm.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })
})
