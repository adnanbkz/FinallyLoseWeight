// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loadConfig, normalizeApiBaseUrl } from './config'

const full = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'flw.web.app',
  VITE_FIREBASE_PROJECT_ID: 'flw',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
  VITE_API_BASE_URL: 'https://flw-api.azurewebsites.net/',
}

describe('loadConfig', () => {
  it('reports every missing variable instead of crashing', () => {
    const result = loadConfig({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toHaveLength(5)
  })

  it('accepts a complete configuration and normalizes the API origin', () => {
    const result = loadConfig(full)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config.apiBaseUrl).toBe('https://flw-api.azurewebsites.net')
      expect(result.config.firebase.projectId).toBe('flw')
    }
  })

  it('flags an invalid API URL', () => {
    const result = loadConfig({ ...full, VITE_API_BASE_URL: 'flw-api' })
    expect(result).toEqual({ ok: false, missing: [], invalid: ['VITE_API_BASE_URL'] })
  })
})

describe('normalizeApiBaseUrl', () => {
  it.each([
    ['https://api.test', 'https://api.test'],
    ['https://api.test///', 'https://api.test'],
    ['https://api.test/api', 'https://api.test'],
    ['http://localhost:5080/api/', 'http://localhost:5080'],
    ['ftp://api.test', null],
    ['not a url', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeApiBaseUrl(input)).toBe(expected)
  })
})
