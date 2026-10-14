import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DaySummary, DayTotals } from '../../api/types'
import { renderWithProviders } from '../../test/utils'
import { SummaryCard } from './SummaryCard'

function day(totals: Partial<DayTotals>, dailyKcalTarget: number | null): DaySummary {
  return {
    date: '2026-10-14',
    weight: null,
    meals: [],
    steps: null,
    cardio: [],
    totals: { kcalIn: 0, proteinG: 0, carbsG: 0, fatG: 0, kcalCardioGross: 0, kcalCardioNet: 0, ...totals },
    dailyKcalTarget,
  }
}

/** The value shown under a stat label ("Objetivo", "Cardio neto", "Disponibles"). */
function stat(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null
}

describe('<SummaryCard>', () => {
  it('adds the NET cardio kcal (not the gross) to the daily target', () => {
    renderWithProviders(<SummaryCard day={day({ kcalIn: 1850, kcalCardioGross: 302, kcalCardioNet: 265 }, 2000)} />)

    // Available = 2000 + 265 net = 2265 → 2265 - 1850 = 415 left (with the gross it would be 452).
    expect(stat('Objetivo')).toBe('2000')
    expect(stat('Cardio neto')).toBe('+265')
    expect(stat('Disponibles')).toBe('2265')
    expect(screen.getByText('Te quedan')).toHaveTextContent('Te quedan415 kcal')
    expect(screen.getByRole('progressbar', { name: 'Calorías ingeridas respecto a las disponibles' })).toHaveAttribute(
      'aria-valuetext',
      '1850 de 2265 kcal',
    )
    expect(screen.queryByText(/452/)).not.toBeInTheDocument()
  })

  it('says how much the user went over the available kcal', () => {
    renderWithProviders(<SummaryCard day={day({ kcalIn: 2500, kcalCardioGross: 302, kcalCardioNet: 265 }, 2000)} />)

    expect(screen.getByText('Te has pasado')).toHaveTextContent('Te has pasado235 kcal')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2500')
  })

  it('without a daily target shows no balance and links to the profile', () => {
    renderWithProviders(<SummaryCard day={day({ kcalIn: 900, kcalCardioNet: 100, kcalCardioGross: 130 }, null)} />)

    expect(stat('Objetivo')).toBe('—')
    expect(stat('Disponibles')).toBe('—')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('Te quedan')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Define tu objetivo diario' })).toHaveAttribute('href', '/perfil')
  })

  it('shows the macros only when some were logged', () => {
    const { unmount } = renderWithProviders(<SummaryCard day={day({ kcalIn: 500 }, 2000)} />)
    expect(screen.queryByText('Proteína')).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<SummaryCard day={day({ kcalIn: 500, proteinG: 45.4, carbsG: 70, fatG: 0 }, 2000)} />)
    expect(screen.getByText('Proteína')).toHaveTextContent('Proteína 45 g')
    expect(screen.getByText('Hidratos')).toHaveTextContent('Hidratos 70 g')
    expect(screen.getByText('Grasa')).toHaveTextContent('Grasa 0 g')
  })
})
