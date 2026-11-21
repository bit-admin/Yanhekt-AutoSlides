import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./broadcastConfig', () => ({ broadcastConfig: vi.fn() }))
vi.mock('@main/platform/proxyControl', () => ({ applyProxySettings: vi.fn() }))
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { parseOutputFolderBusy, type OutputFolderWork } from '@common/outputFolderWork'
import type { ConfigService } from '@main/platform/configService'
import type { IntranetMappingService } from '@main/platform/intranetMappingService'
import { broadcastConfig } from './broadcastConfig'
import { createSettingsWriter } from './settingsWriter'

const idle: OutputFolderWork = { downloads: 0, extractions: 0, tasks: 0, postProcessing: 0, slideVideos: 0, driveUploads: 0, clones: 0 }

function writerWith(work: () => Promise<OutputFolderWork | null>) {
  const setOutputDirectory = vi.fn()
  const configService = { setOutputDirectory, getConfig: () => ({}) } as unknown as ConfigService
  const writer = createSettingsWriter(configService, {} as IntranetMappingService, work)
  return { writer, setOutputDirectory }
}

beforeEach(() => vi.mocked(broadcastConfig).mockClear())

describe('setOutputDirectory', () => {
  it('saves and broadcasts when nothing is running', async () => {
    const { writer, setOutputDirectory } = writerWith(async () => idle)
    await writer.setOutputDirectory('/new')
    expect(setOutputDirectory).toHaveBeenCalledWith('/new')
    expect(broadcastConfig).toHaveBeenCalledTimes(1)
  })

  it('saves when no renderer is up (its queues went with it)', async () => {
    const { writer, setOutputDirectory } = writerWith(async () => null)
    await writer.setOutputDirectory('/new')
    expect(setOutputDirectory).toHaveBeenCalledWith('/new')
  })

  it('saves when the renderer cannot answer (a reload in between)', async () => {
    const { writer, setOutputDirectory } = writerWith(async () => {
      throw new Error('AutoSlides reloaded its window')
    })
    await writer.setOutputDirectory('/new')
    expect(setOutputDirectory).toHaveBeenCalledWith('/new')
  })

  it('refuses with the counts while work is unfinished, and saves nothing', async () => {
    const busy = { ...idle, downloads: 1, postProcessing: 2 }
    const { writer, setOutputDirectory } = writerWith(async () => busy)
    const error = await writer.setOutputDirectory('/new').then(() => null, (e: unknown) => e)
    expect(parseOutputFolderBusy(error)).toEqual(busy)
    expect(setOutputDirectory).not.toHaveBeenCalled()
    expect(broadcastConfig).not.toHaveBeenCalled()
    await expect(writer.assertOutputFolderIdle()).rejects.toThrow(/output folder/)
  })
})
