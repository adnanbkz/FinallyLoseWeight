import { useId, useMemo, useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import type { Cardio, CardioEstimate, CardioFieldKey, CardioInput } from '../../api/types'
import { useCardioEstimate, useCreateCardio, useDeleteCardio, useMachines, useUpdateCardio } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf, isApiError } from '../../api/errors'
import { NumberField, SelectField, TextField } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { ErrorBlock, FormError, LoadingBlock } from '../../components/ui/States'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContext'
import { FORMULA_LABELS } from '../../lib/labels'
import { formatNumber, toInputValue } from '../../lib/numbers'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { CardioFields } from './CardioFields'
import { EditSheetFooter } from './EditSheetFooter'
import {
  NOTE_MAX,
  cardioToFieldValues,
  parseWeightOverride,
  validateCardioFields,
  type CardioFieldErrors,
  type CardioFieldValues,
} from './cardioForm'

const ESTIMATE_DEBOUNCE_MS = 500

export function CardioSheet({ date, session, onClose }: { date: string; session: Cardio | null; onClose: () => void }) {
  const formId = useId()
  const machines = useMachines()
  const create = useCreateCardio()
  const update = useUpdateCardio()
  const remove = useDeleteCardio()
  const toast = useToast()

  const [machineId, setMachineId] = useState<string>(session?.machine ?? '')
  const [values, setValues] = useState<CardioFieldValues>(() => cardioToFieldValues(session))
  const [note, setNote] = useState(session?.note ?? '')
  // Editing starts from the weight the session was calculated with: a note-only edit must not change its
  // kcal, and must work even when no weight is registered on or before its date. Clearing the field makes
  // the API use the latest registered weight instead.
  const [weightRaw, setWeightRaw] = useState(() => (session ? toInputValue(session.weightKgUsed) : ''))
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const saving = create.isPending || update.isPending
  const machine = machines.data?.find((m) => m.id === (machineId || machines.data?.[0]?.id))
  const validation = machine ? validateCardioFields(machine, values) : null
  const weightOverride = parseWeightOverride(weightRaw)

  // Body shared by the estimate and the save; null while the form is incomplete.
  const input: CardioInput | null =
    machine && validation?.ok && !weightOverride.error
      ? {
          date: session?.date ?? date,
          machine: machine.id,
          ...validation.fields,
          weightKg: weightOverride.value,
          note: note.trim() || null,
        }
      : null

  // Live estimate (debounced; the note does not affect it).
  const estimateKey = input ? JSON.stringify({ ...input, note: null }) : null
  const debouncedKey = useDebouncedValue(estimateKey, ESTIMATE_DEBOUNCE_MS)
  const estimateInput = useMemo(() => (debouncedKey ? (JSON.parse(debouncedKey) as CardioInput) : null), [debouncedKey])
  const estimate = useCardioEstimate(estimateInput)

  const saveError = create.error ?? update.error
  // The API answered 422 weight_required: no weight registered on or before the date and none given here.
  const apiNeedsWeight = isApiError(estimate.error, 'weight_required') || isApiError(saveError, 'weight_required')
  // Once the API asked for a weight (or the user started typing one), keep the field visible; when editing,
  // it always is (it holds the weight used).
  const showWeightField = session !== null || apiNeedsWeight || weightRaw.trim() !== ''
  const missingWeight = apiNeedsWeight && weightOverride.value === null

  const fieldErrors: CardioFieldErrors = {
    ...(showErrors && validation && !validation.ok ? validation.errors : {}),
    ...pickFieldErrors(serverErrors),
  }

  const setField = (key: CardioFieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setServerErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const onError = (error: unknown) => {
    setServerErrors(fieldErrorsOf(error))
    setFormError(isApiError(error, 'weight_required') ? null : apiErrorMessage(error))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setShowErrors(true)
    setFormError(null)
    if (!machine || !input) return
    if (missingWeight) {
      setServerErrors((prev) => ({ ...prev, weightKg: 'Indica tu peso para calcular las calorías.' }))
      return
    }
    if (session) {
      update.mutate(
        { id: session.id, input, previousDate: session.date },
        {
          onSuccess: () => {
            toast.success('Sesión de cardio actualizada')
            onClose()
          },
          onError,
        },
      )
    } else {
      create.mutate(input, {
        onSuccess: (saved) => {
          toast.success(`Cardio guardado: ${formatNumber(saved.kcalNet)} kcal netas`)
          onClose()
        },
        onError,
      })
    }
  }

  const onDelete = session
    ? () =>
        remove.mutate(
          { id: session.id, date: session.date },
          {
            onSuccess: () => {
              toast.success('Sesión de cardio borrada')
              onClose()
            },
            onError: (error) => setFormError(apiErrorMessage(error)),
          },
        )
    : undefined

  return (
    <Sheet
      open
      onClose={onClose}
      title={session ? 'Editar cardio' : 'Añadir cardio'}
      dismissible={!saving && !remove.isPending}
      footer={
        machine && (
          <EditSheetFooter
            formId={formId}
            saving={saving}
            deleting={remove.isPending}
            onDelete={onDelete}
            saveLabel={session ? 'Guardar' : 'Añadir'}
            deleteQuestion="¿Borrar esta sesión de cardio?"
          />
        )
      }
    >
      {machines.isPending ? (
        <LoadingBlock label="Cargando máquinas…" />
      ) : machines.data === undefined ? (
        // Only without a cached catalog: a failed background refetch must not replace the open form.
        <ErrorBlock error={machines.error} onRetry={() => void machines.refetch()} retrying={machines.isFetching} />
      ) : !machine ? (
        <ErrorBlock message="No hay máquinas de cardio disponibles." />
      ) : (
        <form id={formId} className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <SelectField
            label="Máquina"
            value={machine.id}
            onChange={(e) => {
              setMachineId(e.target.value)
              setServerErrors({})
            }}
            error={serverErrors.machine}
            disabled={saving}
          >
            {machines.data.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>

          <CardioFields machine={machine} values={values} errors={fieldErrors} onChange={setField} disabled={saving} />

          {showWeightField && (
            <div
              className={
                session && !apiNeedsWeight
                  ? 'flex flex-col gap-2'
                  : 'flex flex-col gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40'
              }
            >
              {session && !apiNeedsWeight ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Peso con el que se calculan las calorías de esta sesión. Si lo borras, se usará tu último peso registrado
                  hasta ese día.
                </p>
              ) : (
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  No tienes ningún peso registrado hasta este día. Indica tu peso para calcular las calorías.
                </p>
              )}
              <NumberField
                label="Tu peso"
                suffix="kg"
                placeholder="p. ej. 72,5"
                value={weightRaw}
                onChange={(e) => {
                  setWeightRaw(e.target.value)
                  setServerErrors((prev) => ({ ...prev, weightKg: '' }))
                }}
                error={weightOverride.error ?? (serverErrors.weightKg || null)}
                disabled={saving}
              />
            </div>
          )}

          <EstimatePanel
            ready={input !== null}
            needsWeight={missingWeight}
            pending={estimateKey !== debouncedKey || estimate.isFetching}
            data={estimateInput && !estimate.isError ? estimate.data : undefined}
            error={estimate.error && !isApiError(estimate.error, 'weight_required') ? estimate.error : null}
          />

          <TextField
            label="Nota"
            optional
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            error={serverErrors.note || null}
            disabled={saving}
          />
          <FormError>{formError}</FormError>
        </form>
      )}
    </Sheet>
  )
}

function pickFieldErrors(errors: Record<string, string>): CardioFieldErrors {
  const result: CardioFieldErrors = {}
  for (const key of ['durationMin', 'avgSpeedKmh', 'inclinePercent', 'resistanceLevel'] as const) {
    if (errors[key]) result[key] = errors[key]
  }
  return result
}

function EstimatePanel({
  ready,
  needsWeight,
  pending,
  data,
  error,
}: {
  ready: boolean
  /** The API answered 422 weight_required and no weight was typed yet. */
  needsWeight: boolean
  pending: boolean
  data: CardioEstimate | undefined
  error: unknown
}) {
  return (
    <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-950/60" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-900 dark:text-brand-100">
        <Calculator className="size-4" aria-hidden="true" />
        Estimación
        {ready && pending && <Spinner className="size-4" label="Calculando" />}
      </div>
      {!ready ? (
        <p className="mt-1 text-sm text-brand-900/70 dark:text-brand-100/70">Rellena los campos para ver las calorías.</p>
      ) : needsWeight && !pending ? (
        <p className="mt-1 text-sm text-brand-900/70 dark:text-brand-100/70">Indica tu peso para ver la estimación.</p>
      ) : error ? (
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{apiErrorMessage(error)}</p>
      ) : data ? (
        <div className="mt-1">
          <p className="text-2xl font-bold tabular-nums text-brand-900 dark:text-brand-50">
            ≈ {formatNumber(data.kcalNet)} <span className="text-base font-medium">kcal netas</span>
          </p>
          <p className="text-sm text-brand-900/80 dark:text-brand-100/80">
            {formatNumber(data.kcalGross)} brutas · {FORMULA_LABELS[data.formula]} · peso {formatNumber(data.weightKgUsed, 1)} kg (
            {data.weightSource === 'entry' ? 'tu último registro' : 'indicado aquí'})
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-brand-900/70 dark:text-brand-100/70">Calculando…</p>
      )}
    </div>
  )
}
