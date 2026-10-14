import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react'
import { apiErrorMessage } from '../../api/errors'
import { Button } from '../../components/ui/Button'

export function FatalErrorScreen({
  error,
  message,
  onRetry,
  retrying,
  onSignOut,
}: {
  error?: unknown
  message?: string
  onRetry?: () => void
  retrying?: boolean
  onSignOut?: () => void
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-safe py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        <AlertTriangle className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold">No hemos podido cargar la app</h1>
      <p className="text-slate-600 dark:text-slate-300" role="alert">
        {message ?? apiErrorMessage(error)}
      </p>
      <div className="flex w-full flex-col gap-3">
        {onRetry && (
          <Button block onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-5" aria-hidden="true" />}>
            Reintentar
          </Button>
        )}
        {onSignOut && (
          <Button block variant="ghost" onClick={onSignOut} icon={<LogOut className="size-5" aria-hidden="true" />}>
            Cerrar sesión
          </Button>
        )}
      </div>
    </main>
  )
}
