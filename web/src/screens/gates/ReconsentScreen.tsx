import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/context'
import { useSaveProfile } from '../../api/hooks'
import { apiErrorMessage } from '../../api/errors'
import type { Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { AccountDataSection } from '../profile/AccountDataSection'
import { GateLayout } from './GateLayout'
import { CONSENT_REQUIRED_MESSAGE, PrivacyConsentSection } from './PrivacyConsent'

/**
 * The privacy notice changed (`privacyVersion ≠ currentPrivacyVersion`): ask for explicit consent again.
 * PUT /api/me replaces every editable field, so the current profile is sent unchanged plus acceptPrivacy.
 */
export function ReconsentScreen({ profile }: { profile: Profile }) {
  const { user, signOut } = useAuth()
  const toast = useToast()
  const save = useSaveProfile()
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!consent) {
      setConsentError(CONSENT_REQUIRED_MESSAGE)
      return
    }
    save.mutate(
      {
        displayName: profile.displayName,
        heightCm: profile.heightCm,
        targetWeightKg: profile.targetWeightKg,
        dailyKcalTarget: profile.dailyKcalTarget,
        acceptPrivacy: true,
      },
      {
        onSuccess: () => toast.success('Gracias, ya puedes seguir con tu diario.'),
        onError: (error) => setFormError(apiErrorMessage(error)),
      },
    )
  }

  return (
    <GateLayout title="Hemos actualizado el aviso de privacidad" subtitle="Léelo y acéptalo para seguir usando la app.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <PrivacyConsentSection
          checked={consent}
          onChange={(checked) => {
            setConsent(checked)
            if (checked) setConsentError(undefined)
          }}
          error={consentError}
          disabled={save.isPending}
        />
        <FormError>{formError}</FormError>
        <Button type="submit" block size="lg" loading={save.isPending}>
          Aceptar y continuar
        </Button>
      </form>
      <AccountDataSection>
        Si no quieres aceptarlo, puedes descargar tus datos y borrar tu cuenta con todo lo que has registrado.
      </AccountDataSection>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Sesión iniciada como <span className="break-all">{user?.email}</span>
      </p>
      <Button variant="ghost" onClick={() => void signOut()} icon={<LogOut className="size-5" aria-hidden="true" />}>
        Cerrar sesión
      </Button>
    </GateLayout>
  )
}
