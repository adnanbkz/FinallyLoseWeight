import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useAuth, useFirebaseAuth } from '../../auth/context'
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../auth/actions'
import { authErrorCode, authErrorMessage, isAuthCancellation } from '../../auth/authErrors'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { FormError, InfoNote } from '../../components/ui/States'
import { cardClass } from '../../components/ui/styles'
import { GateLayout } from '../gates/GateLayout'
import { GoogleIcon } from './GoogleIcon'
import { PasswordField } from './PasswordField'

type Mode = 'signin' | 'signup' | 'reset'
type Busy = null | 'email' | 'google'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export function AuthScreen() {
  const auth = useFirebaseAuth()
  const { redirectError, clearRedirectError } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

  const formError = error ?? redirectError

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setFieldErrors({})
    setResetSentTo(null)
    clearRedirectError()
  }

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {}
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Escribe un email válido.'
    if (mode !== 'reset') {
      if (!password) errors.password = 'Escribe tu contraseña.'
      else if (mode === 'signup' && password.length < MIN_PASSWORD)
        errors.password = `Usa al menos ${MIN_PASSWORD} caracteres.`
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    clearRedirectError()
    if (!validate()) return
    setBusy('email')
    try {
      if (mode === 'signin') await signInWithEmail(auth, email, password)
      else if (mode === 'signup') await signUpWithEmail(auth, email, password)
      else {
        await resetPassword(auth, email)
        setResetSentTo(email.trim())
      }
    } catch (err) {
      // Do not reveal whether an account exists when resetting the password.
      if (mode === 'reset' && authErrorCode(err) === 'auth/user-not-found') setResetSentTo(email.trim())
      else setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const onGoogle = async () => {
    setError(null)
    clearRedirectError()
    setBusy('google')
    try {
      const outcome = await signInWithGoogle(auth)
      if (outcome === 'redirect') return // the page navigates to Google
    } catch (err) {
      if (!isAuthCancellation(err)) setError(authErrorMessage(err))
    }
    setBusy(null)
  }

  return (
    <GateLayout title="FinallyLoseWeight" subtitle="Tu diario de peso, comidas y actividad.">
      <div className={cardClass}>
        {mode === 'reset' ? (
          <ResetForm
            email={email}
            onEmail={setEmail}
            emailError={fieldErrors.email}
            busy={busy === 'email'}
            sentTo={resetSentTo}
            error={formError}
            onSubmit={onSubmit}
            onBack={() => switchMode('signin')}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Segmented
              label="Acceso"
              value={mode}
              onChange={(m) => switchMode(m)}
              options={[
                { value: 'signin', label: 'Entrar' },
                { value: 'signup', label: 'Crear cuenta' },
              ]}
            />
            <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                disabled={busy !== null}
              />
              <PasswordField
                label="Contraseña"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                error={fieldErrors.password}
                hint={mode === 'signup' ? `Mínimo ${MIN_PASSWORD} caracteres.` : undefined}
                disabled={busy !== null}
              />
              <FormError>{formError}</FormError>
              <Button type="submit" block size="lg" loading={busy === 'email'} disabled={busy !== null}>
                {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
              </Button>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="mx-auto min-h-11 px-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              )}
            </form>

            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />o<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <Button
              variant="outline"
              block
              size="lg"
              onClick={onGoogle}
              loading={busy === 'google'}
              disabled={busy !== null}
              icon={<GoogleIcon />}
            >
              Continuar con Google
            </Button>
          </div>
        )}
      </div>

      <InfoNote>
        FinallyLoseWeight es <strong>solo por invitación</strong>: entra con el email con el que te han invitado.
        {mode === 'signup' && ' Tras crear la cuenta te enviaremos un email para verificarla.'}
      </InfoNote>

      <nav className="mt-auto flex justify-center gap-6 pt-2 text-sm" aria-label="Información">
        <Link to="/privacidad" className="min-h-11 content-center font-medium text-brand-700 hover:underline dark:text-brand-400">
          Privacidad
        </Link>
        <Link to="/instalar" className="min-h-11 content-center font-medium text-brand-700 hover:underline dark:text-brand-400">
          Cómo instalar
        </Link>
      </nav>
    </GateLayout>
  )
}

function ResetForm({
  email,
  onEmail,
  emailError,
  busy,
  sentTo,
  error,
  onSubmit,
  onBack,
}: {
  email: string
  onEmail: (value: string) => void
  emailError?: string
  busy: boolean
  sentTo: string | null
  error: string | null
  onSubmit: (event: FormEvent) => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Recuperar contraseña</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Te enviaremos un enlace para crear una contraseña nueva.
        </p>
      </div>
      {sentTo ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-brand-50 p-4 text-center text-brand-900 dark:bg-brand-950 dark:text-brand-100" role="status">
          <MailCheck className="size-8" aria-hidden="true" />
          <p>
            Si existe una cuenta con <strong className="break-all">{sentTo}</strong>, recibirás un email con el enlace en unos
            minutos. Revisa también la carpeta de spam.
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            error={emailError}
            disabled={busy}
          />
          <FormError>{error}</FormError>
          <Button type="submit" block size="lg" loading={busy} icon={<Mail className="size-5" aria-hidden="true" />}>
            Enviar enlace
          </Button>
        </form>
      )}
      <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-5" aria-hidden="true" />}>
        Volver a entrar
      </Button>
    </div>
  )
}
