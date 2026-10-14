import { Link, useLocation } from 'react-router'
import { CalendarDays, History, TrendingDown, UserRound } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '../ui/styles'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  isActive: (pathname: string) => boolean
}

const TABS: Tab[] = [
  { to: '/', label: 'Hoy', Icon: CalendarDays, isActive: (p) => p === '/' || p.startsWith('/dia/') },
  { to: '/historial', label: 'Historial', Icon: History, isActive: (p) => p.startsWith('/historial') },
  { to: '/progreso', label: 'Progreso', Icon: TrendingDown, isActive: (p) => p.startsWith('/progreso') },
  { to: '/perfil', label: 'Perfil', Icon: UserRound, isActive: (p) => p.startsWith('/perfil') },
]

export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map(({ to, label, Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                  active
                    ? 'text-brand-700 dark:text-brand-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                    active && 'bg-brand-100 dark:bg-brand-950',
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
