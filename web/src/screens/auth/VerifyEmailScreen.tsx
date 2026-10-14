import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, LogOut, MailCheck, Send } from 'lucide-react'
import { useAuth } from '../../auth/context'
import { sendVerificationEmail } from '../../auth/actions'
import { authErrorMessage } from '../../auth/authErrors'
import { queryKeys } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/States'
import { cardClass } from '../../components/ui/styles'
import { GateLayout } from '../gates/GateLayout'
import { AccountDataSection } from '../profile/AccountDataSection'

const RESEND_COOLDOWN_MS = 30_000

/** "Verifica tu email" gate for email/password accounts. */
export function VerifyEmailScreen() {
  const { user, auth, refreshUser, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<null | 'check' | 'resend'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resendLocked, setResendLocked] = useState(false)
  const checking = useRef(false)

  const check = async (silent: boolean) => {
    if (checking.current) return
    checking.current = true
    if (!silent) {
      setBusy('check')
      setError(null)
      setNotice(null)
    }
    try {
      await refreshUser()
      if (auth?.currentUser?.emailVerified) {
        // A fresh token now carries email_verified=true: ask the API again.
        await queryClient.invalidateQueries({ queryKey: queryKeys.me })
      } else if (!silent) {
        setError('Todavía no consta como verificado. Abre el enlace del email y vuelve a pulsar el botón.')
      }
    } catch (err) {
      if (!silent) setError(authErrorMessage(err))
    } finally {
      checking.current = false
      if (!silent) setBusy(null)
    }
  }

  // Coming back from the mail app: check silently.
  const checkRef = useRef(check)
  useEffect(() => {
    checkRef.current = check
  })
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkRef.current(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const resend = async () => {
    if (!user) return
    setBusy('resend')
    setError(null)
    setNotice(null)
    try {
      await sendVerificationEmail(user)
      setNotice('Te hemos enviado un nuevo email de verificación.')
      setResendLocked(true)
      setTimeout(() => setResendLocked(false), RESEND_COOLDOWN_MS)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <GateLayout title="Verifica tu email" subtitle="Un último paso antes de empezar.">
      <div className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <MailCheck className="size-8" aria-hidden="true" />
          </div>
          <p className="text-slate-700 dark:text-slate-200">
            Te hemos enviado un enlace de verificación a <strong className="break-all">{user?.email}</strong>. Ábrelo y
            después vuelve aquí.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Si no lo ves en unos minutos, revisa la carpeta de spam.</p>
        </div>
        {notice && (
          <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
            {notice}
          </p>
        )}
        <FormError>{error}</FormError>
        <Button
          block
          size="lg"
          onClick={() => void check(false)}
          loading={busy === 'check'}
          disabled={busy !== null}
          icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
        >
          Ya lo he verificado
        </Button>
        <Button
          block
          variant="outline"
          onClick={() => void resend()}
          loading={busy === 'resend'}
          disabled={busy !== null || resendLocked}
          icon={<Send className="size-5" aria-hidden="true" />}
        >
          {resendLocked ? 'Email reenviado' : 'Reenviar email'}
        </Button>
      </div>
      <Button variant="ghost" onClick={() => void signOut()} icon={<LogOut className="size-5" aria-hidden="true" />}>
        Cerrar sesión y usar otra cuenta
      </Button>
      <AccountDataSection>
        Aunque no hayas verificado el email (por ejemplo, si lo escribiste mal), puedes descargar cualquier dato asociado a
        esta cuenta o borrarla del todo, también tu usuario de acceso.
      </AccountDataSection>
    </GateLayout>
  )
}
