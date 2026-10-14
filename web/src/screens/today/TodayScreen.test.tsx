import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import type { Cardio, DaySummary, Machine, Meal } from '../../api/types'
import { createFakeApi, renderWithProviders, type FakeApi } from '../../test/utils'
import { TodayScreen } from './TodayScreen'

const TODAY = '2026-10-14'
// 10:00 in Madrid (TZ=Europe/Madrid in vite.config.ts).
const NOW = new Date('2026-10-14T08:00:00Z')

const machines: Machine[] = [
  {
    id: 'incline-treadmill',
    name: 'Cinta inclinada',
    fields: [
      { key: 'inclinePercent', label: 'Pendiente', unit: '%', min: 0, max: 40, step: 0.5, required: true },
      { key: 'durationMin', label: 'Tiempo', unit: 'min', min: 1, max: 600, step: 1, required: true },
      { key: 'avgSpeedKmh', label: 'Velocidad media', unit: 'km/h', min: 0.5, max: 25, step: 0.1, required: true },
    ],
  },
]

const lunch: Meal = {
  id: '0192f0c4-0000-7000-8000-0000000000a1',
  date: TODAY,
  mealType: 'lunch',
  description: 'Pollo con arroz',
  kcal: 650,
  proteinG: 45,
  carbsG: 70,
  fatG: 15,
  createdAt: '2026-10-14T12:00:00Z',
}

const treadmill: Cardio = {
  id: '0192f0c4-0000-7000-8000-0000000000c1',
  date: TODAY,
  machine: 'incline-treadmill',
  machineName: 'Cinta inclinada',
  durationMin: 30,
  avgSpeedKmh: 4.8,
  inclinePercent: 12,
  resistanceLevel: null,
  weightKgUsed: 70,
  kcalGross: 302,
  kcalNet: 265,
  formulaVersion: 'acsm-v1',
  note: null,
  createdAt: '2026-10-14T07:00:00Z',
}

function emptyDay(date: string): DaySummary {
  return {
    date,
    weight: null,
    meals: [],
    steps: null,
    cardio: [],
    totals: { kcalIn: 0, proteinG: 0, carbsG: 0, fatG: 0, kcalCardioGross: 0, kcalCardioNet: 0 },
    dailyKcalTarget: 2000,
  }
}

function fullDay(date: string): DaySummary {
  return {
    ...emptyDay(date),
    weight: { date, weightKg: 72.5, note: 'en ayunas' },
    meals: [{ ...lunch, date }],
    steps: 8500,
    cardio: [{ ...treadmill, date }],
    totals: { kcalIn: 650, proteinG: 45, carbsG: 70, fatG: 15, kcalCardioGross: 302, kcalCardioNet: 265 },
  }
}

/** Fake API backed by an in-memory store of day summaries: writes update the store, reads serve it. */
function diaryApi(days: Record<string, DaySummary> = {}): FakeApi & { days: Record<string, DaySummary> } {
  const api = createFakeApi()
  const store = { ...days }
  const dayOf = (date: string) => (store[date] ??= emptyDay(date))
  api.get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/days/')) return structuredClone(dayOf(path.slice('/api/days/'.length)))
    if (path === '/api/cardio/machines') return machines
    throw new Error(`Unexpected GET ${path}`)
  })
  api.put.mockImplementation(async (path: string, body: unknown) => {
    const [, , resource, key] = path.split('/')
    if (resource === 'weights') {
      const { weightKg, note } = body as { weightKg: number; note: string | null }
      dayOf(key!).weight = { date: key!, weightKg, note }
      return dayOf(key!).weight
    }
    if (resource === 'steps') {
      dayOf(key!).steps = (body as { steps: number }).steps
      return { date: key, steps: dayOf(key!).steps }
    }
    if (resource === 'meals') return { ...lunch, ...(body as object), id: key }
    throw new Error(`Unexpected PUT ${path}`)
  })
  api.post.mockImplementation(async (path: string, body: unknown) => {
    if (path === '/api/meals') {
      const meal = { ...(body as Meal), id: 'new-meal', createdAt: '2026-10-14T20:00:00Z' }
      dayOf(meal.date).meals.push(meal)
      return meal
    }
    throw new Error(`Unexpected POST ${path}`)
  })
  api.delete.mockResolvedValue(undefined)
  return Object.assign(api, { days: store })
}

