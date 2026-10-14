import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/utils'
import { NotInvitedScreen } from './NotInvitedScreen'

describe('<NotInvitedScreen>', () => {
  it('names the account, lets the user check again or sign out, and keeps export/delete available', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { auth } = renderWithProviders(<NotInvitedScreen onRetry={onRetry} retrying={false} />)

    expect(screen.getByText('ana@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Comprobar de nuevo' }))
    expect(onRetry).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(auth.signOut).toHaveBeenCalledOnce()

    // GDPR: export and deletion only need a valid token, not an invitation.
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar mis datos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeInTheDocument()
  })

  it('disables "Comprobar de nuevo" while checking', () => {
    renderWithProviders(<NotInvitedScreen onRetry={() => {}} retrying />)
    expect(screen.getByRole('button', { name: 'Comprobar de nuevo' })).toBeDisabled()
  })
})
