import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { cn } from '../ui/styles'
import { CONTENT_WIDTH, type ContentWidth } from './navItems'
import { SideNav } from './SideNav'
import { TabBar } from './TabBar'

/** Authenticated layout: bottom tab bar on phones, side navigation on tablets and desktops. */
export function AppShell() {
  return (
    <div className="min-h-dvh md:pl-24 lg:pl-64">
      <SideNav />
      <Outlet />
      <TabBar />
    </div>
  )
}

/** Scrollable content area that leaves room for the tab bar (phones only) and the home indicator. */
export function ScreenBody({
  children,
  withTabBar = true,
  width = 'wide',
  className,
}: {
  children: ReactNode
  withTabBar?: boolean
  width?: ContentWidth
  className?: string
}) {
  return (
    <main
      className={cn(
        'mx-auto flex flex-col gap-4 px-safe pt-4 md:px-8 md:pt-6',
        CONTENT_WIDTH[width],
        withTabBar
          ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10'
          : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-10',
        className,
      )}
    >
      {children}
    </main>
  )
}
