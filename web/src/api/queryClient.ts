import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, isApiError } from './errors'
import { queryKeys } from './hooks'

/** 4xx errors (except 429) are deterministic: retrying them only delays the error screen. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500 && error.status !== 429) return false
  }
  return failureCount < 2
}

/**
 * Access codes that mean the session changed under the app (profile deleted from another device,
 * invitation removed…). Only `GET /api/me` drives the gates, so it has to be asked again.
 */
export function isAccessChange(error: unknown): boolean {
  return (
    isApiError(error, 'profile_required') || isApiError(error, 'not_invited') || isApiError(error, 'email_not_verified')
  )
}

export function createQueryClient(): QueryClient {
  // When any data request reports an access change, refetch the profile so the gate shows the right
  // screen (onboarding, not invited, verify email) instead of an error on every retry.
  const recheckAccess = (error: unknown, queryKey?: readonly unknown[]) => {
    if (!isAccessChange(error)) return
    if (queryKey?.[0] === queryKeys.me[0]) return // the profile query itself: the gate already reacts
    void queryClient.invalidateQueries({ queryKey: queryKeys.me })
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => recheckAccess(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error) => recheckAccess(error) }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
  return queryClient
}
