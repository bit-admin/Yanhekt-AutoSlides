import { beforeEach, describe, expect, it, vi } from 'vitest'

const pp = vi.hoisted(() => ({
  addJob: vi.fn(() => 'job-1'),
  abortJob: vi.fn(),
  getJob: vi.fn(() => ({ id: 'job-1', status: 'processing' })),
  subscribe: vi.fn(() => () => {}),
}))

vi.mock('@shared/services/postProcessingService', () => ({ PostProcessingService: pp }))
vi.mock('@shared/services/configStore', () => ({ configStore: { slideExtraction: { enablePngColorReduction: false } } }))
vi.mock('@shared/services/slideMetadataClient', () => ({ recordRecordedExtraction: async () => {} }))
vi.mock('@shared/services/slideTimelineClient', () => ({ ensureRecordedHostFields: async () => {} }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { ExtractionOrchestrator } from './extractionOrchestrator'
import type { DownloadItem } from '@shared/services/downloadService'

let releaseList: (files: string[]) => void
const cancelExtraction = vi.fn(async () => true)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    electronAPI: {
      qtExtractor: {
        runExtraction: async () => ({ success: true, slidesDir: '/out/slides_a' }),
        cancelExtraction,
        onProgress: () => {},
        onSlidesExtracted: () => {},
      },
      slideExtraction: {
        listSlides: () => new Promise<string[]>((resolve) => { releaseList = resolve }),
      },
    },
  })
})

const makeItem = (): DownloadItem =>
  ({
    id: 'item-1',
    videoType: 'screen',
    status: 'completed',
    extractionStatus: 'pending',
    autoPostProcessAfter: true,
    ssimThreshold: 0.99,
    extractionEnableDownsampling: true,
    extractionDownsampleWidth: 480,
    extractionDownsampleHeight: 270,
    extractorOutputDir: '/out',
  }) as unknown as DownloadItem

const runOne = (orchestrator: ExtractionOrchestrator, item: DownloadItem) =>
  (orchestrator as unknown as { runOne(item: DownloadItem, path: string): Promise<void> }).runOne(item, '/out/a.mp4')
const settle = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

describe('cancelling a download while its slides are post-processed', () => {
  it('queues no post-processing when cancelled while the slides were being listed', async () => {
    const orchestrator = new ExtractionOrchestrator()
    const item = makeItem()
    orchestrator.setJobProvider(() => [item])
    const run = runOne(orchestrator, item)
    await settle()
    expect(item.extractionStatus).toBe('extracting')

    // The item is extracting as far as the queue knows; cancelling it now
    // lands while listSlides is still out.
    await orchestrator.cancelExtraction(item.id)
    releaseList(['Slide_1.png'])
    await run

    expect(item.extractionStatus).toBe('cancelled')
    expect(pp.addJob).not.toHaveBeenCalled()
  })

  it('stops the post-processing job of a cancelled item', async () => {
    const orchestrator = new ExtractionOrchestrator()
    const item = makeItem()
    orchestrator.setJobProvider(() => [item])
    const run = runOne(orchestrator, item)
    await settle()
    releaseList(['Slide_1.png'])
    await run
    expect(item.extractionStatus).toBe('post_processing')
    expect(item.postProcessJobId).toBe('job-1')

    await orchestrator.cancelExtraction(item.id)
    expect(item.extractionStatus).toBe('cancelled')
    expect(pp.abortJob).toHaveBeenCalledWith('job-1')
  })
})
