export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

export interface AppConfig {
  firebase: FirebaseWebConfig
  /** API origin without trailing slash and without `/api`. */
  apiBaseUrl: string
}

export type ConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; missing: string[]; invalid: string[] }

type EnvSource = Partial<Record<keyof ImportMetaEnv, string | undefined>>

/** Normalizes the API origin: trims, removes trailing slashes and a trailing `/api`. */
export function normalizeApiBaseUrl(raw: string): string | null {
  let value = raw.trim()
  while (value.endsWith('/')) value = value.slice(0, -1)
  if (value.toLowerCase().endsWith('/api')) value = value.slice(0, -4)
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return value
  } catch {
    return null
  }
}

export function loadConfig(env: EnvSource = import.meta.env): ConfigResult {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_API_BASE_URL',
  ] as const

  const read = (key: (typeof required)[number]) => (env[key] ?? '').trim()
  const missing = required.filter((key) => read(key) === '')
  const invalid: string[] = []

  const apiBaseUrl = read('VITE_API_BASE_URL') ? normalizeApiBaseUrl(read('VITE_API_BASE_URL')) : null
  if (read('VITE_API_BASE_URL') && apiBaseUrl === null) invalid.push('VITE_API_BASE_URL')

  if (missing.length > 0 || invalid.length > 0 || apiBaseUrl === null) {
    return { ok: false, missing: [...missing], invalid }
  }

  return {
    ok: true,
    config: {
      apiBaseUrl,
      firebase: {
        apiKey: read('VITE_FIREBASE_API_KEY'),
        authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: read('VITE_FIREBASE_PROJECT_ID'),
        appId: read('VITE_FIREBASE_APP_ID'),
      },
    },
  }
}
