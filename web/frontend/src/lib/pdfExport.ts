// Browser-side PDF assembly for the Slides page (pdf-lib).
// Web replacement for the desktop's main-process pdfService (pdfkit): one
// page per image sized to the image's pixel dimensions, and a PDF outline
// entry per folder pointing at its first page. Outline titles are UTF-16
// text strings, so CJK folder names need no font embedding. Cover pages and
// size reduction are desktop-only for now.

// pdf-lib is imported dynamically inside buildPdf so its ~400 KB stays out of
// the main chunk (export is a rare action); only types are imported statically.
import type { PDFDocument, PDFObject, PDFRef } from 'pdf-lib'
import { getSlideBlob } from './slideStore'
import { createLogger } from './logger'
const log = createLogger('PdfExport')

export interface PdfImageEntry {
  name: string
  blobId: string // slide record id in the slideStore
}

export interface PdfFolderEntry {
  /** Display name — used as the outline (bookmark) title. */
  title: string
  images: PdfImageEntry[]
}

interface OutlineItem {
  title: string
  pageIndex: number
}

type PdfLibModule = typeof import('pdf-lib')

/**
 * Attach a flat outline (one bookmark per folder) to the document.
 * pdf-lib has no high-level outline API, so the /Outlines dictionary chain is
 * built directly in the document context.
 */
function addOutline(pdfLib: PdfLibModule, doc: PDFDocument, items: OutlineItem[]): void {
  if (items.length === 0) return
  const { PDFHexString, PDFName } = pdfLib
  const context = doc.context
  const pageRefs = doc.getPages().map((page) => page.ref)

  const outlinesRef = context.nextRef()
  const itemRefs: PDFRef[] = items.map(() => context.nextRef())

  items.forEach((item, i) => {
    const dict: Record<string, PDFObject | PDFObject[] | string> = {
      Title: PDFHexString.fromText(item.title),
      Parent: outlinesRef,
      Dest: [pageRefs[item.pageIndex], PDFName.of('Fit')],
    }
    if (i > 0) dict.Prev = itemRefs[i - 1]
    if (i < items.length - 1) dict.Next = itemRefs[i + 1]
    context.assign(itemRefs[i], context.obj(dict))
  })

  context.assign(
    outlinesRef,
    context.obj({
      Type: 'Outlines',
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: items.length,
    }),
  )
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef)
}

/**
 * Assemble a PDF from the given folders' slide blobs.
 * Reports per-image progress and yields to the event loop between images so
 * the UI can render the progress counter.
 */
export async function buildPdf(
  folders: PdfFolderEntry[],
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const pdfLib = await import('pdf-lib')
  const doc = await pdfLib.PDFDocument.create()
  const outlineItems: OutlineItem[] = []
  const total = folders.reduce((sum, folder) => sum + folder.images.length, 0)
  let current = 0

  for (const folder of folders) {
    let firstPageOfFolder = -1

    for (const image of folder.images) {
      current += 1
      try {
        const blob = await getSlideBlob(image.blobId)
        if (!blob) {
          log.warn(`Missing blob for ${image.blobId}, skipping`)
          continue
        }
        const png = await doc.embedPng(await blob.arrayBuffer())
        const page = doc.addPage([png.width, png.height])
        page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height })
        if (firstPageOfFolder === -1) {
          firstPageOfFolder = doc.getPageCount() - 1
        }
      } catch (error) {
        log.error(`Failed to embed ${image.name}:`, error)
      }
      onProgress?.(current, total)
      // Let the progress counter paint.
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    if (firstPageOfFolder !== -1) {
      outlineItems.push({ title: folder.title, pageIndex: firstPageOfFolder })
    }
  }

  if (doc.getPageCount() === 0) {
    throw new Error('No images to export')
  }

  addOutline(pdfLib, doc, outlineItems)
  return doc.save()
}

export function downloadBlob(data: Uint8Array, filename: string): void {
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
