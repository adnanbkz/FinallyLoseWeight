import { NumberField, TextField } from '../../components/ui/Field'
import { PROFILE_LIMITS, type ProfileFormErrors, type ProfileFormValues } from './profileForm'

export function ProfileFields({
  values,
  errors,
  onChange,
  disabled,
}: {
  values: ProfileFormValues
  errors: ProfileFormErrors
  onChange: (values: ProfileFormValues) => void
  disabled?: boolean
}) {
  const set = (key: keyof ProfileFormValues) => (event: { target: { value: string } }) =>
    onChange({ ...values, [key]: event.target.value })
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="¿Cómo quieres que te llamemos?"
        hint="Un alias basta. No hace falta tu nombre real."
        value={values.displayName}
        onChange={set('displayName')}
        error={errors.displayName}
        maxLength={PROFILE_LIMITS.displayName.max}
        autoComplete="nickname"
        disabled={disabled}
      />
      <NumberField
        integer
        label="Altura"
        optional
        suffix="cm"
        value={values.heightCm}
        onChange={set('heightCm')}
        error={errors.heightCm}
        disabled={disabled}
      />
      <NumberField
        label="Peso objetivo"
        optional
        suffix="kg"
        value={values.targetWeightKg}
        onChange={set('targetWeightKg')}
        error={errors.targetWeightKg}
        hint="Se dibuja como referencia en la gráfica de peso."
        disabled={disabled}
      />
      <NumberField
        integer
        label="Objetivo diario de calorías"
        optional
        suffix="kcal"
        value={values.dailyKcalTarget}
        onChange={set('dailyKcalTarget')}
        error={errors.dailyKcalTarget}
        hint="Lo que quieres comer al día. Lo usamos para el balance diario."
        disabled={disabled}
      />
    </div>
  )
}
