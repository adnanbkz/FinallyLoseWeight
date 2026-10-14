import { Logo } from '../../components/layout/Logo'
import { Spinner } from '../../components/ui/Spinner'

export function SplashScreen({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center" role="status" aria-live="polite">
      <Logo className="size-20" />
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <Spinner className="size-5" />
        <span>{message}</span>
      </div>
    </div>
  )
}
