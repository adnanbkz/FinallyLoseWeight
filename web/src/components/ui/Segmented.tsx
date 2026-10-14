import { useId, type KeyboardEvent } from 'react'
import { cn } from './styles'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  className?: string
  hideLabel?: boolean
}

/** Accessible radio group rendered as a segmented control. */
export function Segmented<T extends string>({ label, value, options, onChange, className, hideLabel = true }: SegmentedProps<T>) {
  const labelId = useId()

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((o) => o.value === value)
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    else return
    event.preventDefault()
    const option = options[next]
    if (option) {
      onChange(option.value)
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      buttons[next]?.focus()
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className={cn('text-sm font-medium text-slate-700 dark:text-slate-300', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-10 rounded-lg px-2 text-sm font-semibold transition-colors',
                selected
                  ? 'bg-white text-brand-800 shadow-sm dark:bg-slate-950 dark:text-brand-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
