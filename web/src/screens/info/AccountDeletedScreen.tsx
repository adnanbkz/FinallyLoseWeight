import { Link } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import { buttonClass, cardClass } from '../../components/ui/styles'
import { GateLayout } from '../gates/GateLayout'

export function AccountDeletedScreen() {
  return (
    <GateLayout title="Cuenta borrada" subtitle="Gracias por haber usado FinallyLoseWeight.">
      <section className={`${cardClass} flex flex-col items-center gap-3 text-center`} role="status">
        <CheckCircle2 className="size-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <p>
          Tu cuenta y <strong>todos tus datos</strong> (perfil, pesos, comidas, pasos y cardio) se han borrado de forma
          definitiva.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Si instalaste la app en la pantalla de inicio, ya puedes eliminar el icono.
        </p>
      </section>
      <Link to="/" replace className={buttonClass('outline', 'md', true)}>
        Volver al inicio
      </Link>
    </GateLayout>
  )
}
