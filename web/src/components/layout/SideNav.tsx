import { Link, useLocation } from 'react-router'
import { cn } from '../ui/styles'
import { Logo } from './Logo'
import { NAV_ITEMS } from './navItems'

/**
 * Side navigation from the `md` breakpoint: a compact rail on tablets (icon + label stacked) that becomes a
 * full sidebar with the app name on desktops (`lg`).
 */
export function SideNav() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden w-24 flex-col border-r border-slate-200 bg-white pt-safe md:flex lg:w-64',
        'dark:border-slate-800 dark:bg-slate-900',
      )}
    >
      <Link
        to="/"
        className="flex items-center justify-center gap-3 px-4 py-5 lg:justify-start lg:px-6"
        aria-label="FinallyLoseWeight, ir a Hoy"
      >
        <Logo className="size-10 shrink-0" />
        <span className="hidden text-lg leading-tight font-bold tracking-tight text-slate-900 lg:block dark:text-slate-50">
          Finally<span className="text-brand-600 dark:text-brand-400">LoseWeight</span>
        </span>
      </Link>
      <ul className="flex flex-col gap-1 px-3 pt-2 lg:px-4">
        {NAV_ITEMS.map(({ to, label, Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors',
                  'lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base',
                  active
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                )}
              >
                <Icon className="size-6 shrink-0" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
