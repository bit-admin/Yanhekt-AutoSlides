// Phase 1 — duplicate removal via pHash + Hamming distance.
//
// Operates on an in-memory list of (filename, pHash) pairs computed by the
// pipeline's pHash pass. Trash moves happen per-duplicate as they're detected
// so partial progress is visible immediately.

import type {
  PipelineDataSource,
  PostProcessingContext,
  SlideHashInfo
} from './types'
import type { WorkerHelpers } from './workerHelpers'

export interface DuplicatePhaseResult {
  duplicatesRemoved: string[]
}

export async function runDuplicatePhase(
  slideHashes: SlideHashInfo[],
  pHashThreshold: number,
  worker: WorkerHelpers,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  reportProgress: (processed: number, removed: number) => void
): Promise<DuplicatePhaseResult> {
  const seenHashes = new Map<string, string>() // pHash -> first filename seen
  const removed: string[] = []

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
          duplicateOf = seenFilename
          console.log(
            `[PostProcessing] Duplicate: ${item.filename} similar to ${seenFilename} (distance: ${distance})`
          )
          break
        }
      } catch (error) {
        console.warn('[PostProcessing] Hamming distance calculation failed:', error)
      }
    }

    if (duplicateOf) {
      await dataSource.moveToTrash(
        item.filename,
        'duplicate',
        `Duplicate of ${duplicateOf}`
      )
      removed.push(item.filename)
      ctx.onItemRemoved?.(item.filename, 'duplicate')
    } else {
      seenHashes.set(item.pHash, item.filename)
    }
    reportProgress(i + 1, removed.length)
  }

  return { duplicatesRemoved: removed }
}
