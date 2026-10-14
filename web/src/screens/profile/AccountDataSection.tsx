import { useId, type ReactNode } from 'react'
import { cardClass } from '../../components/ui/styles'
import { DeleteAccountSection } from './DeleteAccount'
import { ExportData } from './ExportData'

/**
 * "Tus datos" (GDPR): export and account deletion. Both only need a valid token, so every gate shows it,
 * also before the email is verified, the invitation is accepted or the profile exists.
 */
export function AccountDataSection({ children }: { children: ReactNode }) {
  const headingId = useId()
  return (
    <section className={`${cardClass} flex flex-col gap-3`} aria-labelledby={headingId}>
      <h2 id={headingId} className="font-semibold">
        Tus datos
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
      <ExportData />
      <DeleteAccountSection />
    </section>
  )
}
