import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'

/** Footer for create/edit sheets: Guardar (+ Borrar with inline confirmation when editing). */
export function EditSheetFooter({
  formId,
  saving,
  deleting,
  onDelete,
  saveLabel = 'Guardar',
  deleteQuestion = '¿Borrar este registro?',
}: {
  formId: string
  saving: boolean
  deleting?: boolean
  onDelete?: () => void
  saveLabel?: string
  deleteQuestion?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const busy = saving || Boolean(deleting)

  if (confirming && onDelete) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200" role="alert">
          {deleteQuestion}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
            No
          </Button>
          <Button variant="danger" onClick={onDelete} loading={deleting}>
            Sí, borrar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {onDelete && (
        <Button
          variant="ghostDanger"
          size="icon"
          onClick={() => setConfirming(true)}
          disabled={busy}
          aria-label="Borrar"
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </Button>
      )}
      <Button type="submit" form={formId} block loading={saving} disabled={busy}>
        {saveLabel}
      </Button>
    </div>
  )
}
