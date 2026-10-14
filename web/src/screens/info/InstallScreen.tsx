import { useState, type ReactNode } from 'react'
import { CheckCircle2, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import { ScreenBody } from '../../components/layout/AppShell'
import { ScreenHeader } from '../../components/layout/ScreenHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { InfoNote } from '../../components/ui/States'
import { isAndroid, isIOS, isStandalone } from '../../lib/platform'
import { promptInstall, useInstallPrompt } from '../../pwa/installPrompt'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300" aria-hidden="true">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}

const inlineIcon = 'inline size-5 -mt-0.5 align-middle text-sky-600 dark:text-sky-400'

function IosCard() {
  return (
    <Card title="iPhone y iPad">
      <ol className="flex flex-col gap-3 text-slate-700 dark:text-slate-300">
        <Step n={1}>Abre esta página en <strong>Safari</strong>.</Step>
        <Step n={2}>
          Pulsa el botón <strong>Compartir</strong> <Share className={inlineIcon} aria-label="(icono Compartir)" /> en la barra
          inferior (o superior en iPad).
        </Step>
        <Step n={3}>
          Desliza hacia abajo y elige <strong>Añadir a pantalla de inicio</strong>{' '}
          <SquarePlus className={inlineIcon} aria-label="(icono Añadir)" />.
        </Step>
        <Step n={4}>Pulsa <strong>Añadir</strong>. Verás el icono de FLW en tu pantalla de inicio.</Step>
      </ol>
      <InfoNote className="mt-4">
        La app instalada no comparte la sesión con Safari: la primera vez tendrás que iniciar sesión dentro de la app.
      </InfoNote>
    </Card>
  )
}

function AndroidCard() {
  const { canPrompt, installed } = useInstallPrompt()
  const [result, setResult] = useState<string | null>(null)
  const install = async () => {
    const outcome = await promptInstall()
    if (outcome === 'dismissed') setResult('Instalación cancelada. Puedes intentarlo de nuevo cuando quieras.')
  }
  return (
    <Card title="Android">
      {installed ? (
        <p className="flex items-center gap-2 text-brand-800 dark:text-brand-300" role="status">
          <CheckCircle2 className="size-5" aria-hidden="true" /> ¡Instalada! Ábrela desde tu pantalla de inicio.
        </p>
      ) : canPrompt ? (
        <div className="flex flex-col gap-3">
          <p className="text-slate-700 dark:text-slate-300">Tu navegador permite instalarla directamente:</p>
          <Button block size="lg" onClick={() => void install()} icon={<Download className="size-5" aria-hidden="true" />}>
            Instalar app
          </Button>
          {result && <p className="text-sm text-slate-500 dark:text-slate-400">{result}</p>}
        </div>
      ) : (
        <ol className="flex flex-col gap-3 text-slate-700 dark:text-slate-300">
          <Step n={1}>Abre esta página en <strong>Chrome</strong>.</Step>
          <Step n={2}>
            Pulsa el menú <EllipsisVertical className={inlineIcon} aria-label="(icono de menú)" /> arriba a la derecha.
          </Step>
          <Step n={3}>
            Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
          </Step>
        </ol>
      )}
    </Card>
  )
}

export function InstallScreen() {
  const standalone = isStandalone()
  const android = isAndroid()
  const ios = isIOS()
  return (
    <div className="min-h-dvh">
      <ScreenHeader title="Cómo instalar" back="/" />
      <ScreenBody withTabBar={false}>
        {standalone ? (
          <Card>
            <p className="flex items-center gap-2 text-brand-800 dark:text-brand-300">
              <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />
              Ya estás usando la app instalada. ¡Todo listo!
            </p>
          </Card>
        ) : (
          <p className="text-slate-700 dark:text-slate-300">
            Instala FinallyLoseWeight en tu móvil para abrirla como una app más, a pantalla completa y con su propio icono. No
            ocupa casi espacio y se actualiza sola.
          </p>
        )}
        {android && !ios ? (
          <>
            <AndroidCard />
            <IosCard />
          </>
        ) : (
          <>
            <IosCard />
            <AndroidCard />
          </>
        )}
      </ScreenBody>
    </div>
  )
}
