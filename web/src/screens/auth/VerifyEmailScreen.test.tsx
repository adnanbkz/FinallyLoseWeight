import type { User } from '@firebase/auth'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeAuth, renderWithProviders } from '../../test/utils'
import { VerifyEmailScreen } from './VerifyEmailScreen'

describe('<VerifyEmailScreen>', () => {
  it('lets an unverified user export or delete the account (GDPR: only a valid token is needed)', async () => {
    const user = userEvent.setup()
    const auth = createFakeAuth({
      user: { uid: 'user-1', email: 'ana@exmaple.com', emailVerified: false, providerData: [] } as unknown as User,
    })
    renderWithProviders(<VerifyEmailScreen />, { auth })

    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar mis datos' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }))
    expect(await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })).toBeInTheDocument()
  })
})
