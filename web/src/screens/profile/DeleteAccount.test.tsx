import type { User } from '@firebase/auth'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reauthenticateWithGoogle, reauthenticateWithPassword } from '../../auth/actions'
import type * as AuthActions from '../../auth/actions'
import { ApiError } from '../../api/errors'
import { createFakeApi, createFakeAuth, renderWithProviders } from '../../test/utils'
import { DeleteAccountSection } from './DeleteAccount'
import { markPendingDeletion, peekPendingDeletion } from './pendingDeletion'

// Firebase re-authentication is the only thing faked here; hasPasswordProvider() etc. stay real.
vi.mock('../../auth/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthActions>()),
  reauthenticateWithPassword: vi.fn(),
  reauthenticateWithGoogle: vi.fn(),
}))

const reauthPassword = vi.mocked(reauthenticateWithPassword)
const reauthGoogle = vi.mocked(reauthenticateWithGoogle)

const REAUTH_AGAIN = 'Ha pasado demasiado tiempo desde que te identificaste. Vuelve a hacerlo para continuar.'

function fakeUser(providerId: 'password' | 'google.com') {
  return {
    uid: 'user-1',
    email: 'ana@example.com',
    emailVerified: true,
    providerData: [{ providerId }],
    getIdToken: vi.fn(async () => 'fresh-token'),
  }
}

type FakeUser = ReturnType<typeof fakeUser>

function renderSection({ user, redirectError = null }: { user: FakeUser; redirectError?: string | null }) {
  const api = createFakeApi()
  api.delete.mockResolvedValue(undefined)
  const auth = createFakeAuth({ user: user as unknown as User, redirectError })
  const view = renderWithProviders(
    <Routes>
      <Route path="/perfil" element={<DeleteAccountSection />} />
      <Route path="/cuenta-borrada" element={<h1>Cuenta borrada</h1>} />
    </Routes>,
    { api, auth, route: '/perfil' },
  )
  return { ...view, api, auth }
}

async function confirmWithWord(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }))
  const dialog = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
  const next = within(dialog).getByRole('button', { name: 'Continuar' })
  expect(next).toBeDisabled()
  await user.type(within(dialog).getByLabelText(/para confirmar/), ' borrar ')
  expect(next).toBeEnabled()
  await user.click(next)
  return dialog
}

