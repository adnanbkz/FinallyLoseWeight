import type { Auth } from '@firebase/auth'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../auth/actions'
import type * as AuthActions from '../../auth/actions'
import { createFakeAuth, renderWithProviders } from '../../test/utils'
import { AuthScreen } from './AuthScreen'

vi.mock('../../auth/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthActions>()),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

const signIn = vi.mocked(signInWithEmail)
const signUp = vi.mocked(signUpWithEmail)
const reset = vi.mocked(resetPassword)
const google = vi.mocked(signInWithGoogle)

const firebaseAuth = { name: 'fake-auth' } as unknown as Auth
const authError = (code: string) => Object.assign(new Error(code), { code })

function renderAuth(redirectError: string | null = null) {
  const auth = createFakeAuth({ status: 'signedOut', user: null, auth: firebaseAuth, redirectError })
  return { ...renderWithProviders(<AuthScreen />, { auth }), auth }
}

beforeEach(() => {
  for (const mock of [signIn, signUp, reset, google]) mock.mockReset()
})

describe('<AuthScreen> email and password', () => {
  it('signs in with the typed email and password', async () => {
    const user = userEvent.setup()
    signIn.mockResolvedValue({} as never)
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith(firebaseAuth, 'ana@example.com', 'correct horse'))
    expect(signUp).not.toHaveBeenCalled()
  })

  it('validates locally before calling Firebase', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'ana@')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Escribe un email válido.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('shows a Spanish message for wrong credentials', async () => {
    const user = userEvent.setup()
    signIn.mockRejectedValue(authError('auth/invalid-credential'))
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('creates an account with at least 8 characters', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValue({} as never)
    renderAuth()

    await user.click(screen.getByRole('radio', { name: 'Crear cuenta' }))
    await user.type(screen.getByLabelText('Email'), ' ana@example.com ')
    await user.type(screen.getByLabelText('Contraseña'), 'short')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Usa al menos 8 caracteres.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Contraseña'), '-enough')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    // <input type="email"> already drops the surrounding spaces (and actions.signUpWithEmail trims too).
    await waitFor(() => expect(signUp).toHaveBeenCalledWith(firebaseAuth, 'ana@example.com', 'short-enough'))
    expect(screen.getByText(/te enviaremos un email para verificarla/)).toBeInTheDocument()
  })
})

describe('<AuthScreen> password reset', () => {
  it('sends the reset link and confirms without revealing whether the account exists', async () => {
    const user = userEvent.setup()
    reset.mockRejectedValueOnce(authError('auth/user-not-found')).mockResolvedValueOnce(undefined)
    renderAuth()

    await user.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }))
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'nadie@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta con nadie@example.com')
    expect(reset).toHaveBeenCalledWith(firebaseAuth, 'nadie@example.com')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a entrar' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('reports other reset errors', async () => {
    const user = userEvent.setup()
    reset.mockRejectedValue(authError('auth/too-many-requests'))
    renderAuth()

    await user.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }))
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('<AuthScreen> Google', () => {
  it('signs in with the popup', async () => {
    const user = userEvent.setup()
    google.mockResolvedValue('done')
    renderAuth()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    expect(google).toHaveBeenCalledWith(firebaseAuth)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled())
  })

  it('stays busy while the page redirects to Google', async () => {
    const user = userEvent.setup()
    google.mockResolvedValue('redirect')
    renderAuth()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('ignores a closed popup and reports real errors', async () => {
    const user = userEvent.setup()
    google.mockRejectedValueOnce(authError('auth/popup-closed-by-user'))
    google.mockRejectedValueOnce(authError('auth/account-exists-with-different-credential'))
    renderAuth()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email usando otro método')
  })

  it('shows the error of a failed Google redirect and clears it when the user tries again', async () => {
    const user = userEvent.setup()
    const { auth } = renderAuth('Esta cuenta está desactivada.')

    expect(screen.getByRole('alert')).toHaveTextContent('Esta cuenta está desactivada.')
    await user.click(screen.getByRole('radio', { name: 'Crear cuenta' }))
    expect(auth.clearRedirectError).toHaveBeenCalled()
  })
})
