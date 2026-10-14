import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from './context'
import type {
  Cardio,
  CardioEstimate,
  CardioInput,
  DaySummary,
  Id,
  IsoDate,
  Machine,
  Meal,
  MealInput,
  Profile,
  ProfileInput,
  Stats,
  Steps,
  StepsInput,
  Weight,
  WeightInput,
} from './types'

export const queryKeys = {
  me: ['me'] as const,
  days: ['day'] as const,
  day: (date: IsoDate) => ['day', date] as const,
  stats: ['stats'] as const,
  statsRange: (from: IsoDate, to: IsoDate) => ['stats', from, to] as const,
  machines: ['cardio', 'machines'] as const,
  estimates: ['cardio', 'estimate'] as const,
  estimate: (input: CardioInput | null) => ['cardio', 'estimate', input] as const,
}

const enc = encodeURIComponent

// ---------- Queries ----------

export function useProfile(options: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.get<Profile>('/api/me', { signal }),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  })
}

export function useDay(date: IsoDate) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.day(date),
    queryFn: ({ signal }) => api.get<DaySummary>(`/api/days/${enc(date)}`, { signal }),
  })
}

export function useStats(from: IsoDate, to: IsoDate) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.statsRange(from, to),
    queryFn: ({ signal }) => api.get<Stats>('/api/stats', { signal, query: { from, to } }),
    placeholderData: keepPreviousData,
  })
}

export function useMachines() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.machines,
    queryFn: ({ signal }) => api.get<Machine[]>('/api/cardio/machines', { signal }),
    staleTime: 60 * 60_000,
  })
}

/** Live kcal estimate. Pass `null` while the form is incomplete. Nothing is saved. */
export function useCardioEstimate(input: CardioInput | null) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.estimate(input),
    queryFn: ({ signal }) => api.post<CardioEstimate>('/api/cardio/estimate', input, { signal }),
    enabled: input !== null,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

// ---------- Mutations ----------

/** Invalidates everything derived from one diary day. */
function useDiaryInvalidation() {
  const queryClient = useQueryClient()
  return (date: IsoDate, extra: ReadonlyArray<readonly unknown[]> = []) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.day(date) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
      ...extra.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ])
}

export function useSaveProfile() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileInput) => api.put<Profile>('/api/me', input),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.me, profile)
      // dailyKcalTarget is part of every day summary.
      await queryClient.invalidateQueries({ queryKey: queryKeys.days })
    },
  })
}

export function useSaveWeight() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ date, input }: { date: IsoDate; input: WeightInput }) =>
      api.put<Weight>(`/api/weights/${enc(date)}`, input),
    // Cardio estimates depend on the latest weight ≤ date.
    onSuccess: (_data, { date }) => invalidate(date, [queryKeys.estimates]),
  })
}

export function useDeleteWeight() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: (date: IsoDate) => api.delete(`/api/weights/${enc(date)}`),
    onSuccess: (_data, date) => invalidate(date, [queryKeys.estimates]),
  })
}

export function useCreateMeal() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: (input: MealInput) => api.post<Meal>('/api/meals', input),
    onSuccess: (meal) => invalidate(meal.date),
  })
}

export function useUpdateMeal() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: MealInput; previousDate?: IsoDate }) =>
      api.put<Meal>(`/api/meals/${enc(id)}`, input),
    onSuccess: async (meal, { previousDate }) => {
      await invalidate(meal.date)
      if (previousDate && previousDate !== meal.date) await invalidate(previousDate)
    },
  })
}

export function useDeleteMeal() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ id }: { id: Id; date: IsoDate }) => api.delete(`/api/meals/${enc(id)}`),
    onSuccess: (_data, { date }) => invalidate(date),
  })
}

export function useSaveSteps() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ date, input }: { date: IsoDate; input: StepsInput }) =>
      api.put<Steps>(`/api/steps/${enc(date)}`, input),
    onSuccess: (_data, { date }) => invalidate(date),
  })
}

export function useDeleteSteps() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: (date: IsoDate) => api.delete(`/api/steps/${enc(date)}`),
    onSuccess: (_data, date) => invalidate(date),
  })
}

export function useCreateCardio() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: (input: CardioInput) => api.post<Cardio>('/api/cardio', input),
    onSuccess: (cardio) => invalidate(cardio.date),
  })
}

export function useUpdateCardio() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: CardioInput; previousDate?: IsoDate }) =>
      api.put<Cardio>(`/api/cardio/${enc(id)}`, input),
    onSuccess: async (cardio, { previousDate }) => {
      await invalidate(cardio.date)
      if (previousDate && previousDate !== cardio.date) await invalidate(previousDate)
    },
  })
}

export function useDeleteCardio() {
  const api = useApi()
  const invalidate = useDiaryInvalidation()
  return useMutation({
    mutationFn: ({ id }: { id: Id; date: IsoDate }) => api.delete(`/api/cardio/${enc(id)}`),
    onSuccess: (_data, { date }) => invalidate(date),
  })
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

/**
 * `GET /api/me/export` → JSON file with all my data. The file is named by the caller with the user's local
 * date: the server's Content-Disposition uses its UTC date (the previous day just after midnight in Spain).
 */
export function useExportData() {
  const api = useApi()
  return useMutation({
    mutationFn: async ({ filename }: { filename: string }): Promise<DownloadedFile> => {
      const response = await api.raw('GET', '/api/me/export')
      const blob = await response.blob()
      const typed = blob.type ? blob : new Blob([blob], { type: 'application/json' })
      return { blob: typed, filename }
    },
  })
}

/** `DELETE /api/me` (requires a recent login; may fail with 401 reauth_required). */
export function useDeleteAccount() {
  const api = useApi()
  return useMutation({
    mutationFn: () => api.delete('/api/me'),
  })
}
