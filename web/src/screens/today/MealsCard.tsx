import { useId, useState, type FormEvent } from 'react'
import { Apple, ChevronRight, Coffee, Moon, Plus, Soup, Utensils, type LucideIcon } from 'lucide-react'
import { MEAL_TYPES, type Meal, type MealType } from '../../api/types'
import { useCreateMeal, useDeleteMeal, useUpdateMeal } from '../../api/hooks'
import { apiErrorMessage, fieldErrorsOf } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { NumberField, TextField } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { Sheet } from '../../components/ui/Sheet'
import { FormError } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { MEAL_TYPE_LABELS, defaultMealType } from '../../lib/labels'
import { formatNumber } from '../../lib/numbers'
import { EditSheetFooter } from './EditSheetFooter'
import { MEAL_LIMITS, mealToForm, validateMealForm, type MealFormErrors, type MealFormValues } from './mealForm'

const MEAL_ICONS: Record<MealType, LucideIcon> = { breakfast: Coffee, lunch: Soup, dinner: Moon, snack: Apple }

type Editing = { meal: Meal } | { mealType: MealType } | null

function macroLine(meal: Meal): string | null {
  const parts: string[] = []
  if (meal.proteinG !== null) parts.push(`P ${formatNumber(meal.proteinG, 1)} g`)
  if (meal.carbsG !== null) parts.push(`H ${formatNumber(meal.carbsG, 1)} g`)
  if (meal.fatG !== null) parts.push(`G ${formatNumber(meal.fatG, 1)} g`)
  return parts.length ? parts.join(' · ') : null
}

export function MealsCard({ date, meals, isToday }: { date: string; meals: Meal[]; isToday: boolean }) {
  const [editing, setEditing] = useState<Editing>(null)
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0)
  const addSuggested = () => setEditing({ mealType: isToday ? defaultMealType(new Date().getHours()) : 'lunch' })

  return (
    <Card
      title="Comidas"
      icon={<Utensils />}
      tone="meals"
      action={
        <Button size="sm" variant="secondary" onClick={addSuggested} icon={<Plus className="size-4" aria-hidden="true" />}>
          Añadir
        </Button>
      }
    >
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
        {MEAL_TYPES.map((type) => {
          const items = meals.filter((m) => m.mealType === type)
          const subtotal = items.reduce((sum, m) => sum + m.kcal, 0)
          return (
            <section key={type} className="py-2 first:pt-0 last:pb-0" aria-label={MEAL_TYPE_LABELS[type]}>
              <div className="flex min-h-11 items-center justify-between gap-2">
                <h3 className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <MealIcon type={type} />
                  {MEAL_TYPE_LABELS[type]}
                  {items.length > 0 && (
                    <span className="rounded-full bg-slate-900/[0.04] px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      {formatNumber(subtotal)} kcal
                    </span>
                  )}
                </h3>
                <Button
                  variant="ghostBrand"
                  size="icon"
                  onClick={() => setEditing({ mealType: type })}
                  aria-label={`Añadir a ${MEAL_TYPE_LABELS[type].toLowerCase()}`}
                >
                  <Plus className="size-5" aria-hidden="true" />
                </Button>
              </div>
              {items.length > 0 ? (
                <ul className="flex flex-col gap-0.5 pl-[2.375rem]">
                  {items.map((meal) => {
                    const macros = macroLine(meal)
                    return (
                      <li key={meal.id}>
                        <button
                          type="button"
                          onClick={() => setEditing({ meal })}
                          className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{meal.description}</span>
                            {macros && <span className="block text-xs text-slate-500 dark:text-slate-400">{macros}</span>}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                            {formatNumber(meal.kcal)} <span className="text-xs font-normal text-slate-500">kcal</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="pb-1 pl-[2.375rem] text-sm text-slate-400 dark:text-slate-500">Sin registros</p>
              )}
            </section>
          )
        })}
      </div>
      {meals.length > 0 && (
        <p className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Total: <strong className="font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(total)} kcal</strong>
        </p>
      )}
      {editing && (
        <MealSheet
          date={date}
          meal={'meal' in editing ? editing.meal : null}
          mealType={'meal' in editing ? editing.meal.mealType : editing.mealType}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

function MealIcon({ type }: { type: MealType }) {
  const Icon = MEAL_ICONS[type]
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300" aria-hidden="true">
      <Icon className="size-4" />
    </span>
  )
}

function MealSheet({
  date,
  meal,
  mealType,
  onClose,
}: {
  date: string
  meal: Meal | null
  mealType: MealType
  onClose: () => void
}) {
  const formId = useId()
  const create = useCreateMeal()
  const update = useUpdateMeal()
  const remove = useDeleteMeal()
  const toast = useToast()
  const [values, setValues] = useState<MealFormValues>(() => mealToForm(meal, mealType))
  const [errors, setErrors] = useState<MealFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const saving = create.isPending || update.isPending

  const set = (key: keyof MealFormValues) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }))

  const onError = (error: unknown) => {
    setErrors(fieldErrorsOf(error))
    setFormError(apiErrorMessage(error))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const result = validateMealForm(values, meal?.date ?? date)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    if (meal) {
      update.mutate(
        { id: meal.id, input: result.input, previousDate: meal.date },
        {
          onSuccess: () => {
            toast.success('Comida actualizada')
            onClose()
          },
          onError,
        },
      )
    } else {
      create.mutate(result.input, {
        onSuccess: () => {
          toast.success('Comida añadida')
          onClose()
        },
        onError,
      })
    }
  }

  const onDelete = meal
    ? () =>
        remove.mutate(
          { id: meal.id, date: meal.date },
          {
            onSuccess: () => {
              toast.success('Comida borrada')
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
      title={meal ? 'Editar comida' : 'Añadir comida'}
      dismissible={!saving && !remove.isPending}
      footer={
        <EditSheetFooter
          formId={formId}
          saving={saving}
          deleting={remove.isPending}
          onDelete={onDelete}
          saveLabel={meal ? 'Guardar' : 'Añadir'}
          deleteQuestion="¿Borrar esta comida?"
        />
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Segmented
          label="Tipo de comida"
          hideLabel={false}
          value={values.mealType}
          onChange={(type) => setValues((prev) => ({ ...prev, mealType: type }))}
          options={MEAL_TYPES.map((type) => ({ value: type, label: MEAL_TYPE_LABELS[type] }))}
        />
        <TextField
          label="Qué has comido"
          placeholder="p. ej. Pollo con arroz"
          value={values.description}
          onChange={set('description')}
          maxLength={MEAL_LIMITS.description}
          error={errors.description}
          autoComplete="off"
          enterKeyHint="next"
        />
        <NumberField label="Calorías" integer suffix="kcal" placeholder="p. ej. 650" value={values.kcal} onChange={set('kcal')} error={errors.kcal} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            Macros <span className="font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Proteína" suffix="g" value={values.proteinG} onChange={set('proteinG')} error={errors.proteinG} />
            <NumberField label="Hidratos" suffix="g" value={values.carbsG} onChange={set('carbsG')} error={errors.carbsG} />
            <NumberField label="Grasa" suffix="g" value={values.fatG} onChange={set('fatG')} error={errors.fatG} />
          </div>
        </fieldset>
        <FormError>{formError}</FormError>
      </form>
    </Sheet>
  )
}
