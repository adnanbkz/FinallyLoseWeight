import { useEffect, useState } from 'react'
import { Download, FileDown, Share2 } from 'lucide-react'
import { useExportData } from '../../api/hooks'
import { apiErrorMessage } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/States'
import { buttonClass } from '../../components/ui/styles'
import { todayIso } from '../../lib/dates'
import { canShareFile, triggerDownload } from '../../lib/download'
import { isIOS } from '../../lib/platform'

interface ReadyFile {
  url: string
  filename: string
  file: File
}

/** "Descargar mis datos": GET /api/me/export saved as a JSON file. */
export function ExportData() {
  const exportData = useExportData()
  const [ready, setReady] = useState<ReadyFile | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    return () => URL.revokeObjectURL(ready.url)
  }, [ready])

  const onExport = () => {
    setShareError(null)
    exportData.mutate(
      { filename: `finallyloseweight-export-${todayIso()}.json` },
      {
        onSuccess: ({ blob, filename }) => {
          const file = new File([blob], filename, { type: 'application/json' })
          const url = URL.createObjectURL(file)
          setReady({ url, filename, file })
          // iOS (especially the installed app) handles downloads better from a direct tap below.
          if (!isIOS()) triggerDownload(url, filename)
        },
      },
    )
  }

  const onShare = async () => {
    if (!ready) return
    try {
      await navigator.share({ files: [ready.file], title: 'Mis datos de FinallyLoseWeight' })
    } catch (error) {
      // The user closing the share sheet rejects with an AbortError DOMException: not a failure. Checked by
      // name, not `instanceof Error`, which a DOMException from another realm does not satisfy.
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
      if (!cancelled) setShareError('No se ha podido compartir el archivo.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        block
        onClick={onExport}
        loading={exportData.isPending}
        icon={<Download className="size-5" aria-hidden="true" />}
      >
        Descargar mis datos
      </Button>
      {exportData.isError && <FormError>{apiErrorMessage(exportData.error)}</FormError>}
      {ready && (
        <div className="flex flex-col gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100" role="status">
          <p>
            Tu archivo <strong className="break-all">{ready.filename}</strong> está listo.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={ready.url} download={ready.filename} className={buttonClass('secondary', 'sm')}>
              <FileDown className="size-4" aria-hidden="true" />
              Guardar archivo
            </a>
            {canShareFile(ready.file) && (
              <Button variant="secondary" size="sm" onClick={() => void onShare()} icon={<Share2 className="size-4" aria-hidden="true" />}>
                Compartir…
              </Button>
            )}
          </div>
          {shareError && <p className="text-red-700 dark:text-red-300">{shareError}</p>}
        </div>
      )}
    </div>
  )
}
