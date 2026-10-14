import { ApiError, parseApiError } from './errors'

/** Returns a Firebase ID token (forcing a refresh when asked) or null when signed out. */
export type TokenProvider = (forceRefresh: boolean) => Promise<string | null>

export interface ApiClientOptions {
  /** API origin without trailing slash and without `/api`. */
  baseUrl: string
  getToken: TokenProvider
  fetchImpl?: typeof fetch
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  signal?: AbortSignal
  query?: QueryParams
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>
  delete(path: string, options?: RequestOptions): Promise<void>
  /** Authenticated request returning the raw (2xx) Response, e.g. for file downloads. */
  raw(method: string, path: string, options?: RequestOptions): Promise<Response>
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function firebaseCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return null
}

export function createApiClient({ baseUrl, getToken, fetchImpl }: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))

  async function token(forceRefresh: boolean): Promise<string> {
    let value: string | null
    try {
      value = await getToken(forceRefresh)
    } catch (error) {
      if (firebaseCode(error) === 'auth/network-request-failed') {
        throw new ApiError({ status: 0, code: 'network_error' })
      }
      throw new ApiError({ status: 401, code: 'not_authenticated' })
    }
    if (!value) throw new ApiError({ status: 401, code: 'not_authenticated' })
    return value
  }

  async function attempt(
    method: string,
    url: string,
    body: unknown,
    signal: AbortSignal | undefined,
    forceRefresh: boolean,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json, application/problem+json',
      Authorization: `Bearer ${await token(forceRefresh)}`,
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    try {
      return await doFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        // Health data: never store responses in the HTTP cache.
        cache: 'no-store',
        credentials: 'omit',
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new ApiError({ status: 0, code: 'network_error' })
    }
  }

  async function send(method: string, path: string, body: unknown, options?: RequestOptions): Promise<Response> {
    const url = buildUrl(baseUrl, path, options?.query)
    let response = await attempt(method, url, body, options?.signal, false)
    if (response.status === 401) {
      const first = await parseApiError(response)
      // A stale-login 401 is answered with re-authentication, not with a token refresh.
      if (first.code === 'reauth_required') throw first
      response = await attempt(method, url, body, options?.signal, true)
    }
    if (!response.ok) throw await parseApiError(response)
    return response
  }

  async function json<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T
    const text = await response.text()
    if (text.trim() === '') return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError({ status: response.status, code: 'invalid_response' })
    }
  }

  return {
    get: async <T>(path: string, options?: RequestOptions) => json<T>(await send('GET', path, undefined, options)),
    post: async <T>(path: string, body: unknown, options?: RequestOptions) =>
      json<T>(await send('POST', path, body, options)),
    put: async <T>(path: string, body: unknown, options?: RequestOptions) =>
      json<T>(await send('PUT', path, body, options)),
    delete: async (path: string, options?: RequestOptions) => {
      await send('DELETE', path, undefined, options)
    },
    raw: (method: string, path: string, options?: RequestOptions) => send(method, path, undefined, options),
  }
}
