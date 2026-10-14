import { useId, useState, type FormEvent } from 'react'
import { Footprints, Pencil } from 'lucide-react'
import { useDeleteSteps, useSaveSteps } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { NumberField } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { FormError } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { formatSteps, isBlank, parseInteger, toInputValue } from '../../lib/numbers'
import { EditSheetFooter } from './EditSheetFooter'
import { QuickNumberForm } from './QuickNumberForm'

const MAX_STEPS = 150_000

function validateSteps(raw: string): { value: number } | { error: string } {
  if (isBlank(raw)) return { error: 'Escribe tus pasos.' }
  const n = parseInteger(raw)
  if (n === null || n < 0 || n > MAX_STEPS) return { error: `Un número entero entre 0 y ${formatSteps(MAX_STEPS)}.` }
  return { value: n }
}

export function StepsCard({ date, steps }: { date: string; steps: number | null }) {
  const save = useSaveSteps()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  return (
    <Card
      title="Pasos"
      icon={<Footprints className="size-5" />}
      action={
        steps !== null && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="size-4" aria-hidden="true" />}>
            Editar
          </Button>
        )
      }
    >
      {steps !== null ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-baseline rounded-xl text-left"
          aria-label={`${formatSteps(steps)} pasos. Editar`}
        >
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatSteps(steps)}</span>
          <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">pasos</span>
        </button>
      ) : (
        <QuickNumberForm
          label="Pasos del día"
          suffix="pasos"
          integer
          placeholder="p. ej. 8500"
          saving={save.isPending}
          validate={validateSteps}
          serverError={save.isError ? (fieldErrorsOf(save.error).steps ?? apiErrorMessage(save.error)) : null}
          onSave={(value, reset) =>
            save.mutate(
              { date, input: { steps: value } },
              {
                onSuccess: () => {
                  reset()
                  toast.success('Pasos guardados')
                },
              },
            )
          }
        />
      )}
      {editing && steps !== null && <StepsSheet date={date} steps={steps} onClose={() => setEditing(false)} />}
    </Card>
  )
}

function StepsSheet({ date, steps, onClose }: { date: string; steps: number; onClose: () => void }) {
  const formId = useId()
  const save = useSaveSteps()
  const remove = useDeleteSteps()
  const toast = useToast()
  const [raw, setRaw] = useState(toInputValue(steps))
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateSteps(raw)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setError(null)
    save.mutate(
      { date, input: { steps: result.value } },
      {
        onSuccess: () => {
          toast.success('Pasos actualizados')
          onClose()
        },
        onError: (err) => {
          setError(fieldErrorsOf(err).steps ?? null)
          setFormError(apiErrorMessage(err))
        },
      },
    )
  }

  const onDelete = () =>
    remove.mutate(date, {
      onSuccess: () => {
        toast.success('Pasos borrados')
        onClose()
      },
      onError: (err) => setFormError(apiErrorMessage(err)),
    })

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar pasos"
      dismissible={!save.isPending && !remove.isPending}
      footer={<EditSheetFooter formId={formId} saving={save.isPending} deleting={remove.isPending} onDelete={onDelete} deleteQuestion="¿Borrar los pasos de este día?" />}
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <NumberField label="Pasos" integer suffix="pasos" value={raw} onChange={(e) => setRaw(e.target.value)} error={error} />
        <FormError>{formError}</FormError>
      </form>
    </Sheet>
  )
}
