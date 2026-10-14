import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'
import { cn, inputBorder, inputClass } from './styles'

interface FieldShellProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  hideLabel?: boolean
  className?: string
  children: ReactNode
}

function FieldShell({ id, label, hint, error, optional, hideLabel, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-slate-700 dark:text-slate-300', hideLabel && 'sr-only')}>
        {label}
        {optional && <span className="font-normal text-slate-500 dark:text-slate-400"> (opcional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  hideLabel?: boolean
  /** Unit shown inside the input on the right (e.g. "kg"). */
  suffix?: string
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  suffix,
  containerClassName,
  className,
  id: idProp,
  ref,
  ...rest
}: TextFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      hideLabel={hideLabel}
      className={containerClassName}
    >
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, inputBorder(Boolean(error)), suffix && (suffix.length <= 2 ? 'pr-8' : 'pr-14'), className)}
          {...rest}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-slate-500 dark:text-slate-400"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  )
}

export interface NumberFieldProps extends Omit<TextFieldProps, 'type' | 'inputMode'> {
  /** Integers get the numeric keypad; decimals the keypad with a decimal separator. */
  integer?: boolean
}

/** Text input tuned for numbers typed on phones (accepts "72,5"). Parse with lib/numbers. */
export function NumberField({ integer = false, ...rest }: NumberFieldProps) {
  return (
    <TextField
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      {...rest}
    />
  )
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  containerClassName?: string
}

export function SelectField({ label, hint, error, containerClassName, className, id: idProp, children, ...rest }: SelectFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={containerClassName}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(inputClass, inputBorder(Boolean(error)), 'appearance-auto pr-8', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  error?: string | null
}

export function Checkbox({ label, error, id: idProp, className, ...rest }: CheckboxProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-snug',
          error
            ? 'border-red-500 dark:border-red-400'
            : 'border-slate-200 dark:border-slate-700',
          'has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950',
        )}
      >
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-brand-600"
          {...rest}
        />
        <span className="text-slate-700 dark:text-slate-200">{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
