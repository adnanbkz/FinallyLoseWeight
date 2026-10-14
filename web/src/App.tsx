import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { Auth } from '@firebase/auth'
import { BrowserRouter, Route, Routes } from 'react-router'
import type { ApiClient } from './api/client'
import { ApiContext } from './api/context'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/ToastProvider'
import { UpdatePrompt } from './pwa/UpdatePrompt'
import { SessionGate } from './screens/gates/SessionGate'
import { AccountDeletedScreen } from './screens/info/AccountDeletedScreen'
import { InstallScreen } from './screens/info/InstallScreen'
import { PrivacyScreen } from './screens/info/PrivacyScreen'

export interface AppProps {
  auth: Auth
  api: ApiClient
  queryClient: QueryClient
}

export function App({ auth, api, queryClient }: AppProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ApiContext.Provider value={api}>
          <AuthProvider auth={auth}>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public pages, available with or without a session. */}
                  <Route path="/privacidad" element={<PrivacyScreen />} />
                  <Route path="/instalar" element={<InstallScreen />} />
                  <Route path="/cuenta-borrada" element={<AccountDeletedScreen />} />
                  <Route path="*" element={<SessionGate />} />
                </Routes>
                <UpdatePrompt />
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </ApiContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
