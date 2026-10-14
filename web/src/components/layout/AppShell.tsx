import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { TabBar } from './TabBar'

/** Authenticated layout: screen content + bottom tab bar. */
export function AppShell() {
  return (
    <div className="min-h-dvh">
      <Outlet />
      <TabBar />
    </div>
  )
}

/** Scrollable content area that leaves room for the tab bar and the home indicator. */
export function ScreenBody({ children, withTabBar = true }: { children: ReactNode; withTabBar?: boolean }) {
  return (
    <main
      className="mx-auto flex max-w-lg flex-col gap-4 px-safe pt-4"
      style={{
        paddingBottom: withTabBar
          ? 'calc(5.5rem + env(safe-area-inset-bottom))'
          : 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </main>
  )
}
