import { Settings } from 'lucide-react'

/** Shown when the build has no (or invalid) VITE_* configuration. Uses no providers. */
export function ConfigErrorScreen({ missing, invalid, detail }: { missing: string[]; invalid: string[]; detail?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-safe py-10" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Settings className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold">Falta configurar la app</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Esta versión de FinallyLoseWeight se ha generado sin la configuración necesaria para conectarse a Firebase y a la API.
        Si eres quien administra la app, revisa las variables de entorno y vuelve a generar la web.
      </p>
      {missing.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="mb-2 font-semibold">Variables sin valor</h2>
          <ul className="list-inside list-disc space-y-1 font-mono text-sm">
            {missing.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}
      {invalid.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="mb-2 font-semibold">Variables con un valor no válido</h2>
          <ul className="list-inside list-disc space-y-1 font-mono text-sm">
            {invalid.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            VITE_API_BASE_URL debe ser una URL completa, p. ej. https://flw-api.azurewebsites.net
          </p>
        </section>
      )}
      {detail && <p className="text-sm text-slate-500 dark:text-slate-400">Detalle: {detail}</p>}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Tienes un ejemplo en <code className="font-mono">web/.env.example</code>.
      </p>
    </main>
  )
}