beforeEach(() => {
  sessionStorage.clear()
  reauthPassword.mockReset()
  reauthGoogle.mockReset()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('<DeleteAccountSection> with email and password', () => {
  it('re-authenticates, forces a fresh token, calls DELETE /api/me, then goes to /cuenta-borrada and signs out', async () => {
    const user = userEvent.setup()
    const firebaseUser = fakeUser('password')
    reauthPassword.mockResolvedValue(undefined)
    const { api, auth } = renderSection({ user: firebaseUser })

    const dialog = await confirmWithWord(user)
    // Nothing is deleted without the password.
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialog).findByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(reauthPassword).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Contraseña'), 's3cret!')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(await screen.findByRole('heading', { name: 'Cuenta borrada' })).toBeInTheDocument()
    expect(reauthPassword).toHaveBeenCalledWith(firebaseUser, 's3cret!')
    expect(firebaseUser.getIdToken).toHaveBeenCalledWith(true)
    expect(api.delete).toHaveBeenCalledExactlyOnceWith('/api/me')
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())

    // Order matters: the new token (recent auth_time) must exist before DELETE, and sign-out comes last.
    const reauthAt = reauthPassword.mock.invocationCallOrder[0]!
    const tokenAt = firebaseUser.getIdToken.mock.invocationCallOrder[0]!
    const deleteAt = api.delete.mock.invocationCallOrder[0]!
    const signOutAt = vi.mocked(auth.signOut).mock.invocationCallOrder[0]!
    expect(reauthAt).toBeLessThan(tokenAt)
    expect(tokenAt).toBeLessThan(deleteAt)
    expect(deleteAt).toBeLessThan(signOutAt)
  })

  it('shows the Firebase error and deletes nothing when the password is wrong', async () => {
    const user = userEvent.setup()
    reauthPassword.mockRejectedValue(Object.assign(new Error('wrong'), { code: 'auth/wrong-password' }))
    const { api, auth } = renderSection({ user: fakeUser('password') })

    const dialog = await confirmWithWord(user)
    await user.type(within(dialog).getByLabelText('Contraseña'), 'nope')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(await within(dialog).findByText('Contraseña incorrecta.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Borrar' })).toBeEnabled()
    expect(api.delete).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('goes back to the re-authentication step on 401 reauth_required and succeeds on retry', async () => {
    const user = userEvent.setup()
    reauthPassword.mockResolvedValue(undefined)
    const { api, auth } = renderSection({ user: fakeUser('password') })
    api.delete.mockRejectedValueOnce(new ApiError({ status: 401, code: 'reauth_required' }))

    const dialog = await confirmWithWord(user)
    await user.type(within(dialog).getByLabelText('Contraseña'), 's3cret!')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(await within(dialog).findByText(REAUTH_AGAIN)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Contraseña')).toBeEnabled()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Cuenta borrada' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByRole('heading', { name: 'Cuenta borrada' })).toBeInTheDocument()
    expect(reauthPassword).toHaveBeenCalledTimes(2)
    expect(api.delete).toHaveBeenCalledTimes(2)
  })

  it('keeps the user signed in and shows the API error when the deletion fails', async () => {
    const user = userEvent.setup()
    reauthPassword.mockResolvedValue(undefined)
    const { api, auth } = renderSection({ user: fakeUser('password') })
    api.delete.mockRejectedValue(new ApiError({ status: 503 }))

    const dialog = await confirmWithWord(user)
    await user.type(within(dialog).getByLabelText('Contraseña'), 's3cret!')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(await within(dialog).findByText(/El servidor no está disponible/)).toBeInTheDocument()
    expect(auth.signOut).not.toHaveBeenCalled()
  })
})

describe('<DeleteAccountSection> with Google', () => {
  it('re-authenticates with the popup and deletes the account', async () => {
    const user = userEvent.setup()
    reauthGoogle.mockResolvedValue('done')
    const firebaseUser = fakeUser('google.com')
    const { api, auth } = renderSection({ user: firebaseUser })

    const dialog = await confirmWithWord(user)
    expect(within(dialog).queryByLabelText('Contraseña')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('heading', { name: 'Cuenta borrada' })).toBeInTheDocument()
    expect(reauthGoogle).toHaveBeenCalledWith(firebaseUser)
    expect(firebaseUser.getIdToken).toHaveBeenCalledWith(true)
    expect(api.delete).toHaveBeenCalledWith('/api/me')
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
    expect(peekPendingDeletion()).toBe(false)
  })

  it('says nothing and deletes nothing when the Google popup is closed', async () => {
    const user = userEvent.setup()
    reauthGoogle.mockRejectedValue(Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' }))
    const { api } = renderSection({ user: fakeUser('google.com') })

    const dialog = await confirmWithWord(user)
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeEnabled())
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(api.delete).not.toHaveBeenCalled()
    expect(peekPendingDeletion()).toBe(false)
  })

  it('remembers the pending deletion across the redirect and resumes at the final step after reloading', async () => {
    const user = userEvent.setup()
    reauthGoogle.mockResolvedValue('redirect')
    const first = renderSection({ user: fakeUser('google.com') })

    const dialog = await confirmWithWord(user)
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(peekPendingDeletion()).toBe(true))
    expect(first.api.delete).not.toHaveBeenCalled()

    // The page navigates to Google and comes back: a fresh app instance mounts.
    first.unmount()
    const { api, auth } = renderSection({ user: fakeUser('google.com') })

    const resumed = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
    expect(within(resumed).getByText(/Identidad confirmada/)).toBeInTheDocument()
    // The flag is single-use: a later reload does not resume again.
    expect(peekPendingDeletion()).toBe(false)

    await user.click(within(resumed).getByRole('button', { name: 'Borrar ya' }))
    expect(await screen.findByRole('heading', { name: 'Cuenta borrada' })).toBeInTheDocument()
    expect(api.delete).toHaveBeenCalledWith('/api/me')
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
    expect(auth.clearRedirectError).toHaveBeenCalled()
  })

  it('resumes at the re-authentication step with the error when the Google redirect failed', async () => {
    markPendingDeletion()
    renderSection({ user: fakeUser('google.com'), redirectError: 'Has elegido una cuenta distinta a la que tiene la sesión iniciada.' })

    const dialog = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Has elegido una cuenta distinta')
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('sends a resumed deletion back to re-authentication on 401 reauth_required', async () => {
    const user = userEvent.setup()
    markPendingDeletion()
    const { api, auth } = renderSection({ user: fakeUser('google.com') })
    api.delete.mockRejectedValue(new ApiError({ status: 401, code: 'reauth_required' }))

    const dialog = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
    await user.click(within(dialog).getByRole('button', { name: 'Borrar ya' }))

    expect(await within(dialog).findByText(REAUTH_AGAIN)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('asks for the confirmation word again when a resumed sheet is closed and reopened', async () => {
    const user = userEvent.setup()
    markPendingDeletion()
    renderSection({ user: fakeUser('google.com') })

    const resumed = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
    await user.click(within(resumed).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }))
    const reopened = await screen.findByRole('dialog', { name: 'Borrar mi cuenta' })
    expect(within(reopened).getByLabelText(/para confirmar/)).toBeInTheDocument()
    expect(within(reopened).queryByRole('button', { name: 'Borrar ya' })).not.toBeInTheDocument()
  })

  it('does not resume from a stale pending flag (older than 5 minutes)', async () => {
    sessionStorage.setItem('flw.pendingAccountDeletion', String(Date.now() - 6 * 60_000))
    renderSection({ user: fakeUser('google.com') })

    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
