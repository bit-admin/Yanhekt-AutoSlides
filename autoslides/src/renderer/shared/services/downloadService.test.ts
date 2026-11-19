import { afterEach, expect, it, vi } from 'vitest'
import { DownloadService } from './downloadService'

vi.mock('./apiClient', () => ({ ApiClient: class {
  async getMicAudioUrl() { return 'https://media.example.test/audio.aac' }
} }))
vi.mock('./authService', () => ({ tokenManager: { getToken: () => '' } }))
vi.mock('./configStore', () => ({ configStore: {} }))
vi.mock('./extractionQueueService', () => ({ ExtractionQueue: {
  setJobProvider: vi.fn(), markPendingIfApplicable: vi.fn(), ensureWorker: vi.fn(), notifyChange: vi.fn(),
} }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), error: vi.fn() }) }))

afterEach(() => {
  DownloadService.clearCompleted()
  vi.unstubAllGlobals()
})

type DownloadApi = typeof window.electronAPI.download

async function queue(videoType: 'camera' | 'audio') {
  const download = {
    start: vi.fn(async () => {}),
    startAudio: vi.fn(async () => {}),
    onProgress: vi.fn<DownloadApi['onProgress']>(() => vi.fn()),
    onCompleted: vi.fn<DownloadApi['onCompleted']>(() => vi.fn()),
    onError: vi.fn<DownloadApi['onError']>(() => vi.fn()),
  }
  vi.stubGlobal('window', { electronAPI: { download } })
  const result = DownloadService.addToQueue({
    name: 'Test recording', courseTitle: 'Test course', sessionTitle: 'Test session', sessionId: '850101', videoType,
    session: { session: {
      id: '850102', session_id: '850101', video_id: '850102', title: 'Test session',
      duration: 3600, week_number: 1, day: 1, started_at: '', ended_at: '',
      main_url: 'https://media.example.test/playlist.m3u8',
    } },
  })
  if (!result.added) throw new Error('Test item was not added')
  await vi.waitFor(() => expect(videoType === 'audio' ? download.startAudio : download.start).toHaveBeenCalledOnce())
  const { item } = result
  return {
    item,
    report: (phase: number, current: number, total: number) =>
      download.onProgress.mock.calls[0][0](item.id, { current, total, phase }),
    complete: (filePath: string) => download.onCompleted.mock.calls[0][0](item.id, filePath),
  }
}

it('keeps overall progress moving forward and reserves 100% for completion', async () => {
  const { item, report, complete } = await queue('camera')
  report(0, 10, 10)
  expect(item).toMatchObject({ status: 'downloading', progress: 90 })
  report(1, 0, 100)
  expect(item).toMatchObject({ status: 'processing', progress: 90 })
  report(1, 50, 100)
  expect(item.progress).toBe(95)
  report(1, 10, 100) // FFmpeg fallback started again.
  report(0, 5, 10) // A late downloading update cannot move the phase back.
  expect(item).toMatchObject({ status: 'processing', progress: 95 })
  report(1, 100, 100)
  report(2, 10, 10)
  expect(item).toMatchObject({ status: 'processing', progress: 99 })
  expect(item.filePath).toBeUndefined()
  complete('/test/recording.mp4')
  expect(item).toMatchObject({ status: 'completed', progress: 100, filePath: '/test/recording.mp4' })
})

it('can finish a single-stage audio download with no content length', async () => {
  const { item, report, complete } = await queue('audio')
  report(0, 12, 0)
  expect(item).toMatchObject({ status: 'downloading', progress: 0 })
  complete('/test/recording.aac')
  expect(item).toMatchObject({ status: 'completed', progress: 100 })
})
