import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../auth/context'
import { useSaveProfile } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/States'
import { cardClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toastContext'
import { AccountDataSection } from '../profile/AccountDataSection'
import { ProfileFields } from '../profile/ProfileFields'
import { profileToForm, validateProfileForm, type ProfileFormErrors } from '../profile/profileForm'
import { GateLayout } from './GateLayout'
import { CONSENT_REQUIRED_MESSAGE, PrivacyConsentSection } from './PrivacyConsent'

/** First-run profile + explicit consent for health data (PUT /api/me with acceptPrivacy=true). */
export function OnboardingScreen() {
  const { user, signOut } = useAuth()
  const toast = useToast()
  const save = useSaveProfile()
  const [values, setValues] = useState(() => profileToForm(null))
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<ProfileFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateProfileForm(values)
    const nextErrors: ProfileFormErrors = result.ok ? {} : { ...result.errors }
    if (!consent) nextErrors.acceptPrivacy = CONSENT_REQUIRED_MESSAGE
    setErrors(nextErrors)
    if (!result.ok || !consent) return

    save.mutate(
      { ...result.input, acceptPrivacy: true },
      {
        onSuccess: (profile) => toast.success(`¡Bienvenido/a, ${profile.displayName}!`),
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          setErrors(fields)
          setFormError(apiErrorMessage(error))
        },
      },
    )
  }

  return (
    <GateLayout title="Te damos la bienvenida" subtitle="Cuéntanos un poco sobre ti para preparar tu diario.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <section className={cardClass} aria-labelledby="onboarding-profile">
          <h2 id="onboarding-profile" className="mb-4 text-base font-semibold">
            Tu perfil
          </h2>
          <ProfileFields values={values} errors={errors} onChange={setValues} disabled={save.isPending} />
        </section>

        <PrivacyConsentSection
          checked={consent}
          onChange={(checked) => {
            setConsent(checked)
            if (checked) setErrors((prev) => ({ ...prev, acceptPrivacy: undefined }))
          }}
          error={errors.acceptPrivacy}
        />

        <FormError>{formError}</FormError>
        <Button type="submit" block size="lg" loading={save.isPending}>
          Empezar
        </Button>
      </form>
      <AccountDataSection>
        ¿Prefieres no continuar? Puedes descargar cualquier dato asociado a esta cuenta o borrarla del todo, también
        tu usuario de acceso.
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
