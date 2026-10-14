import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Last-resort boundary: a friendly Spanish screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <h1 className="text-xl font-bold">Algo ha fallado</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Ha ocurrido un error inesperado. Recarga la app para continuar; tus datos guardados no se pierden.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
        >
          Recargar
        </button>
      </main>
    )
  }
}
