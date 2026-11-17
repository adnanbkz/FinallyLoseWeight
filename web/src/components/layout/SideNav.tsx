import { Link, useLocation } from 'react-router'
import { useProfile } from '../../api/hooks'
import { cn } from '../ui/styles'
import { Logo } from './Logo'
import { NAV_ITEMS } from './navItems'

/**
 * Side navigation from the `md` breakpoint: a compact rail on tablets (icon + label stacked) that becomes a
 * full sidebar with the app name and the user's chip on desktops (`lg`).
 */
export function SideNav() {
  const { pathname } = useLocation()
  const profile = useProfile()
  const name = profile.data?.displayName.trim() ?? ''
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden w-24 flex-col border-r border-slate-900/[0.06] bg-white/70 pt-safe backdrop-blur-xl md:flex lg:w-64',
        'dark:border-white/[0.06] dark:bg-slate-900/50',
      )}
    >
      <Link
        to="/"
        className="flex items-center justify-center gap-3 px-4 py-6 lg:justify-start lg:px-6"
        aria-label="FinallyLoseWeight, ir a Hoy"
      >
        <Logo className="size-10 shrink-0 drop-shadow-sm" />
        <span className="hidden text-lg leading-tight font-extrabold tracking-tight text-slate-900 lg:block dark:text-white">
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
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors',
                  'lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-[0.95rem]',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300'
                    : 'text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
                )}
              >
                {active && (
                  <span className="absolute top-1/2 -left-3 hidden h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-500 lg:-left-4 lg:block" aria-hidden="true" />
                )}
                <Icon className="size-[1.35rem] shrink-0" aria-hidden="true" strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
      {name && (
        <Link
          to="/perfil"
          className="mx-3 mt-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-3 rounded-2xl p-2 hover:bg-slate-900/[0.04] lg:mx-4 lg:justify-start dark:hover:bg-white/5"
          aria-label={`Tu perfil, ${name}`}
        >
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-sm font-bold text-white shadow-glow"
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Ver perfil</span>
          </span>
        </Link>
      )}
    </nav>
  )
}
