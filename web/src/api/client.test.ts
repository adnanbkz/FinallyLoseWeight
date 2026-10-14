// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildUrl, createApiClient } from './client'
import { ApiError } from './errors'

const json = (status: number, body: unknown, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })

function setup(responses: Array<Response | Error>) {
  const fetchImpl = vi.fn<typeof fetch>()
  for (const r of responses) {
    if (r instanceof Error) fetchImpl.mockRejectedValueOnce(r)
    else fetchImpl.mockResolvedValueOnce(r)
  }
  const getToken = vi.fn(async (force: boolean) => (force ? 'fresh-token' : 'cached-token'))
  const api = createApiClient({ baseUrl: 'https://api.example.com', getToken, fetchImpl })
  return { api, fetchImpl, getToken }
}

describe('createApiClient', () => {
  it('prefixes the base URL and sends the bearer token', async () => {
    const { api, fetchImpl } = setup([json(200, { displayName: 'Ana' })])
    await expect(api.get('/api/me')).resolves.toEqual({ displayName: 'Ana' })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('https://api.example.com/api/me')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer cached-token')
    expect(init?.cache).toBe('no-store')
  })

  it('sends JSON bodies and query strings', async () => {
    const { api, fetchImpl } = setup([json(200, []), json(200, { weightKg: 72.5 })])
    await api.get('/api/stats', { query: { from: '2026-09-15', to: '2026-10-14', skip: undefined } })
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.com/api/stats?from=2026-09-15&to=2026-10-14')
    await api.put('/api/weights/2026-10-14', { weightKg: 72.5 })
    const init = fetchImpl.mock.calls[1]![1]!
    expect(init.method).toBe('PUT')
    expect(init.body).toBe('{"weightKg":72.5}')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('retries once with a forced token refresh on 401', async () => {
    const { api, fetchImpl, getToken } = setup([json(401, { title: 'Unauthorized' }, 'application/problem+json'), json(200, { ok: true })])
    await expect(api.get('/api/me')).resolves.toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenNthCalledWith(1, false)
    expect(getToken).toHaveBeenNthCalledWith(2, true)
    expect((fetchImpl.mock.calls[1]![1]!.headers as Record<string, string>).Authorization).toBe('Bearer fresh-token')
  })

  it('gives up after the retry still returns 401', async () => {
    const { api, fetchImpl } = setup([json(401, {}, 'application/problem+json'), json(401, {}, 'application/problem+json')])
    await expect(api.get('/api/me')).rejects.toMatchObject({ status: 401 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry 401 reauth_required', async () => {
    const { api, fetchImpl } = setup([
      json(401, { title: 'Reauthentication required', code: 'reauth_required' }, 'application/problem+json'),
    ])
    const error = await api.delete('/api/me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('reauth_required')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('parses problem+json errors into ApiError', async () => {
    const { api } = setup([json(422, { title: 'Weight required', code: 'weight_required' }, 'application/problem+json')])
    await expect(api.post('/api/cardio/estimate', {})).rejects.toMatchObject({ status: 422, code: 'weight_required' })
  })

  it('returns undefined for 204', async () => {
    const { api } = setup([new Response(null, { status: 204 })])
    await expect(api.delete('/api/weights/2026-10-14')).resolves.toBeUndefined()
  })

  it('maps fetch failures to a network ApiError', async () => {
    const { api } = setup([new TypeError('Failed to fetch')])
    await expect(api.get('/api/me')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('fails with not_authenticated when there is no user', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const api = createApiClient({ baseUrl: 'https://api.example.com', getToken: async () => null, fetchImpl })
    await expect(api.get('/api/me')).rejects.toMatchObject({ status: 401, code: 'not_authenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('buildUrl', () => {
  it('joins paths and skips empty params', () => {
    expect(buildUrl('https://x.test', 'api/me')).toBe('https://x.test/api/me')
    expect(buildUrl('https://x.test', '/api/x', { a: null, b: '' })).toBe('https://x.test/api/x?b=')
  })
})
