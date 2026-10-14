import { LogOut, RefreshCw, UserX } from 'lucide-react'
import { useAuth } from '../../auth/context'
import { Button } from '../../components/ui/Button'
import { cardClass } from '../../components/ui/styles'
import { AccountDataSection } from '../profile/AccountDataSection'
import { GateLayout } from './GateLayout'

/** 403 not_invited: explain invite-only access; export/delete remain available (GDPR). */
export function NotInvitedScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { user, signOut } = useAuth()
  return (
    <GateLayout title="Solo por invitación" subtitle="FinallyLoseWeight es privada para un grupo pequeño de personas.">
      <section className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <UserX className="size-8" aria-hidden="true" />
          </div>
          <p>
            La cuenta <strong className="break-all">{user?.email}</strong> no está en la lista de personas invitadas.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Si crees que es un error, pide a quien administra la app que añada este email y vuelve a comprobarlo.
          </p>
        </div>
        <Button block onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-5" aria-hidden="true" />}>
          Comprobar de nuevo
        </Button>
        <Button block variant="outline" onClick={() => void signOut()} icon={<LogOut className="size-5" aria-hidden="true" />}>
          Cerrar sesión
        </Button>
      </section>

      <AccountDataSection>Aunque no tengas acceso, puedes descargar o borrar cualquier dato asociado a esta cuenta.</AccountDataSection>
    </GateLayout>
  )
}