function renderToday(api: FakeApi, route = '/') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<TodayScreen />} />
      <Route path="/dia/:date" element={<TodayScreen />} />
    </Routes>,
    { api, route },
  )
}

/** The card (<section>) whose heading is `title`. */
async function card(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title, level: 2 })
  return heading.closest('section')!
}

const dayRequests = (api: FakeApi, date: string) => api.get.mock.calls.filter(([path]) => path === `/api/days/${date}`).length

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('<TodayScreen> weight', () => {
  it('saves a quick weight typed with a decimal comma and reloads the day', async () => {
    const user = userEvent.setup()
    const api = diaryApi()
    renderToday(api)
    const weight = await card('Peso')

    await user.type(within(weight).getByLabelText('Peso en kg'), '72,5')
    await user.click(within(weight).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/weights/${TODAY}`, { weightKg: 72.5, note: null }))
    expect(await within(weight).findByRole('button', { name: 'Peso: 72,5 kg. Editar' })).toBeInTheDocument()
    expect(dayRequests(api, TODAY)).toBe(2)
  })

  it('validates the range locally and shows the API field error', async () => {
    const user = userEvent.setup()
    const api = diaryApi()
    renderToday(api)
    const weight = await card('Peso')
    const input = within(weight).getByLabelText('Peso en kg')

    await user.type(input, '15')
    await user.click(within(weight).getByRole('button', { name: 'Guardar' }))
    expect(await within(weight).findByText('Entre 20 y 400 kg (p. ej. 72,5).')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()

    api.put.mockRejectedValueOnce(new ApiError({ status: 400, errors: { weightKg: ['El peso debe estar entre 20 y 400 kg.'] } }))
    await user.clear(input)
    await user.type(input, '70')
    await user.click(within(weight).getByRole('button', { name: 'Guardar' }))
    expect(await within(weight).findByText('El peso debe estar entre 20 y 400 kg.')).toBeInTheDocument()
  })

  it('edits the note and deletes the weight of the day being viewed', async () => {
    const user = userEvent.setup()
    const api = diaryApi({ '2026-10-10': fullDay('2026-10-10') })
    renderToday(api, '/dia/2026-10-10')

    await user.click(await screen.findByRole('button', { name: 'Peso: 72,5 kg. Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar peso' })
    const note = within(sheet).getByLabelText(/Nota/)
    await user.clear(note)
    await user.type(note, 'después de entrenar')
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/weights/2026-10-10', { weightKg: 72.5, note: 'después de entrenar' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Peso: 72,5 kg. Editar' }))
    const again = await screen.findByRole('dialog', { name: 'Editar peso' })
    await user.click(within(again).getByRole('button', { name: 'Borrar' }))
    await user.click(within(again).getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/weights/2026-10-10'))
  })
})

describe('<TodayScreen> steps', () => {
  it('accepts thousands separators and rejects decimals', async () => {
    const user = userEvent.setup()
    const api = diaryApi()
    renderToday(api)
    const steps = await card('Pasos')
    const input = within(steps).getByLabelText('Pasos del día')

    await user.type(input, '12,5')
    await user.click(within(steps).getByRole('button', { name: 'Guardar' }))
    expect(await within(steps).findByText('Un número entero entre 0 y 150.000.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()

    await user.clear(input)
    await user.type(input, '8.500')
    await user.click(within(steps).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/steps/${TODAY}`, { steps: 8500 }))
    expect(await within(steps).findByRole('button', { name: '8500 pasos. Editar' })).toBeInTheDocument()
  })
})

