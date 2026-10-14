import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../../auth/context'
import { useProfile } from '../../api/hooks'
import { isApiError } from '../../api/errors'
import { needsPrivacyReconsent } from '../../api/types'
import { AppShell } from '../../components/layout/AppShell'
import { LoadingBlock } from '../../components/ui/States'
import { AuthScreen } from '../auth/AuthScreen'
import { VerifyEmailScreen } from '../auth/VerifyEmailScreen'
import { HistoryScreen } from '../history/HistoryScreen'
import { ProfileScreen } from '../profile/ProfileScreen'
import { TodayScreen } from '../today/TodayScreen'
import { FatalErrorScreen } from './FatalErrorScreen'
import { NotInvitedScreen } from './NotInvitedScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { ReconsentScreen } from './ReconsentScreen'
import { SplashScreen } from './SplashScreen'

// Recharts is only needed on this screen: keep it out of the initial bundle.
const ProgressScreen = lazy(() => import('../progress/ProgressScreen'))

/** Signed out → login; unverified → verify; then the profile decides what to show. */
export function SessionGate() {
  const { status, user } = useAuth()
  if (status === 'loading') return <SplashScreen />
  if (!user) return <AuthScreen />
  if (!user.emailVerified) return <VerifyEmailScreen />
  return <ProfileGate />
}

function ProfileGate() {
  const { signOut } = useAuth()
  const profile = useProfile()

  if (profile.isPending) return <SplashScreen message="Cargando tu diario…" />

  // Access changes always win, even over a cached profile (invitation removed, profile deleted elsewhere…).
  const error = profile.error
  if (isApiError(error, 'not_invited'))
    return <NotInvitedScreen onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
  if (isApiError(error, 'email_not_verified')) return <VerifyEmailScreen />
  if (isApiError(error, 'profile_not_found')) return <OnboardingScreen />

  // Any other error only blocks the app when nothing is cached yet. A failed background refetch (focus,
  // reconnect, cold start, 429…) keeps the last profile in TanStack Query v5, and swapping the app for an
  // error screen would unmount any open sheet and lose what the user was typing.
  if (profile.data === undefined) {
    return (
      <FatalErrorScreen
        error={error}
        onRetry={() => void profile.refetch()}
        retrying={profile.isFetching}
        onSignOut={() => void signOut()}
      />
    )
  }

  if (needsPrivacyReconsent(profile.data)) return <ReconsentScreen profile={profile.data} />

  return <MainRoutes />
}

function MainRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route path="dia/:date" element={<TodayScreen />} />
        <Route path="historial" element={<HistoryScreen />} />
        <Route
          path="progreso"
          element={
            <Suspense fallback={<LoadingBlock className="min-h-dvh" />}>
              <ProgressScreen />
            </Suspense>
          }
        />
        <Route path="perfil" element={<ProfileScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
