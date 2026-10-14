// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ApiError, apiErrorMessage, fieldErrorsOf, isApiError, normalizeFieldKey, parseApiError } from './errors'

const problem = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })

describe('parseApiError', () => {
  it('reads the domain code from application/problem+json', async () => {
    const error = await parseApiError(
      problem(403, { type: 'about:blank', title: 'Forbidden', status: 403, code: 'not_invited' }),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.code).toBe('not_invited')
    expect(error.title).toBe('Forbidden')
    expect(isApiError(error, 'not_invited')).toBe(true)
    expect(isApiError(error, 'not_found')).toBe(false)
  })

  it('normalizes validation errors to camelCase field keys', async () => {
    const error = await parseApiError(
      problem(400, {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { WeightKg: ['Debe estar entre 20 y 400.'], '$.note': ['Demasiado larga.'], kcal: 'Obligatorio' },
      }),
    )
    expect(error.code).toBeNull()
    expect(error.isValidation).toBe(true)
    expect(error.errors).toEqual({
      weightKg: ['Debe estar entre 20 y 400.'],
      note: ['Demasiado larga.'],
      kcal: ['Obligatorio'],
    })
    expect(fieldErrorsOf(error)).toEqual({
      weightKg: 'Debe estar entre 20 y 400.',
      note: 'Demasiado larga.',
      kcal: 'Obligatorio',
    })
  })

  it('reads Retry-After on 429', async () => {
    const error = await parseApiError(problem(429, { title: 'Too Many Requests' }, { 'Retry-After': '12' }))
    expect(error.retryAfterSeconds).toBe(12)
    expect(apiErrorMessage(error)).toContain('12 s')
  })

  it('copes with non-JSON bodies', async () => {
    const error = await parseApiError(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    expect(error.status).toBe(502)
    expect(error.code).toBeNull()
    expect(apiErrorMessage(error)).toMatch(/no está disponible/)
  })

  it('copes with malformed JSON', async () => {
    const error = await parseApiError(new Response('{nope', { status: 500, headers: { 'Content-Type': 'application/json' } }))
    expect(error.status).toBe(500)
    expect(error.errors).toBeNull()
  })
})

describe('apiErrorMessage', () => {
  it.each([
    ['reauth_required', 401, /vuelve a identificarte/],
    ['email_not_verified', 403, /verificar tu email/],
    ['not_invited', 403, /solo por invitación/],
    ['profile_required', 403, /Completa tu perfil/],
    ['not_found', 404, /No lo hemos encontrado/],
    ['profile_not_found', 404, /perfil/],
    ['weight_required', 422, /peso/],
  ])('has a Spanish message for %s', (code, status, pattern) => {
    expect(apiErrorMessage(new ApiError({ status, code }))).toMatch(pattern)
  })

  it('covers network errors and unknown errors', () => {
    expect(apiErrorMessage(new ApiError({ status: 0, code: 'network_error' }))).toMatch(/conexión/)
    expect(apiErrorMessage(new Error('boom'))).toMatch(/Algo ha ido mal/)
  })
})

describe('normalizeFieldKey', () => {
  it.each([
    ['WeightKg', 'weightKg'],
    ['$.weightKg', 'weightKg'],
    ['body.Description', 'description'],
    ['acceptPrivacy', 'acceptPrivacy'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeFieldKey(input)).toBe(expected)
  })
})
