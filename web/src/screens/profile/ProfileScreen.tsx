import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Download, KeyRound, LogOut, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
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
import { cn, surfaceClass } from '../../components/ui/styles'
import { formatInstantDate } from '../../lib/dates'
import { formatNumber } from '../../lib/numbers'
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
        {profile.data && <IdentityCard profile={profile.data} email={user?.email ?? null} />}
        {/* Desktop: the form on the left, data and account on the right. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Card title="Tu perfil" icon={<UserRound />}>
            {profile.data ? <ProfileForm key={profile.data.updatedAt} profile={profile.data} /> : <LoadingBlock />}
          </Card>

          <div className="flex flex-col gap-4">
            <Card title="Tus datos" icon={<Download />} tone="steps">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Descarga una copia de todo lo que has registrado (JSON) o borra tu cuenta y todos tus datos.
                </p>
                <ExportData />
                <DeleteAccountSection />
              </div>
            </Card>

            <Card title="Cuenta" icon={<KeyRound />} tone="slate">
              <dl className="flex flex-col gap-2 text-sm">
                {!profile.data && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                    <dd className="min-w-0 truncate text-right">{user?.email ?? '—'}</dd>
                  </div>
                )}
                {profile.data && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">Consentimiento</dt>
                    <dd className="text-right">
                      {formatInstantDate(profile.data.consentAt)} · aviso v{profile.data.privacyVersion}
                    </dd>
                  </div>
                )}
              </dl>
              <nav className="mt-3 flex flex-col divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/5 dark:border-white/5" aria-label="Más información">
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

function IdentityCard({ profile, email }: { profile: Profile; email: string | null }) {
  const chips = [
    profile.targetWeightKg !== null && `Objetivo ${formatNumber(profile.targetWeightKg, 1)} kg`,
    profile.dailyKcalTarget !== null && `${formatNumber(profile.dailyKcalTarget)} kcal/día`,
    profile.heightCm !== null && `${formatNumber(profile.heightCm)} cm`,
  ].filter((c): c is string => Boolean(c))
  return (
    <section className={cn('flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center', surfaceClass)} aria-label="Resumen">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 text-2xl font-extrabold text-white shadow-glow"
          aria-hidden="true"
        >
          {profile.displayName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{profile.displayName}</p>
          {email && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email}</p>}
        </div>
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tus objetivos">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full bg-slate-900/[0.04] px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-900/5 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
            >
              {chip}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NavRow({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-3 text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-400">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-900/[0.04] text-slate-600 dark:bg-white/5 dark:text-slate-300 [&>svg]:size-4" aria-hidden="true">
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
