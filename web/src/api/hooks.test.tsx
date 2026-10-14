import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createFakeApi } from '../test/utils'
import type { ApiClient } from './client'
import { ApiContext } from './context'
import {
  queryKeys,
  useCreateMeal,
  useDeleteCardio,
  useSaveSteps,
  useSaveWeight,
  useUpdateCardio,
  useUpdateMeal,
} from './hooks'
import type { CardioInput, MealInput } from './types'

const OLD_DAY = '2026-10-13'
const NEW_DAY = '2026-10-14'
const OTHER_DAY = '2026-10-01'

const mealInput: MealInput = { date: NEW_DAY, mealType: 'lunch', description: 'Pollo', kcal: 650 }
const cardioInput: CardioInput = { date: NEW_DAY, machine: 'incline-treadmill', durationMin: 30, avgSpeedKmh: 4.8, inclinePercent: 12 }

/** Query client with cached (inactive) data for three days, a stats range and a cardio estimate. */
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const seeded: QueryKey[] = [
    queryKeys.day(OLD_DAY),
    queryKeys.day(NEW_DAY),
    queryKeys.day(OTHER_DAY),
    queryKeys.statsRange('2026-09-15', NEW_DAY),
    queryKeys.estimate(cardioInput),
    queryKeys.me,
  ]
  for (const key of seeded) queryClient.setQueryData(key, { cached: true })
  const api = createFakeApi()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api as unknown as ApiClient}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  )
  const invalidated = () =>
    seeded.filter((key) => queryClient.getQueryState(key)?.isInvalidated).map((key) => JSON.stringify(key))
  return { api, wrapper, invalidated }
}

const key = (k: QueryKey) => JSON.stringify(k)

describe('diary mutations invalidate what they change', () => {
  it('moving a meal to another day refreshes the old day, the new day and the stats', async () => {
    const { api, wrapper, invalidated } = setup()
    api.put.mockResolvedValue({ ...mealInput, id: 'm1', createdAt: '2026-10-13T12:00:00Z' })
    const { result } = renderHook(() => useUpdateMeal(), { wrapper })

    await act(() => result.current.mutateAsync({ id: 'm1', input: mealInput, previousDate: OLD_DAY }))

    expect(api.put).toHaveBeenCalledWith('/api/meals/m1', mealInput)
    expect(invalidated()).toEqual(
      [key(queryKeys.day(OLD_DAY)), key(queryKeys.day(NEW_DAY)), key(queryKeys.statsRange('2026-09-15', NEW_DAY))],
    )
  })

  it('moving a cardio session to another day refreshes both days (and keeps unrelated caches)', async () => {
    const { api, wrapper, invalidated } = setup()
    api.put.mockResolvedValue({ id: 'c1', date: NEW_DAY })
    const { result } = renderHook(() => useUpdateCardio(), { wrapper })

    await act(() => result.current.mutateAsync({ id: 'c1', input: cardioInput, previousDate: OLD_DAY }))

    expect(api.put).toHaveBeenCalledWith('/api/cardio/c1', cardioInput)
    expect(invalidated()).toContain(key(queryKeys.day(OLD_DAY)))
    expect(invalidated()).toContain(key(queryKeys.day(NEW_DAY)))
    expect(invalidated()).not.toContain(key(queryKeys.day(OTHER_DAY)))
    expect(invalidated()).not.toContain(key(queryKeys.me))
  })

  it('creating a meal refreshes the day returned by the API', async () => {
    const { api, wrapper, invalidated } = setup()
    api.post.mockResolvedValue({ ...mealInput, id: 'm2', createdAt: '2026-10-14T12:00:00Z' })
    const { result } = renderHook(() => useCreateMeal(), { wrapper })

    await act(() => result.current.mutateAsync(mealInput))

    expect(invalidated()).toEqual([key(queryKeys.day(NEW_DAY)), key(queryKeys.statsRange('2026-09-15', NEW_DAY))])
  })

  it('saving a weight also refreshes cardio estimates (they use the latest weight ≤ date)', async () => {
    const { api, wrapper, invalidated } = setup()
    api.put.mockResolvedValue({ date: OLD_DAY, weightKg: 70, note: null })
    const { result } = renderHook(() => useSaveWeight(), { wrapper })

    await act(() => result.current.mutateAsync({ date: OLD_DAY, input: { weightKg: 70 } }))

    expect(api.put).toHaveBeenCalledWith(`/api/weights/${OLD_DAY}`, { weightKg: 70 })
    expect(invalidated()).toContain(key(queryKeys.day(OLD_DAY)))
    expect(invalidated()).toContain(key(queryKeys.estimate(cardioInput)))
    expect(invalidated()).not.toContain(key(queryKeys.day(NEW_DAY)))
  })

  it('steps and cardio deletions refresh only their own day and the stats', async () => {
    const { api, wrapper, invalidated } = setup()
    api.put.mockResolvedValue({ date: OLD_DAY, steps: 8500 })
    api.delete.mockResolvedValue(undefined)
    const steps = renderHook(() => useSaveSteps(), { wrapper })
    const removeCardio = renderHook(() => useDeleteCardio(), { wrapper })

    await act(() => steps.result.current.mutateAsync({ date: OLD_DAY, input: { steps: 8500 } }))
    await act(() => removeCardio.result.current.mutateAsync({ id: 'c9', date: OTHER_DAY }))

    expect(api.delete).toHaveBeenCalledWith('/api/cardio/c9')
    expect(invalidated()).toEqual([
      key(queryKeys.day(OLD_DAY)),
      key(queryKeys.day(OTHER_DAY)),
      key(queryKeys.statsRange('2026-09-15', NEW_DAY)),
    ])
  })
})
