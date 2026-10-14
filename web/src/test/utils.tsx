import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { User } from '@firebase/auth'
import { vi, type Mock } from 'vitest'
import type { ApiClient, RequestOptions } from '../api/client'
import { ApiContext } from '../api/context'
import { AuthContext, type AuthContextValue } from '../auth/context'

/** ApiClient double whose methods are plain (non-generic) mocks. */
export interface FakeApi {
  get: Mock<(path: string, options?: RequestOptions) => Promise<unknown>>
  post: Mock<(path: string, body: unknown, options?: RequestOptions) => Promise<unknown>>
  put: Mock<(path: string, body: unknown, options?: RequestOptions) => Promise<unknown>>
  delete: Mock<(path: string, options?: RequestOptions) => Promise<void>>
  raw: Mock<(method: string, path: string, options?: RequestOptions) => Promise<Response>>
}

export function createFakeApi(): FakeApi {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), raw: vi.fn() }
}

export function createFakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'signedIn',
    user: { uid: 'user-1', email: 'ana@example.com', emailVerified: true, providerData: [] } as unknown as User,
    auth: null,
    version: 1,
    redirectError: null,
    clearRedirectError: vi.fn(),
    refreshUser: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

export function renderWithProviders(
  ui: ReactElement,
  {
    api = createFakeApi(),
    auth = createFakeAuth(),
    route = '/',
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    }),
  }: { api?: FakeApi; auth?: AuthContextValue; route?: string; queryClient?: QueryClient } = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api as unknown as ApiClient}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </AuthContext.Provider>
      </ApiContext.Provider>
    </QueryClientProvider>
  )
  return { api, auth, queryClient, ...render(ui, { wrapper }) }
}
