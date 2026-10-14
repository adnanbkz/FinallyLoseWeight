import type { CardioFieldKey, Machine } from '../../api/types'
import { NumberField } from '../../components/ui/Field'
import { fieldRangeHint, isIntegerField, type CardioFieldErrors, type CardioFieldValues } from './cardioForm'

/**
 * Form generated from a machine descriptor (GET /api/cardio/machines): one numeric input per field,
 * labelled with the field's label and unit, with its range as a hint. New machines need no frontend change.
 */
export function CardioFields({
  machine,
  values,
  errors,
  onChange,
  disabled,
}: {
  machine: Machine
  values: CardioFieldValues
  errors: CardioFieldErrors
  onChange: (key: CardioFieldKey, value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
      {machine.fields.map((field) => (
        <NumberField
          key={field.key}
          name={field.key}
          label={`${field.label} (${field.unit})`}
          optional={!field.required}
          integer={isIntegerField(field)}
          suffix={field.unit}
          value={values[field.key] ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          error={errors[field.key]}
          hint={fieldRangeHint(field)}
          required={field.required}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
