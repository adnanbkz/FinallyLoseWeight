import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Download, LogOut, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/context'
import { useProfile, useSaveProfile } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf } from '../../api/errors'
import type { Profile } from '../../api/types'
import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError, LoadingBlock } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { formatInstantDate } from '../../lib/dates'
import { DeleteAccountSection } from './DeleteAccount'
import { ExportData } from './ExportData'
import { ProfileFields } from './ProfileFields'
import { profileToForm, validateProfileForm, type ProfileFormErrors, type ProfileFormValues } from './profileForm'

export function ProfileScreen() {
  const profile = useProfile()
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <>
      <ScreenHeader title="Perfil" subtitle="Tus objetivos, tus datos y tu cuenta." />
      <ScreenBody>
        {/* Desktop: the form on the left, data and account on the right. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Card title="Tu perfil" icon={<UserRound className="size-5" />}>
            {profile.data ? <ProfileForm key={profile.data.updatedAt} profile={profile.data} /> : <LoadingBlock />}
          </Card>

          <div className="flex flex-col gap-4">
            <Card title="Tus datos" icon={<Download className="size-5" />}>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Descarga una copia de todo lo que has registrado (JSON) o borra tu cuenta y todos tus datos.
                </p>
                <ExportData />
                <DeleteAccountSection />
              </div>
            </Card>

            <Card title="Cuenta">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                  <dd className="min-w-0 truncate text-right">{user?.email ?? '—'}</dd>
                </div>
                {profile.data && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">Consentimiento</dt>
                    <dd className="text-right">
                      {formatInstantDate(profile.data.consentAt)} · aviso v{profile.data.privacyVersion}
                    </dd>
                  </div>
                )}
              </dl>
              <nav className="mt-3 flex flex-col divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800" aria-label="Más información">
                <NavRow to="/privacidad" icon={<ShieldCheck className="size-5" />} label="Privacidad" />
                <NavRow to="/instalar" icon={<Smartphone className="size-5" />} label="Cómo instalar la app" />
              </nav>
              <Button
                variant="outline"
                block
                className="mt-3"
                loading={signingOut}
                onClick={() => {
                  setSigningOut(true)
                  void signOut().finally(() => setSigningOut(false))
                }}
                icon={<LogOut className="size-5" aria-hidden="true" />}
              >
                Cerrar sesión
              </Button>
            </Card>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">FinallyLoseWeight v{__APP_VERSION__}</p>
      </ScreenBody>
    </>
  )
}

function NavRow({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-3 text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-400">
      <span className="text-brand-600 dark:text-brand-400" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
    </Link>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useSaveProfile()
  const toast = useToast()
  const [values, setValues] = useState<ProfileFormValues>(() => profileToForm(profile))
  const [errors, setErrors] = useState<ProfileFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const initial = profileToForm(profile)
  const dirty = (Object.keys(values) as Array<keyof ProfileFormValues>).some((k) => values[k].trim() !== initial[k].trim())

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateProfileForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    save.mutate(result.input, {
      onSuccess: () => toast.success('Perfil guardado'),
      onError: (error) => {
        setErrors(fieldErrorsOf(error))
        setFormError(apiErrorMessage(error))
      },
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <ProfileFields values={values} errors={errors} onChange={setValues} disabled={save.isPending} />
      <FormError>{formError}</FormError>
      <Button type="submit" block loading={save.isPending} disabled={!dirty}>
        Guardar cambios
      </Button>
    </form>
  )
}
