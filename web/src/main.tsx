import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { createApiClient } from './api/client'
import { createQueryClient } from './api/queryClient'
import { initFirebaseAuth } from './auth/firebase'
import { loadConfig } from './config'
import { listenForInstallPrompt } from './pwa/installPrompt'
import { ConfigErrorScreen } from './screens/gates/ConfigErrorScreen'

// Must be registered early: Chrome fires beforeinstallprompt shortly after load.
listenForInstallPrompt()

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')
const root = createRoot(container)

function bootstrap() {
  const result = loadConfig()
  if (!result.ok) {
    return <ConfigErrorScreen missing={result.missing} invalid={result.invalid} />
  }
  const { config } = result
  try {
    const auth = initFirebaseAuth(config.firebase)
    const api = createApiClient({
      baseUrl: config.apiBaseUrl,
      getToken: async (forceRefresh) => (auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null),
    })
    return <App auth={auth} api={api} queryClient={createQueryClient()} />
  } catch (error) {
    console.error('No se pudo inicializar Firebase', error)
    return (
      <ConfigErrorScreen
        missing={[]}
        invalid={['VITE_FIREBASE_*']}
        detail={error instanceof Error ? error.message : String(error)}
      />
    )
  }
}

root.render(<StrictMode>{bootstrap()}</StrictMode>)
