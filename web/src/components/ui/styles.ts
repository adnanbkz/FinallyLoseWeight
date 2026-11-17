/** Joins class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghostBrand' | 'ghostDanger' | 'ghostInverse' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-[color,background-color,box-shadow,transform] duration-150 select-none active:scale-[0.98] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-glow hover:from-brand-600 hover:to-brand-700 ' +
    'disabled:shadow-none dark:from-brand-400 dark:to-brand-500 dark:text-brand-950 dark:hover:from-brand-300 dark:hover:to-brand-400',
  secondary:
    'bg-brand-50 text-brand-700 ring-1 ring-brand-600/10 hover:bg-brand-100 active:bg-brand-200 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/20 dark:hover:bg-brand-400/15',
  ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800',
  ghostBrand: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-400/10',
  ghostDanger: 'text-red-700 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50',
  /** For dark surfaces in light mode (and light surfaces in dark mode), e.g. the update toast. */
  ghostInverse: 'text-white hover:bg-white/10 active:bg-white/20 dark:text-slate-700 dark:hover:bg-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400',
  outline:
    'bg-white text-slate-800 shadow-card ring-1 ring-slate-900/10 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/10',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 rounded-xl px-3.5 text-sm',
  md: 'min-h-12 px-4 text-base',
  lg: 'min-h-14 px-5 text-lg',
  icon: 'size-11 shrink-0 rounded-full',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false): string {
  return cn(base, variants[variant], sizes[size], block && 'w-full')
}

export const inputClass =
  'block w-full min-h-12 rounded-2xl border bg-white px-3.5 text-base text-slate-900 shadow-xs placeholder:text-slate-400 ' +
  'transition-[border-color,box-shadow] focus:outline-none focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500 ' +
  'disabled:opacity-60 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-400/20'

export const inputBorder = (invalid: boolean) =>
  invalid ? 'border-red-500 dark:border-red-400' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600'

/** Raised surface: white card with a hairline ring and a soft shadow (glassy slate in dark mode). */
export const surfaceClass = 'bg-white shadow-card ring-1 ring-slate-900/[0.06] dark:bg-slate-900/70 dark:shadow-none dark:ring-white/[0.07]'

export const cardClass = cn('rounded-3xl p-4 md:p-5', surfaceClass)

/**
 * Accent per metric, reused by cards, charts and the history so each kind of data keeps its colour everywhere.
 * Static class strings (Tailwind only generates classes it can see).
 */
export type Tone = 'brand' | 'weight' | 'meals' | 'steps' | 'cardio' | 'slate'

export const toneChip: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-600/10 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/20',
  weight: 'bg-violet-50 text-violet-600 ring-violet-600/10 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20',
  meals: 'bg-orange-50 text-orange-600 ring-orange-600/10 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/20',
  steps: 'bg-sky-50 text-sky-600 ring-sky-600/10 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20',
  cardio: 'bg-rose-50 text-rose-600 ring-rose-600/10 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-900/5 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10',
}
