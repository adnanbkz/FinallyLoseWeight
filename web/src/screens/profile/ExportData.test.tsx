import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { canShareFile, triggerDownload } from '../../lib/download'
import { isIOS } from '../../lib/platform'
import type * as Platform from '../../lib/platform'
import { createFakeApi, renderWithProviders } from '../../test/utils'
import { ExportData } from './ExportData'

vi.mock('../../lib/download', () => ({ triggerDownload: vi.fn(), canShareFile: vi.fn() }))
vi.mock('../../lib/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  isIOS: vi.fn(),
}))

const download = vi.mocked(triggerDownload)
const canShare = vi.mocked(canShareFile)
const ios = vi.mocked(isIOS)

// 00:30 on 15 October in Madrid (TZ=Europe/Madrid in vite.config.ts) is still 14 October in UTC,
// which is the date the server puts in Content-Disposition.
const NOW = new Date('2026-10-14T22:30:00Z')
const LOCAL_FILENAME = 'finallyloseweight-export-2026-10-15.json'
const SERVER_FILENAME = 'finallyloseweight-export-2026-10-14.json'
const EXPORT_JSON = '{"exportedAt":"2026-10-14T22:30:00Z","profile":null,"weights":[],"meals":[],"steps":[],"cardio":[]}'

const createObjectURL = vi.fn((_blob: Blob) => 'blob:flw-export')
const revokeObjectURL = vi.fn((_url: string) => {})
let share: ReturnType<typeof vi.fn<(data: ShareData) => Promise<void>>>

function apiReturningExport() {
  const api = createFakeApi()
  // Not a real Response: Node's Response.blob() returns a Node Blob, which jsdom's File cannot read.
  const response = {
    ok: true,
    status: 200,
    headers: new Headers({
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${SERVER_FILENAME}"`,
    }),
    blob: async () => new Blob([EXPORT_JSON], { type: 'application/json' }),
  }
  api.raw.mockResolvedValue(response as unknown as Response)
  return api
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  download.mockReset()
  canShare.mockReset().mockReturnValue(false)
  ios.mockReset().mockReturnValue(false)
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  share = vi.fn<(data: ShareData) => Promise<void>>(async () => {})
  // jsdom has neither object URLs nor the Web Share API.
  Object.assign(URL, { createObjectURL, revokeObjectURL })
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
  Reflect.deleteProperty(navigator, 'share')
})

describe('<ExportData>', () => {
  it('downloads GET /api/me/export named with the local date, not the server UTC date', async () => {
    const user = userEvent.setup()
    const api = apiReturningExport()
    const { unmount } = renderWithProviders(<ExportData />, { api })

    await user.click(screen.getByRole('button', { name: 'Descargar mis datos' }))

    await waitFor(() => expect(download).toHaveBeenCalledExactlyOnceWith('blob:flw-export', LOCAL_FILENAME))
    expect(api.raw).toHaveBeenCalledWith('GET', '/api/me/export')
    expect(screen.getByRole('status')).toHaveTextContent(`Tu archivo ${LOCAL_FILENAME} está listo.`)

    const file = createObjectURL.mock.calls[0]![0] as File
    expect(file.name).toBe(LOCAL_FILENAME)
    expect(file.type).toBe('application/json')
    expect(await file.text()).toBe(EXPORT_JSON)

    const save = screen.getByRole('link', { name: 'Guardar archivo' })
    expect(save).toHaveAttribute('href', 'blob:flw-export')
    expect(save).toHaveAttribute('download', LOCAL_FILENAME)

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:flw-export')
  })

  it('on iOS waits for a direct tap ("Guardar archivo" or "Compartir…") instead of starting the download', async () => {
    const user = userEvent.setup()
    ios.mockReturnValue(true)
    canShare.mockReturnValue(true)
    renderWithProviders(<ExportData />, { api: apiReturningExport() })

    await user.click(screen.getByRole('button', { name: 'Descargar mis datos' }))

    const save = await screen.findByRole('link', { name: 'Guardar archivo' })
    expect(save).toHaveAttribute('download', LOCAL_FILENAME)
    expect(download).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Compartir…' }))
    expect(share).toHaveBeenCalledOnce()
    const data = share.mock.calls[0]![0]
    expect(data.title).toBe('Mis datos de FinallyLoseWeight')
    expect(data.files).toHaveLength(1)
    expect(data.files![0]!.name).toBe(LOCAL_FILENAME)
    expect(screen.queryByText('No se ha podido compartir el archivo.')).not.toBeInTheDocument()
  })

  it('hides "Compartir…" when the browser cannot share files', async () => {
    const user = userEvent.setup()
    ios.mockReturnValue(true)
    renderWithProviders(<ExportData />, { api: apiReturningExport() })

    await user.click(screen.getByRole('button', { name: 'Descargar mis datos' }))

    expect(await screen.findByRole('link', { name: 'Guardar archivo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Compartir…' })).not.toBeInTheDocument()
  })

  it('ignores a cancelled share sheet but reports a failed share', async () => {
    const user = userEvent.setup()
    ios.mockReturnValue(true)
    canShare.mockReturnValue(true)
    renderWithProviders(<ExportData />, { api: apiReturningExport() })
    await user.click(screen.getByRole('button', { name: 'Descargar mis datos' }))
    const shareButton = await screen.findByRole('button', { name: 'Compartir…' })

    share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'))
    await user.click(shareButton)
    expect(screen.queryByText('No se ha podido compartir el archivo.')).not.toBeInTheDocument()

    share.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    await user.click(shareButton)
    expect(await screen.findByText('No se ha podido compartir el archivo.')).toBeInTheDocument()
  })

  it('shows the API error and offers no file when the export fails', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    api.raw.mockRejectedValue(new ApiError({ status: 0, code: 'network_error' }))
    renderWithProviders(<ExportData />, { api })

    await user.click(screen.getByRole('button', { name: 'Descargar mis datos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido conectar con el servidor')
    expect(screen.queryByRole('link', { name: 'Guardar archivo' })).not.toBeInTheDocument()
    expect(download).not.toHaveBeenCalled()
  })
})
