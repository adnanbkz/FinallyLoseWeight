import { useId } from 'react'
import { Checkbox } from '../../components/ui/Field'
import { cardClass } from '../../components/ui/styles'
import { PrivacyContent, PrivacySummary } from '../info/PrivacyContent'

export const CONSENT_REQUIRED_MESSAGE =
  'Para usar la app tienes que dar tu consentimiento para el tratamiento de tus datos de salud.'

/** Privacy summary, full notice and the explicit-consent checkbox (sign-up and re-consent). */
export function PrivacyConsentSection({
  checked,
  onChange,
  error,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  disabled?: boolean
}) {
  const headingId = useId()
  return (
    <section className={cardClass} aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-base font-semibold">
        Tu privacidad
      </h2>
      <PrivacySummary />
      <details className="group mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
        <summary className="min-h-11 cursor-pointer content-center px-3 text-sm font-medium text-brand-700 dark:text-brand-400">
          Leer el aviso de privacidad completo
        </summary>
        <div className="px-3 pt-1 pb-3">
          <PrivacyContent />
        </div>
      </details>
      <Checkbox
        className="mt-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        error={error}
        disabled={disabled}
        label={
          <>
            Doy mi <strong>consentimiento explícito</strong> para que FinallyLoseWeight guarde y trate mis datos de salud
            (peso, comidas y actividad) con el único fin de mostrarme mi diario. Sé que puedo retirarlo borrando mi cuenta.
          </>
        }
      />
    </section>
  )
}
