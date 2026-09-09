// Export state + orchestration for a single folder on the Slides page
// (invoked from the folder review view's bottom action bar). Trimmed shape of
// the desktop usePdfMaker (autoslides/src/renderer/features/export/
// usePdfMaker.ts): PDF (with a folder bookmark) or ZIP of the original PNGs;
// no size reduction / cover page / multi-folder combining.

import { ref } from 'vue'
import { buildPdf, downloadBlob, type PdfFolderEntry } from '../lib/pdfExport'
import { buildZip } from '../lib/zipExport'
import { listActiveImages } from '../lib/slideStore'
import { compareToolImages, formatToolFolderName } from '../lib/toolFolders'
import { sanitizeFileName } from '../lib/sanitizeFileName'
import { createLogger } from '../lib/logger'
const log = createLogger('SlidesExport')

export type ExportFormat = 'pdf' | 'zip'

export function useSlidesExport() {
  const isExporting = ref(false)
  // Which format is currently generating (drives per-button spinners).
  const exportingFormat = ref<ExportFormat | null>(null)
  const exportProgress = ref({ current: 0, total: 0 })

  async function collectFolderEntry(folderName: string): Promise<PdfFolderEntry> {
    const images = await listActiveImages(folderName)
    images.sort((a, b) => compareToolImages(a.name, b.name))
    return {
      title: formatToolFolderName(folderName),
      images: images.map((image) => ({ name: image.name, blobId: image.path })),
    }
  }

  /**
   * Export the folder's active slides. Returns true when a file was produced
   * and handed to the browser as a download.
   */
  async function exportFolder(folderName: string, format: ExportFormat): Promise<boolean> {
    // The demo is a static demonstration and hands back no files. `__DEMO__` is
    // a compile-time constant, so this is not just a guard: it makes the rest of
    // the function dead in the demo build, and pdf-lib / fflate / UPNG go with
    // it. (The disabled button in SlidesPage keeps the affordance visible; this
    // is what actually keeps the encoders out of the bundle.)
    if (__DEMO__) return false
    if (isExporting.value) return false

    isExporting.value = true
    exportingFormat.value = format
    exportProgress.value = { current: 0, total: 0 }

    try {
      const entry = await collectFolderEntry(folderName)
      if (entry.images.length === 0) return false

      exportProgress.value = { current: 0, total: entry.images.length }
      const onProgress = (current: number, total: number) => {
        exportProgress.value = { current, total }
      }
      const baseName = sanitizeFileName(entry.title) || 'slides'

      if (format === 'pdf') {
        const data = await buildPdf([entry], onProgress)
        downloadBlob(data, `${baseName}.pdf`, 'application/pdf')
      } else {
        const data = await buildZip(entry.images, onProgress)
        downloadBlob(data, `${baseName}.zip`, 'application/zip')
      }
      return true
    } catch (error) {
      log.error(`${format.toUpperCase()} export failed:`, error)
      return false
    } finally {
      isExporting.value = false
      exportingFormat.value = null
    }
  }

  return {
    isExporting,
    exportingFormat,
    exportProgress,
    exportFolder,
  }
}

export type UseSlidesExportReturn = ReturnType<typeof useSlidesExport>
