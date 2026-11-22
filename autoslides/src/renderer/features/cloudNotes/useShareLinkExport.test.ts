import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordCaptureConfirmed } from '@common/sidecars/timeline'
import { activeClones } from '@shared/services/cloneActivity'
import { useShareLinkExport } from './useShareLinkExport'

afterEach(() => vi.unstubAllGlobals())

const stage = '/out/.autoslides-clone-test'
const url = 'https://example.test/slide.png'

function bridge(exists = false) {
  const calls: string[] = []
  const api = {
    cloudNotes: {
      exportFolderStatus: vi.fn(async () => ({ ok: true, data: { exists, dir: '/out/slides_test', folderName: 'slides_test' } })),
      prepareCloneStage: vi.fn(async () => ({ ok: true, data: { exists: true, dir: stage, folderName: '.autoslides-clone-test' } })),
      downloadImageToFolder: vi.fn(async (): Promise<{ ok: boolean; error?: string }> => { calls.push('download'); return { ok: true } }),
      publishCloneStage: vi.fn(async (): Promise<unknown> => { calls.push('publish'); return { ok: true, data: { exists: true, dir: '/out/slides_test', folderName: 'slides_test' } } }),
      discardCloneStage: vi.fn(async () => { calls.push('discard'); return { ok: true } }),
    },
    drive: { recordClone: vi.fn(async (): Promise<{ ok: boolean }> => { calls.push('metadata'); return { ok: true } }) },
    slideTimeline: { write: vi.fn(async (): Promise<{ success: boolean }> => ({ success: true })) },
    trash: { removeFolders: vi.fn(async () => { calls.push('retire'); return { removed: 1, failed: 0 } }) },
  }
  vi.stubGlobal('window', { electronAPI: api })
  return { api, calls }
}

describe('Clone Slides from Link', () => {
  it.each([0, 1])('writes the timeline only for a complete clone (missing: %i)', async (missing) => {
    const { api } = bridge()
    const clone = useShareLinkExport()
    const timeline = recordCaptureConfirmed(null, { changeAt: 30, confirmedAt: 32, file: 'Slide_001.png' })
    await clone.startExport({ title: 'Test', urls: [url], missing, timeline })
    expect(clone.item.value).toMatchObject({ downloaded: 1, missing, status: 'done' })
    if (missing) expect(api.slideTimeline.write).not.toHaveBeenCalled()
    else expect(api.slideTimeline.write).toHaveBeenCalledWith(stage, timeline)
    expect(activeClones.value).toBe(0)
  })

  it('moves the old folder only after the new one is complete', async () => {
    const { calls } = bridge(true)
    const clone = useShareLinkExport()
    await clone.startExport({ title: 'Test', urls: [url], missing: 0 })
    expect(clone.item.value?.status).toBe('conflict')
    await clone.resolveConflict('replace')
    expect(calls).toEqual(['download', 'metadata', 'retire', 'publish'])
    expect(clone.item.value?.status).toBe('done')
  })

  it('hands the short link it came from to metadata.json', async () => {
    const { api } = bridge()
    const clone = useShareLinkExport()
    const sourceLink = { longUrl: 'https://example.test/v1#abc', shortUrl: 'https://example.test/v1/s/Test123' }
    await clone.startExport({ title: 'Test', urls: [url], missing: 0, sourceLink })
    expect(api.drive.recordClone).toHaveBeenCalledWith(stage, expect.objectContaining({ sourceLink }))
  })

  it('leaves the old folder alone when an image fails', async () => {
    const { api, calls } = bridge(true)
    api.cloudNotes.downloadImageToFolder.mockResolvedValueOnce({ ok: false, error: 'network' })
    const clone = useShareLinkExport()
    await clone.startExport({ title: 'Test', urls: [url], missing: 0 })
    await clone.resolveConflict('replace')
    expect(clone.item.value).toMatchObject({ status: 'error', failure: 'unchanged' })
    expect(calls).toEqual(['discard'])
  })

  it('publishes nothing when the old folder cannot be moved', async () => {
    const { api, calls } = bridge(true)
    api.trash.removeFolders.mockResolvedValueOnce({ removed: 0, failed: 1 })
    const clone = useShareLinkExport()
    await clone.startExport({ title: 'Test', urls: [url], missing: 0 })
    await clone.resolveConflict('replace')
    expect(clone.item.value).toMatchObject({ status: 'error', failure: 'old-kept' })
    expect(calls).toEqual(['download', 'metadata', 'discard'])
  })

  it('keeps the finished clone when it cannot be put in place after a replace', async () => {
    const { api, calls } = bridge(true)
    api.cloudNotes.publishCloneStage.mockResolvedValueOnce({ ok: false, error: 'EPERM' })
    const clone = useShareLinkExport()
    await clone.startExport({ title: 'Test', urls: [url], missing: 0 })
    await clone.resolveConflict('replace')
    expect(clone.item.value).toMatchObject({ status: 'error', failure: 'stage-kept', stagedDir: stage })
    expect(calls).not.toContain('discard')
  })

  it('treats a metadata failure as a failed clone', async () => {
    const { api, calls } = bridge()
    api.drive.recordClone.mockResolvedValueOnce({ ok: false })
    const clone = useShareLinkExport()
    await clone.startExport({ title: 'Test', urls: [url], missing: 0 })
    expect(clone.item.value).toMatchObject({ status: 'error', failure: 'unchanged' })
    expect(calls).toContain('discard')
    expect(calls).not.toContain('publish')
  })
})
