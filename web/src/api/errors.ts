import type { ApiErrorCode, ProblemDetails } from './types'

/** Client-side pseudo codes (never sent by the API). */
export type ClientErrorCode = 'network_error' | 'not_authenticated' | 'invalid_response'

export type ErrorCode = ApiErrorCode | ClientErrorCode

export interface ApiErrorInit {
  status: number
  code?: string | null
  title?: string | null
  detail?: string | null
  errors?: Record<string, string[]> | null
  retryAfterSeconds?: number | null
}

/** Error thrown by the API client. `code` is the problem+json `code` extension, when present. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly title: string
  readonly detail: string | null
  /** Validation errors keyed by camelCase field name. */
  readonly errors: Record<string, string[]> | null
  readonly retryAfterSeconds: number | null

  constructor(init: ApiErrorInit) {
    const title = init.title?.trim() || defaultTitle(init.status)
    super(init.code ? `${init.status} ${init.code}: ${title}` : `${init.status}: ${title}`)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code ?? null
    this.title = title
    this.detail = init.detail ?? null
    this.errors = init.errors ?? null
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
  }

  get isValidation(): boolean {
    return this.status === 400 && this.errors !== null && Object.keys(this.errors).length > 0
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

function defaultTitle(status: number): string {
  if (status === 0) return 'Network error'
  if (status === 400) return 'Bad Request'
  if (status === 401) return 'Unauthorized'
  if (status === 403) return 'Forbidden'
  if (status === 404) return 'Not Found'
  if (status === 422) return 'Unprocessable Entity'
  if (status === 429) return 'Too Many Requests'
  if (status >= 500) return 'Server Error'
  return `HTTP ${status}`
}

/** "WeightKg", "$.weightKg", "body.weightKg" → "weightKg". */
export function normalizeFieldKey(key: string): string {
  let k = key.trim()
  k = k.replace(/^\$\.?/, '')
  const lastDot = k.lastIndexOf('.')
  if (lastDot >= 0) k = k.slice(lastDot + 1)
  return k ? k.charAt(0).toLowerCase() + k.slice(1) : key
}

function normalizeErrors(raw: unknown): Record<string, string[]> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const messages = Array.isArray(value)
      ? value.filter((m): m is string => typeof m === 'string')
      : typeof value === 'string'
        ? [value]
        : []
    if (messages.length === 0) continue
    const field = normalizeFieldKey(key)
    result[field] = [...(result[field] ?? []), ...messages]
  }
  return Object.keys(result).length > 0 ? result : null
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000))
  return null
}

/** Builds an ApiError from a non-2xx response (application/problem+json when available). */
export async function parseApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails | null = null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('json')) {
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object') problem = body as ProblemDetails
    } catch {
      problem = null
    }
  }
  return new ApiError({
    status: response.status,
    code: typeof problem?.code === 'string' ? problem.code : null,
    title: typeof problem?.title === 'string' ? problem.title : null,
    detail: typeof problem?.detail === 'string' ? problem.detail : null,
    errors: normalizeErrors(problem?.errors),
    retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
  })
}

const CODE_MESSAGES: Record<ErrorCode, string> = {
  network_error: 'No se ha podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  not_authenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  invalid_response: 'El servidor ha devuelto una respuesta inesperada. Inténtalo de nuevo.',
  reauth_required: 'Por seguridad, vuelve a identificarte para continuar.',
  email_not_verified: 'Tienes que verificar tu email antes de continuar.',
  not_invited: 'Esta app es solo por invitación y tu email no está en la lista.',
  profile_required: 'Completa tu perfil para empezar a usar la app.',
  not_found: 'No lo hemos encontrado. Puede que ya se haya borrado.',
  profile_not_found: 'Todavía no has completado tu perfil.',
  weight_required: 'Necesitamos tu peso para calcular las calorías. Regístralo o indícalo aquí.',
}

/** Friendly Spanish message for any error thrown while talking to the API. */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    if (error instanceof Error && error.name === 'AbortError') return 'La petición se ha cancelado.'
    return 'Algo ha ido mal. Inténtalo de nuevo.'
  }
  if (error.code && error.code in CODE_MESSAGES) return CODE_MESSAGES[error.code as ErrorCode]
  switch (error.status) {
    case 0:
      return CODE_MESSAGES.network_error
    case 400:
      return error.isValidation ? 'Revisa los datos marcados.' : 'Algunos datos no son válidos. Revísalos.'
    case 401:
      return CODE_MESSAGES.not_authenticated
    case 403:
      return 'No tienes permiso para hacer esto.'
    case 404:
      return CODE_MESSAGES.not_found
    case 409:
      return 'Ha habido un conflicto con otro cambio. Recarga e inténtalo de nuevo.'
    case 413:
      return 'Los datos enviados son demasiado grandes.'
    case 422:
      return 'No se ha podido procesar la petición. Revisa los datos.'
    case 429:
      return error.retryAfterSeconds
        ? `Demasiadas peticiones seguidas. Espera ${error.retryAfterSeconds} s y vuelve a intentarlo.`
        : 'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.'
    case 502:
    case 503:
    case 504:
      return 'El servidor no está disponible ahora mismo (puede estar arrancando). Inténtalo de nuevo en unos segundos.'
    default:
      return error.status >= 500
        ? 'Algo ha fallado en el servidor. Inténtalo de nuevo en unos minutos.'
        : 'Algo ha ido mal. Inténtalo de nuevo.'
  }
}

/** First validation message per field (camelCase keys), or an empty object. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.errors) return {}
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.errors)) {
    const first = messages[0]
    if (first) result[field] = first
  }
  return result
}
