import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Machine } from '../../api/types'
import { CardioFields } from './CardioFields'

const treadmill: Machine = {
  id: 'incline-treadmill',
  name: 'Cinta inclinada',
  fields: [
    { key: 'inclinePercent', label: 'Pendiente', unit: '%', min: 0, max: 40, step: 0.5, required: true },
    { key: 'durationMin', label: 'Tiempo', unit: 'min', min: 1, max: 600, step: 1, required: true },
    { key: 'avgSpeedKmh', label: 'Velocidad media', unit: 'km/h', min: 0.5, max: 25, step: 0.1, required: true },
  ],
}

describe('<CardioFields>', () => {
  it('renders one input per field of the machine descriptor', () => {
    render(<CardioFields machine={treadmill} values={{}} errors={{}} onChange={() => {}} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(3)

    const incline = screen.getByLabelText('Pendiente (%)')
    expect(incline).toHaveAttribute('inputmode', 'decimal')
    expect(incline).toBeRequired()
    expect(screen.getByText('De 0 a 40 %')).toBeInTheDocument()

    // Whole-number step → numeric keypad.
    expect(screen.getByLabelText('Tiempo (min)')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText('Velocidad media (km/h)')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByText('De 0,5 a 25 km/h')).toBeInTheDocument()
  })

  it('renders fields of other machines without code changes (optional field, errors)', () => {
    const bike: Machine = {
      id: 'bike',
      name: 'Bicicleta',
      fields: [{ key: 'resistanceLevel', label: 'Resistencia', unit: 'nivel', min: 1, max: 20, step: 1, required: false }],
    }
    render(
      <CardioFields machine={bike} values={{ resistanceLevel: '25' }} errors={{ resistanceLevel: 'De 1 a 20 nivel.' }} onChange={() => {}} />,
    )
    const input = screen.getByRole('textbox', { name: /Resistencia \(nivel\)/ })
    expect(input).toHaveValue('25')
    expect(input).not.toBeRequired()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('(opcional)')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('De 1 a 20 nivel.')
  })

  it('reports changes by field key', async () => {
    const onChange = vi.fn()
    render(<CardioFields machine={treadmill} values={{}} errors={{}} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Velocidad media (km/h)'), '4')
    expect(onChange).toHaveBeenCalledWith('avgSpeedKmh', '4')
  })
})
