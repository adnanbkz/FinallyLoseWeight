import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { apiErrorMessage } from '../../api/errors'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { cn } from './styles'

export function LoadingBlock({ label = 'Cargando…', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center gap-3 py-8 text-slate-500 dark:text-slate-400', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-5" />
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800', className)} aria-hidden="true" />
}

export function ErrorBlock({
  error,
  message,
  onRetry,
  retrying,
  className,
}: {
  error?: unknown
  message?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl bg-red-50 p-4 text-center text-red-800 dark:bg-red-950/50 dark:text-red-200',
        className,
      )}
    >
      <AlertTriangle className="size-6" aria-hidden="true" />
      <p className="text-sm">{message ?? apiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

/**
 * A background refresh failed but the last data is still on screen (TanStack Query keeps it). Shown instead
 * of replacing the content with an <ErrorBlock>, which would also close any open edit sheet.
 */
export function StaleDataNotice({
  error,
  onRetry,
  retrying,
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
        className,
      )}
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">No se ha podido actualizar.</strong> Ves los últimos datos cargados.{' '}
        <span className="text-amber-800 dark:text-amber-200">{apiErrorMessage(error)}</span>
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyBlock({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-6 text-center', className)}>
      {icon && (
        <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {children && <div className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Inline form-level error (e.g. API error after submitting). */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/60 dark:text-red-200">
      {children}
    </p>
  )
}

export function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300', className)}>
      {children}
    </p>
  )
}
