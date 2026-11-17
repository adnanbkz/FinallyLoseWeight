import { Link, useLocation } from 'react-router'
import { cn } from '../ui/styles'
import { NAV_ITEMS } from './navItems'

/** Floating, frosted bottom navigation for phones; replaced by <SideNav> from the `md` breakpoint. */
export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:hidden',
        'rounded-[1.75rem] bg-white/80 p-1.5 shadow-float ring-1 ring-slate-900/[0.07] backdrop-blur-xl backdrop-saturate-150',
        'dark:bg-slate-900/80 dark:ring-white/10',
      )}
    >
      <ul className="grid grid-cols-4 gap-1">
        {NAV_ITEMS.map(({ to, label, Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] text-[0.7rem] font-semibold transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <Icon className="size-[1.4rem]" aria-hidden="true" strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
