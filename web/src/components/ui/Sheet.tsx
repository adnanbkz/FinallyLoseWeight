import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useKeyboardInset } from '../../lib/useKeyboardInset'
import { cn } from './styles'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** When false, the backdrop and Escape do not close it (e.g. while saving). */
  dismissible?: boolean
}

// Open sheets, top-most last: only the top one reacts to Escape/Tab.
const openSheets: symbol[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Modal bottom sheet on phones, centered dialog on wider screens. */
export function Sheet(props: SheetProps) {
  if (!props.open) return null
  return createPortal(<SheetPanel {...props} />, document.body)
}

function SheetPanel({ onClose, title, description, children, footer, dismissible = true }: SheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset()
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  // Focus management, Escape, Tab trap and background scroll lock.
  useEffect(() => {
    const token = Symbol('sheet')
    openSheets.push(token)
    const isTop = () => openSheets[openSheets.length - 1] === token
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const autofocus = panel?.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
    ;(autofocus ?? panel)?.focus({ preventScroll: true })

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openSheets.splice(openSheets.indexOf(token), 1)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-w-lg animate-sheet-in flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl dark:bg-slate-900',
          'max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)]',
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Cerrar"
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div
            className={cn(
              'border-t border-slate-200 px-5 pt-3 dark:border-slate-800',
              keyboardInset ? 'pb-3' : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
