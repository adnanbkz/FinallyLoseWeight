import { CalendarDays, History, TrendingDown, UserRound } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export interface NavItem {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  isActive: (pathname: string) => boolean
}

/** Main sections, shared by the bottom tab bar (phones) and the side navigation (tablet / desktop). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Hoy', Icon: CalendarDays, isActive: (p) => p === '/' || p.startsWith('/dia/') },
  { to: '/historial', label: 'Historial', Icon: History, isActive: (p) => p.startsWith('/historial') },
  { to: '/progreso', label: 'Progreso', Icon: TrendingDown, isActive: (p) => p.startsWith('/progreso') },
  { to: '/perfil', label: 'Perfil', Icon: UserRound, isActive: (p) => p.startsWith('/perfil') },
]

/**
 * Content column widths. `wide` is for the main sections (grids open up on tablet / desktop); `narrow`
 * keeps long-form text (privacy, install guide) at a readable line length.
 */
export const CONTENT_WIDTH = {
  wide: 'max-w-lg md:max-w-3xl lg:max-w-5xl',
  narrow: 'max-w-lg md:max-w-2xl',
} as const

export type ContentWidth = keyof typeof CONTENT_WIDTH
