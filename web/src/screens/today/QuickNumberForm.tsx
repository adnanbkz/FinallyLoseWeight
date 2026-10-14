import { useState, type FormEvent } from 'react'
import { NumberField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'

/** Inline "type a number + Guardar" form used for quick weight/steps entry. */
export function QuickNumberForm({
  label,
  suffix,
  integer,
  placeholder,
  saving,
  validate,
  onSave,
  serverError,
}: {
  label: string
  suffix: string
  integer?: boolean
  placeholder?: string
  saving: boolean
  /** Returns the parsed number or an error message. */
  validate: (raw: string) => { value: number } | { error: string }
  onSave: (value: number, reset: () => void) => void
  serverError?: string | null
}) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validate(raw)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setError(null)
    onSave(result.value, () => setRaw(''))
  }
  return (
    <form className="flex items-start gap-2" onSubmit={submit} noValidate>
      <NumberField
        label={label}
        hideLabel
        integer={integer}
        suffix={suffix}
        placeholder={placeholder}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        error={error ?? serverError}
        containerClassName="flex-1"
        disabled={saving}
      />
      <Button type="submit" loading={saving}>
        Guardar
      </Button>
    </form>
  )
}
