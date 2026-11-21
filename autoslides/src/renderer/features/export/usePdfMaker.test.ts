import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePdfMaker } from './usePdfMaker'

vi.mock('vue', async (importOriginal) => ({ ...await importOriginal<typeof import('vue')>(), onUnmounted: vi.fn() }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const folders = [
  { name: 'slides_a' }, // Trash-only.
  { name: 'slides_b', path: '/out/slides_b' }, // Empty on disk.
  { name: 'slides_c', path: '/out/slides_c' },
  { name: 'slides_d', path: '/out/slides_d' },
]

function setup() {
  const getImages = vi.fn(async (path: string) => path === '/out/slides_b' ? [] : [
    { name: 'Slide_001.png', path: `${path}/Slide_001.png` },
  ])
  const makePdf = vi.fn()
  vi.stubGlobal('window', { electronAPI: { pdfmaker: { getImages, makePdf, onProgress: () => () => {} } } })
  return { getImages, makePdf }
}

afterEach(() => vi.unstubAllGlobals())

describe('Slides export selection', () => {
  it('omits empty folders from the combined export and counts them in the outcome', async () => {
    const { getImages, makePdf } = setup()
    makePdf.mockResolvedValue({ success: true, mode: 'single', format: 'pdf', path: '/out/slides.pdf' })
    const scope = effectScope()
    try {
      const pdf = scope.run(() => usePdfMaker({ folders: ref(folders), selectedNames: ref(folders.map((f) => f.name)) }))!
      expect((await pdf.makePdf()).success).toBe(true)
      expect(getImages).toHaveBeenCalledTimes(3)
      expect(makePdf.mock.calls[0][0].map((entry: { path: string }) => entry.path)).toEqual(['/out/slides_c', '/out/slides_d'])
      expect(pdf.exportOutcome.value).toEqual({ skipped: 2 })
    } finally {
      scope.stop()
    }
  })

  it('keeps empty on-disk folders in separate mode and reports a stopped batch separately from skips', async () => {
    const { makePdf } = setup()
    const scope = effectScope()
    try {
      const selectedNames = ref(folders.map((f) => f.name))
      const pdf = scope.run(() => usePdfMaker({ folders: ref(folders), selectedNames }))!
      pdf.outputMode.value = 'batch'
      makePdf.mockResolvedValueOnce({ success: false, error: 'No images in folder' })
      await pdf.makePdf()
      expect(makePdf.mock.calls[0][0]).toContainEqual(expect.objectContaining({ path: '/out/slides_b', images: [] }))
      expect(pdf.exportOutcome.value).toBeNull()

      selectedNames.value = ['slides_a', 'slides_c', 'slides_d']
      makePdf.mockResolvedValueOnce({ success: false, failedFolder: 'slides_c', paths: [] })
      await pdf.makePdf()
      expect(pdf.exportOutcome.value).toEqual({ skipped: 1, partial: { saved: 0, notAttempted: 1 } })
    } finally {
      scope.stop()
    }
  })
})
