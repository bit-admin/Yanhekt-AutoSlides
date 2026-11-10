// Phase 1 — duplicate removal via pHash + Hamming distance, confirmed by SSIM.
//
// Operates on an in-memory list of (filename, pHash) pairs computed by the
// pipeline's pHash pass. pHash is the quick filter; with a `ssimCheck`, a match
// is trashed only if SSIM also says it is the same slide, otherwise the search
// goes on through the other kept slides. Trash moves happen per-duplicate as
// they're detected so partial progress is visible immediately.

import type {
  DuplicateSSIMCheck,
  PipelineDataSource,
  PostProcessingContext,
  SlideHashInfo
} from './types'
import type { WorkerHelpers } from './workerHelpers'
import type { GrayImage } from '@shared/workers/pHashWorkerClient'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('Phase1Duplicates');

export interface DuplicatePhaseResult {
  duplicatesRemoved: string[]
}

export async function runDuplicatePhase(
  slideHashes: SlideHashInfo[],
  pHashThreshold: number,
  worker: WorkerHelpers,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  reportProgress: (processed: number, removed: number) => void,
  ssimCheck?: DuplicateSSIMCheck
): Promise<DuplicatePhaseResult> {
  const seenHashes = new Map<string, string>() // pHash -> first filename seen
  const removed: string[] = []
  const confirm = ssimCheck && ssimCheck.ssimThreshold > 0
    ? createSSIMConfirmer(ssimCheck, worker, dataSource)
    : null

  for (let i = 0; i < slideHashes.length; i++) {
    if (ctx.signal?.aborted) break

    const item = slideHashes[i]
    if (item.error || !item.pHash) {
      reportProgress(i + 1, removed.length)
      continue
    }

    let duplicateOf = ''
    for (const [seenHash, seenFilename] of seenHashes.entries()) {
      try {
        const distance = await worker.calculateHammingDistance(item.pHash, seenHash)
        if (distance <= pHashThreshold) {
          if (confirm && !(await confirm(seenFilename, item.filename, distance))) continue
          duplicateOf = seenFilename
          log.debug(
            `[PostProcessing] Duplicate: ${item.filename} similar to ${seenFilename} (distance: ${distance})`
          )
          break
        }
      } catch (error) {
        log.warn('[PostProcessing] Hamming distance calculation failed:', error)
      }
    }

    if (duplicateOf) {
      const moved = await dataSource.moveToTrash(
        item.filename,
        'duplicate',
        `Duplicate of ${duplicateOf}`,
        duplicateOf
      )
      if (moved) {
        removed.push(item.filename)
        ctx.onItemRemoved?.(item.filename, 'duplicate')
      }
    } else {
      seenHashes.set(item.pHash, item.filename)
    }
    reportProgress(i + 1, removed.length)
  }

  return { duplicatesRemoved: removed }
}

/**
 * Returns a check that says whether a pHash match is also an SSIM match.
 * Prepared (downsampled grayscale) images are cached per file; only files in
 * a pHash match are ever read. If either image cannot be read or compared,
 * pHash decides, as before.
 */
function createSSIMConfirmer(
  check: DuplicateSSIMCheck,
  worker: WorkerHelpers,
  dataSource: PipelineDataSource
): (kept: string, candidate: string, distance: number) => Promise<boolean> {
  const prepared = new Map<string, Promise<GrayImage | null>>()
  const options = {
    enableDownsampling: check.enableDownsampling,
    downsampleWidth: check.downsampleWidth,
    downsampleHeight: check.downsampleHeight,
  }

  const load = (filename: string): Promise<GrayImage | null> => {
    let entry = prepared.get(filename)
    if (!entry) {
      entry = (async () => {
        try {
          const imageData = await dataSource.readForPHash(filename)
          return imageData ? await worker.prepareForSSIM(imageData, options) : null
        } catch (error) {
          log.warn(`[PostProcessing] SSIM prepare failed for ${filename}:`, error)
          return null
        }
      })()
      prepared.set(filename, entry)
    }
    return entry
  }

  return async (kept, candidate, distance) => {
    const [a, b] = await Promise.all([load(kept), load(candidate)])
    if (!a || !b) return true
    let ssim: number
    try {
      ssim = await worker.ssimFromGray(a, b)
    } catch (error) {
      log.warn('[PostProcessing] SSIM check failed:', error)
      return true
    }
    if (ssim < check.ssimThreshold) {
      log.info(
        `[PostProcessing] Kept ${candidate}: pHash distance ${distance} to ${kept}, ` +
          `but SSIM ${ssim.toFixed(5)} < ${check.ssimThreshold}`
      )
      return false
    }
    return true
  }
}
