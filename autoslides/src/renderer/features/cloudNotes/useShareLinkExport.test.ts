import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordCaptureConfirmed } from '@common/sidecars/timeline'
import { useShareLinkExport } from './useShareLinkExport'

afterEach(() => vi.unstubAllGlobals())

describe('Clone Slides from Link', () => {
  it.each([0, 1])('writes the timeline only for a complete clone (missing: %i)', async (missing) => {
    const write = vi.fn(async (_dir: string, timeline: unknown) => structuredClone(timeline))
    vi.stubGlobal('window', { electronAPI: {
      cloudNotes: {
        exportFolderStatus: async () => ({ ok: true, data: { exists: false } }),
        prepareExportFolder: async () => ({ ok: true, data: { dir: '/out/slides_test', folderName: 'slides_test' } }),
        downloadImageToFolder: async () => ({ ok: true }),
      },
      drive: { recordClone: async () => ({ ok: true }) },
      slideTimeline: { write },
    } })
    const clone = useShareLinkExport()
    const timeline = recordCaptureConfirmed(null, { changeAt: 30, confirmedAt: 32, file: 'Slide_001.png' })
    await clone.startExport({ title: 'Test', urls: ['https://example.test/slide.png'], missing, timeline })
    expect(clone.item.value).toMatchObject({ downloaded: 1, missing, status: 'done' })
    if (missing) expect(write).not.toHaveBeenCalled()
    else expect(write).toHaveBeenCalledWith('/out/slides_test', timeline)
  })
})
