import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ShieldAlert, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/context'
import {
  hasPasswordProvider,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
} from '../../auth/actions'
import { authErrorMessage, isAuthCancellation } from '../../auth/authErrors'
import { useDeleteAccount } from '../../api/hooks'
import { apiErrorMessage, isApiError } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { FormError } from '../../components/ui/States'
import { GoogleIcon } from '../auth/GoogleIcon'
import { PasswordField } from '../auth/PasswordField'
import { clearPendingDeletion, markPendingDeletion, peekPendingDeletion } from './pendingDeletion'

type Step = 'confirm' | 'reauth' | 'final'
const CONFIRM_WORD = 'BORRAR'

/** "Borrar mi cuenta": explicit confirmation → re-authentication → DELETE /api/me → sign out. */
export function DeleteAccountSection() {
  const { redirectError } = useAuth()
  // Resuming after a Google re-auth redirect. Only the sheet opened on mount resumes: once it is closed,
  // "Borrar mi cuenta" starts again from the explicit confirmation.
  const [resumed, setResumed] = useState(() => peekPendingDeletion())
  const [open, setOpen] = useState(resumed)
  const initialStep: Step = resumed ? (redirectError ? 'reauth' : 'final') : 'confirm'

  useEffect(() => {
    if (resumed) clearPendingDeletion()
  }, [resumed])

  const close = () => {
    setOpen(false)
    setResumed(false)
  }

  return (
    <>
      <Button variant="ghostDanger" block onClick={() => setOpen(true)} icon={<Trash2 className="size-5" aria-hidden="true" />}>
        Borrar mi cuenta
      </Button>
      {open && (
        <DeleteAccountSheet initialStep={initialStep} initialError={resumed ? redirectError : null} onClose={close} />
      )}
    </>
  )
}

function DeleteAccountSheet({
  initialStep,
  initialError,
  onClose,
}: {
  initialStep: Step
  initialError: string | null
  onClose: () => void
}) {
  const { user, signOut, clearRedirectError } = useAuth()
  const navigate = useNavigate()
  const deleteAccount = useDeleteAccount()
  const [step, setStep] = useState<Step>(initialStep)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  if (!user) return null
  const usesPassword = hasPasswordProvider(user)
  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD

  const performDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await user.getIdToken(true)
      await deleteAccount.mutateAsync()
      clearPendingDeletion()
      clearRedirectError()
      void navigate('/cuenta-borrada', { replace: true })
      await signOut().catch(() => undefined)
    } catch (err) {
      if (isApiError(err, 'reauth_required')) {
        setStep('reauth')
        setError('Ha pasado demasiado tiempo desde que te identificaste. Vuelve a hacerlo para continuar.')
      } else {
        setError(apiErrorMessage(err))
      }
      setBusy(false)
    }
  }

  const reauthAndDelete = async () => {
    setError(null)
    if (usesPassword) {
      if (!password) {
        setError('Escribe tu contraseña.')
        return
      }
      setBusy(true)
      try {
        await reauthenticateWithPassword(user, password)
      } catch (err) {
        setError(authErrorMessage(err))
        setBusy(false)
        return
      }
      await performDelete()
      return
    }

    setBusy(true)
    markPendingDeletion()
    try {
      const outcome = await reauthenticateWithGoogle(user)
      if (outcome === 'redirect') return // continues after the page comes back
    } catch (err) {
      clearPendingDeletion()
      if (!isAuthCancellation(err)) setError(authErrorMessage(err))
      setBusy(false)
      return
    }
    clearPendingDeletion()
    await performDelete()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="Borrar mi cuenta"
      footer={
        step === 'confirm' ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={!confirmed} onClick={() => setStep('reauth')}>
              Continuar
            </Button>
          </div>
        ) : step === 'reauth' ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            {usesPassword ? (
              <Button variant="danger" loading={busy} onClick={() => void reauthAndDelete()}>
                Borrar
              </Button>
            ) : (
              <Button variant="danger" loading={busy} onClick={() => void reauthAndDelete()} icon={<GoogleIcon className="size-5 rounded-full bg-white p-0.5" />}>
                Confirmar
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void performDelete()}>
              Borrar ya
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-300">
        {step === 'confirm' && (
          <>
            <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">
              <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
              <p>
                Se borrarán <strong>definitivamente</strong> tu perfil, todos tus pesos, comidas, pasos y sesiones de cardio, y
                tu usuario de acceso. <strong>No se puede deshacer.</strong>
              </p>
            </div>
            <p className="text-sm">Si quieres conservar una copia, descarga antes tus datos con «Descargar mis datos».</p>
            <TextField
              label={
                <>
                  Escribe <strong>{CONFIRM_WORD}</strong> para confirmar
                </>
              }
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </>
        )}
        {step === 'reauth' &&
          (usesPassword ? (
            <>
              <p>Por seguridad, confirma tu contraseña. Al pulsar «Borrar» se eliminará tu cuenta.</p>
              <PasswordField label="Contraseña" value={password} onChange={setPassword} autoComplete="current-password" disabled={busy} />
            </>
          ) : (
            <p>Por seguridad, confirma que eres tú con tu cuenta de Google. Después se eliminará tu cuenta.</p>
          ))}
        {step === 'final' && <p>Identidad confirmada. Pulsa «Borrar ya» para eliminar tu cuenta y todos tus datos.</p>}
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}
