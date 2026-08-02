// Browser-side ZIP assembly for the Slides page (fflate). Bundles a folder's
// slide PNGs unmodified; entries are stored (level 0) since PNG data doesn't
// deflate further and store keeps large folders fast.

import { zipSync, type Zippable } from 'fflate'
import { getSlideBlob } from './slideStore'
import { createLogger } from './logger'
const log = createLogger('ZipExport')

export interface ZipImageEntry {
  name: string
  blobId: string // slide record id in the slideStore
}

/**
 * Assemble a ZIP from the given slides' blobs, reporting per-image progress
 * while blobs are read (zipping itself is a fast in-memory copy).
 */
export async function buildZip(
  images: ZipImageEntry[],
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const files: Zippable = {}
  let current = 0

  for (const image of images) {
    current += 1
    try {
      const blob = await getSlideBlob(image.blobId)
      if (!blob) {
        log.warn(`Missing blob for ${image.blobId}, skipping`)
        continue
      }
      files[image.name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    } catch (error) {
      log.error(`Failed to read ${image.name}:`, error)
    }
    onProgress?.(current, images.length)
    // Let the progress counter paint.
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }

  if (Object.keys(files).length === 0) {
    throw new Error('No images to export')
  }

  // Copyright reminder (see /copyright §5). Advisory only; does not grant a licence.
  const notice = new TextEncoder().encode(
    [
      'COPYRIGHT NOTICE',
      '',
      'This archive may contain copyrighted material.',
      'It is intended for personal study only under your own lawful access rights.',
      'Do not redistribute without authorisation from the rights holder.',
      '',
      'See https://learn.ruc.edu.kg/copyright',
      '',
    ].join('\n'),
  )
  files['COPYRIGHT.txt'] = [notice, { level: 6 }]

  return zipSync(files)
}
