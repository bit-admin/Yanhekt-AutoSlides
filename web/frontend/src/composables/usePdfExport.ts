// Export state + orchestration for the Slides page.
// Trimmed shape of the desktop usePdfMaker (autoslides/src/renderer/features/
// export/usePdfMaker.ts): PDF only, no size reduction / cover page / custom
// ordering this round. Single mode combines all selected folders into one
// document with per-folder bookmarks; batch mode downloads one PDF per folder
// sequentially (parallel downloads trip browser multi-download blocking).

import { ref } from 'vue'
import { buildPdf, downloadBlob, type PdfFolderEntry } from '../lib/pdfExport'
import { listActiveImages } from '../lib/slideStore'
import { compareToolFolders, compareToolImages, formatToolFolderName } from '../lib/toolFolders'
import { sanitizeFileName } from '../lib/sanitizeFileName'
import { createLogger } from '../lib/logger'
const log = createLogger('PdfExport')

export type PdfOutputMode = 'single' | 'batch'

export function usePdfExport() {
  const outputMode = ref<PdfOutputMode>('single')
  const isGenerating = ref(false)
  const generateProgress = ref({ current: 0, total: 0 })

  async function collectFolderEntry(folderName: string): Promise<PdfFolderEntry> {
    const images = await listActiveImages(folderName)
    images.sort((a, b) => compareToolImages(a.name, b.name))
    return {
      title: formatToolFolderName(folderName),
      images: images.map((image) => ({ name: image.name, blobId: image.path })),
    }
  }

  /**
   * Export the given folders (by name). Returns true when at least one PDF
   * was produced and handed to the browser as a download.
   */
  async function makePdf(folderNames: string[]): Promise<boolean> {
    if (isGenerating.value || folderNames.length === 0) return false

    const ordered = [...folderNames].sort(compareToolFolders)
    isGenerating.value = true
    generateProgress.value = { current: 0, total: 0 }

    try {
      const entries = await Promise.all(ordered.map(collectFolderEntry))
      const nonEmpty = entries.filter((entry) => entry.images.length > 0)
      if (nonEmpty.length === 0) return false

      const totalImages = nonEmpty.reduce((sum, entry) => sum + entry.images.length, 0)
      generateProgress.value = { current: 0, total: totalImages }

      if (outputMode.value === 'single') {
        const data = await buildPdf(nonEmpty, (current) => {
          generateProgress.value = { current, total: totalImages }
        })
        const date = new Date().toISOString().slice(0, 10)
        downloadBlob(data, `AutoSlides_${date}.pdf`)
      } else {
        let done = 0
        for (const entry of nonEmpty) {
          const data = await buildPdf([entry], (current) => {
            generateProgress.value = { current: done + current, total: totalImages }
          })
          downloadBlob(data, `${sanitizeFileName(entry.title) || 'slides'}.pdf`)
          done += entry.images.length
        }
      }
      return true
    } catch (error) {
      log.error('PDF export failed:', error)
      return false
    } finally {
      isGenerating.value = false
    }
  }

  return {
    outputMode,
    isGenerating,
    generateProgress,
    makePdf,
  }
}

export type UsePdfExportReturn = ReturnType<typeof usePdfExport>
