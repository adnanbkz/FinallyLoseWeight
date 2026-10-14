import { useId, useState, type FormEvent } from 'react'
import { Pencil, Scale } from 'lucide-react'
import type { Weight } from '../../api/types'
import { useDeleteWeight, useSaveWeight } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { NumberField, TextField } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { FormError } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { formatNumber, isBlank, parseDecimal, toInputValue } from '../../lib/numbers'
import { EditSheetFooter } from './EditSheetFooter'
import { QuickNumberForm } from './QuickNumberForm'
import { NOTE_MAX, WEIGHT_LIMITS } from './cardioForm'

function validateWeight(raw: string): { value: number } | { error: string } {
  if (isBlank(raw)) return { error: 'Escribe tu peso.' }
  const n = parseDecimal(raw)
  if (n === null || n < WEIGHT_LIMITS.min || n > WEIGHT_LIMITS.max)
    return { error: `Entre ${WEIGHT_LIMITS.min} y ${WEIGHT_LIMITS.max} kg (p. ej. 72,5).` }
  return { value: Math.round(n * 100) / 100 }
}

export function WeightCard({ date, weight }: { date: string; weight: Weight | null }) {
  const save = useSaveWeight()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  return (
    <Card
      title="Peso"
      icon={<Scale className="size-5" />}
      action={
        weight && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="size-4" aria-hidden="true" />}>
            Editar
          </Button>
        )
      }
    >
      {weight ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full flex-col items-start rounded-xl text-left"
          aria-label={`Peso: ${formatNumber(weight.weightKg, 2)} kg. Editar`}
        >
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatNumber(weight.weightKg, 2)}
            <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">kg</span>
          </span>
          {weight.note && <span className="mt-1 text-sm text-slate-600 dark:text-slate-300">{weight.note}</span>}
        </button>
      ) : (
        <QuickNumberForm
          label="Peso en kg"
          suffix="kg"
          placeholder="p. ej. 72,5"
          saving={save.isPending}
          validate={validateWeight}
          serverError={save.isError ? (fieldErrorsOf(save.error).weightKg ?? apiErrorMessage(save.error)) : null}
          onSave={(weightKg, reset) =>
            save.mutate(
              { date, input: { weightKg, note: null } },
              {
                onSuccess: () => {
                  reset()
                  toast.success('Peso guardado')
                },
              },
            )
          }
        />
      )}
      {editing && weight && <WeightSheet date={date} weight={weight} onClose={() => setEditing(false)} />}
    </Card>
  )
}

function WeightSheet({ date, weight, onClose }: { date: string; weight: Weight; onClose: () => void }) {
  const formId = useId()
  const save = useSaveWeight()
  const remove = useDeleteWeight()
  const toast = useToast()
  const [raw, setRaw] = useState(toInputValue(weight.weightKg))
  const [note, setNote] = useState(weight.note ?? '')
  const [errors, setErrors] = useState<{ weightKg?: string; note?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateWeight(raw)
    const nextErrors: typeof errors = {}
    if ('error' in result) nextErrors.weightKg = result.error
    if (note.trim().length > NOTE_MAX) nextErrors.note = `Máximo ${NOTE_MAX} caracteres.`
    setErrors(nextErrors)
    if ('error' in result || nextErrors.note) return
    save.mutate(
      { date, input: { weightKg: result.value, note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success('Peso actualizado')
          onClose()
        },
        onError: (error) => {
          setErrors(fieldErrorsOf(error))
          setFormError(apiErrorMessage(error))
        },
      },
    )
  }

  const onDelete = () =>
    remove.mutate(date, {
      onSuccess: () => {
        toast.success('Peso borrado')
        onClose()
      },
      onError: (error) => setFormError(apiErrorMessage(error)),
    })

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar peso"
      dismissible={!save.isPending && !remove.isPending}
      footer={<EditSheetFooter formId={formId} saving={save.isPending} deleting={remove.isPending} onDelete={onDelete} deleteQuestion="¿Borrar el peso de este día?" />}
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <NumberField label="Peso" suffix="kg" value={raw} onChange={(e) => setRaw(e.target.value)} error={errors.weightKg} />
        <TextField
          label="Nota"
          optional
          placeholder="p. ej. en ayunas"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          error={errors.note}
        />
        <FormError>{formError}</FormError>
      </form>
    </Sheet>
  )
}
