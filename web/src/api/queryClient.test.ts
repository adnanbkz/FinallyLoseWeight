import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { queryKeys } from './hooks'
import { createQueryClient, shouldRetry } from './queryClient'

const profile = { displayName: 'Ana' }

describe('createQueryClient', () => {
  it('re-checks the profile when a data query reports profile_required', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(queryKeys.me, profile)

    await queryClient
      .fetchQuery({
        queryKey: queryKeys.day('2026-10-14'),
        queryFn: () => Promise.reject(new ApiError({ status: 403, code: 'profile_required' })),
        retry: false,
      })
      .catch(() => undefined)

    expect(queryClient.getQueryState(queryKeys.me)?.isInvalidated).toBe(true)
  })

  it('re-checks the profile when a mutation reports not_invited', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(queryKeys.me, profile)

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new ApiError({ status: 403, code: 'not_invited' })),
    })
    await mutation.execute(undefined).catch(() => undefined)

    expect(queryClient.getQueryState(queryKeys.me)?.isInvalidated).toBe(true)
  })

  it('ignores other errors', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(queryKeys.me, profile)

    await queryClient
      .fetchQuery({
        queryKey: queryKeys.day('2026-10-14'),
        queryFn: () => Promise.reject(new ApiError({ status: 404, code: 'not_found' })),
        retry: false,
      })
      .catch(() => undefined)

    expect(queryClient.getQueryState(queryKeys.me)?.isInvalidated).toBe(false)
  })
})

describe('shouldRetry', () => {
  it('does not retry deterministic 4xx errors but retries 429 and network errors', () => {
    expect(shouldRetry(0, new ApiError({ status: 403, code: 'profile_required' }))).toBe(false)
    expect(shouldRetry(0, new ApiError({ status: 429 }))).toBe(true)
    expect(shouldRetry(0, new ApiError({ status: 0, code: 'network_error' }))).toBe(true)
    expect(shouldRetry(2, new ApiError({ status: 503 }))).toBe(false)
  })
})
