import { describe, expect, it, vi } from 'vitest'
import { runDuplicatePhase } from './phase1Duplicates'
import type { DuplicateSSIMCheck, PipelineDataSource, SlideHashInfo } from './types'
import type { WorkerHelpers } from './workerHelpers'
import type { GrayImage } from '@shared/workers/pHashWorkerClient'

const CHECK: DuplicateSSIMCheck = {
  ssimThreshold: 0.9987,
  enableDownsampling: true,
  downsampleWidth: 480,
  downsampleHeight: 270,
}

// Every hash is within the pHash threshold of every other, so only SSIM decides.
const hashes: SlideHashInfo[] = [
  { filename: 'a.png', pHash: 'h1' },
  { filename: 'b.png', pHash: 'h2' },
  { filename: 'c.png', pHash: 'h3' },
]

/** `ssim` maps a sorted "x|y" filename pair to its score. */
function setup(ssim: Record<string, number>, failRead: string[] = []) {
  const gray = (name: string): GrayImage =>
    ({ width: 1, height: 1, gray: new Uint8Array([0]), name }) as unknown as GrayImage
  const worker: WorkerHelpers = {
    calculatePHash: vi.fn(),
    calculateHammingDistance: vi.fn(async () => 0),
    prepareForSSIM: vi.fn(async (img: ImageData) => gray((img as unknown as { name: string }).name)),
    ssimFromGray: vi.fn(async (a: GrayImage, b: GrayImage) => {
      const key = [(a as unknown as { name: string }).name, (b as unknown as { name: string }).name]
        .sort()
        .join('|')
      return ssim[key] ?? 0
    }),
  }
  const trashed: Array<[string, string | undefined]> = []
  const dataSource: PipelineDataSource = {
    readForPHash: vi.fn(async (name: string) =>
      failRead.includes(name) ? null : ({ name } as unknown as ImageData),
    ),
    readForAI: vi.fn(),
    moveToTrash: vi.fn(async (name, _reason, _details, duplicateOf) => {
      trashed.push([name, duplicateOf])
      return true
    }),
  }
  return { worker, dataSource, trashed }
}

describe('runDuplicatePhase SSIM confirmation', () => {
  it('without a check, pHash alone decides', async () => {
    const { worker, dataSource } = setup({})
    const result = await runDuplicatePhase(hashes, 10, worker, dataSource, {}, () => {})
    expect(result.duplicatesRemoved).toEqual(['b.png', 'c.png'])
    expect(worker.ssimFromGray).not.toHaveBeenCalled()
  })

  it('keeps a pHash match that SSIM rejects (reveal step)', async () => {
    const { worker, dataSource } = setup({ 'a.png|b.png': 0.998, 'a.png|c.png': 0.9995 })
    const result = await runDuplicatePhase(hashes, 10, worker, dataSource, {}, () => {}, CHECK)
    expect(result.duplicatesRemoved).toEqual(['c.png'])
  })

  it('keeps searching the other kept slides after an SSIM rejection', async () => {
    const { worker, dataSource, trashed } = setup({
      'a.png|b.png': 0.99,
      'a.png|c.png': 0.99,
      'b.png|c.png': 0.9999,
    })
    const result = await runDuplicatePhase(hashes, 10, worker, dataSource, {}, () => {}, CHECK)
    expect(result.duplicatesRemoved).toEqual(['c.png'])
    expect(trashed).toEqual([['c.png', 'b.png']])
  })

  it('falls back to pHash when an image cannot be read for SSIM', async () => {
    const { worker, dataSource } = setup({}, ['b.png'])
    const result = await runDuplicatePhase(hashes.slice(0, 2), 10, worker, dataSource, {}, () => {}, CHECK)
    expect(result.duplicatesRemoved).toEqual(['b.png'])
  })

  it('a threshold of 0 turns the check off', async () => {
    const { worker, dataSource } = setup({})
    const result = await runDuplicatePhase(hashes, 10, worker, dataSource, {}, () => {}, {
      ...CHECK,
      ssimThreshold: 0,
    })
    expect(result.duplicatesRemoved).toEqual(['b.png', 'c.png'])
  })

  it('prepares each image once', async () => {
    const { worker, dataSource } = setup({ 'a.png|b.png': 0.99, 'a.png|c.png': 0.99, 'b.png|c.png': 0.99 })
    await runDuplicatePhase(hashes, 10, worker, dataSource, {}, () => {}, CHECK)
    expect(worker.prepareForSSIM).toHaveBeenCalledTimes(3)
  })
})