describe('<TodayScreen> meals', () => {
  it('adds a meal of the chosen type to the day being viewed', async () => {
    const user = userEvent.setup()
    const api = diaryApi()
    renderToday(api, '/dia/2026-10-12')
    const meals = await card('Comidas')

    await user.click(within(meals).getByRole('button', { name: 'Añadir a cena' }))
    const sheet = await screen.findByRole('dialog', { name: 'Añadir comida' })
    expect(within(sheet).getByRole('radio', { name: 'Cena' })).toHaveAttribute('aria-checked', 'true')

    await user.click(within(sheet).getByRole('button', { name: 'Añadir' }))
    expect(await within(sheet).findByText('Describe qué has comido.')).toBeInTheDocument()
    expect(within(sheet).getByText('Indica las calorías (puede ser 0).')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()

    await user.type(within(sheet).getByLabelText('Qué has comido'), '  Tortilla de patatas ')
    await user.type(within(sheet).getByLabelText('Calorías'), '650')
    await user.type(within(sheet).getByLabelText('Proteína'), '20,5')
    await user.click(within(sheet).getByRole('button', { name: 'Añadir' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/meals', {
        date: '2026-10-12',
        mealType: 'dinner',
        description: 'Tortilla de patatas',
        kcal: 650,
        proteinG: 20.5,
        carbsG: null,
        fatG: null,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const dinner = within(await card('Comidas')).getByRole('region', { name: 'Cena' })
    expect(await within(dinner).findByText('Tortilla de patatas')).toBeInTheDocument()
  })

  it('edits and deletes an existing meal by id', async () => {
    const user = userEvent.setup()
    const api = diaryApi({ [TODAY]: fullDay(TODAY) })
    renderToday(api)

    await user.click(await screen.findByRole('button', { name: /Pollo con arroz/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar comida' })
    expect(within(sheet).getByLabelText('Calorías')).toHaveValue('650')
    await user.click(within(sheet).getByRole('radio', { name: 'Cena' }))
    await user.clear(within(sheet).getByLabelText('Calorías'))
    await user.type(within(sheet).getByLabelText('Calorías'), '700')
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(`/api/meals/${lunch.id}`, {
        date: TODAY,
        mealType: 'dinner',
        description: 'Pollo con arroz',
        kcal: 700,
        proteinG: 45,
        carbsG: 70,
        fatG: 15,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Pollo con arroz/ }))
    const again = await screen.findByRole('dialog', { name: 'Editar comida' })
    await user.click(within(again).getByRole('button', { name: 'Borrar' }))
    expect(within(again).getByText('¿Borrar esta comida?')).toBeInTheDocument()
    await user.click(within(again).getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/api/meals/${lunch.id}`))
  })
})

describe('<TodayScreen> day summary', () => {
  it('shows every card and uses the net cardio kcal for the balance', async () => {
    const api = diaryApi({ [TODAY]: fullDay(TODAY) })
    renderToday(api)

    const cardio = await card('Cardio')
    const session = within(cardio).getByRole('button', { name: /Cinta inclinada/ })
    expect(session).toHaveTextContent('265 kcal302 brutas')
    // Details follow the order and units of the machine catalog once it is loaded.
    expect(await within(session).findByText('12 % · 30 min · 4,8 km/h')).toBeInTheDocument()
    expect(within(cardio).getByText(/Total neto/)).toHaveTextContent('Total neto: 265 kcal')

    // 2000 target + 265 net cardio - 650 eaten.
    const summary = await card('Balance del día')
    expect(within(summary).getByText('Te quedan')).toHaveTextContent('1615 kcal')
    expect(screen.getByRole('heading', { name: 'Hoy', level: 1 })).toBeInTheDocument()
  })

  it('redirects a future date to today', async () => {
    const api = diaryApi()
    renderToday(api, '/dia/2026-10-15')

    expect(await screen.findByRole('heading', { name: 'Hoy', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/api/days/${TODAY}`, expect.anything()))
    expect(api.get).not.toHaveBeenCalledWith('/api/days/2026-10-15', expect.anything())
  })
})
