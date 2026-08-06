// Phase 3b — candidate-only pHash dedup after successful may_be_slide_edit
// auto-crops. Mirrors Results `runPHashDedup` semantics without importing
// features/results: seed `seen` from remaining non-candidates, then compare
// each auto-cropped candidate in order (first crop wins).

import type {
  PipelineDataSource,
  PostProcessingContext,
} from './types'
import type { WorkerHelpers } from './workerHelpers'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('PostCropDedup')

export interface PostCropDedupInput {
  candidates: string[]
  /** Active files that were not auto-cropped in this pass (and not already trashed). */
  nonCandidates: string[]
  pHashThreshold: number
  worker: WorkerHelpers
  dataSource: PipelineDataSource
  ctx: PostProcessingContext
  /** Optional phase-1 hashes for non-candidates (still valid — those files were not cropped). */
  cachedHashes?: Map<string, string>
}

export interface PostCropDedupResult {
  duplicatesRemoved: string[]
}

export async function runPostCropDedup(
  input: PostCropDedupInput,
): Promise<PostCropDedupResult> {
  const {
    candidates,
    nonCandidates,
    pHashThreshold,
    worker,
    dataSource,
    ctx,
    cachedHashes,
  } = input

  if (candidates.length === 0) {
    return { duplicatesRemoved: [] }
  }

  const seen = new Map<string, string>() // pHash -> first filename
  const duplicatesRemoved: string[] = []

  // Seed with non-candidate actives (prefer phase-1 cache; recompute if missing).
  for (const filename of nonCandidates) {
    if (ctx.signal?.aborted) break
    let pHash = cachedHashes?.get(filename) ?? ''
    if (!pHash) {
      try {
        const imageData = await dataSource.readForPHash(filename)
        if (!imageData) continue
        pHash = await worker.calculatePHash(imageData)
      } catch (err) {
        log.warn(`[PostProcessing] post-crop seed pHash failed for ${filename}:`, err)
        continue
      }
    }
    if (!pHash) continue
    // Only store the first filename for a given hash among non-candidates.
    if (!seen.has(pHash)) {
      seen.set(pHash, filename)
    }
  }

  for (const filename of candidates) {
    if (ctx.signal?.aborted) break
    try {
      const imageData = await dataSource.readForPHash(filename)
      if (!imageData) {
        log.warn(`[PostProcessing] post-crop dedup: failed to read ${filename}`)
        continue
      }
      const pHash = await worker.calculatePHash(imageData)
      if (!pHash) continue

      let duplicateOf = ''
      for (const [seenHash, seenFilename] of seen.entries()) {
        try {
          const distance = await worker.calculateHammingDistance(pHash, seenHash)
          if (distance <= pHashThreshold) {
            duplicateOf = seenFilename
            log.debug(
              `[PostProcessing] Post-crop duplicate: ${filename} similar to ${seenFilename} (distance: ${distance})`,
            )
            break
          }
        } catch (err) {
          log.warn('[PostProcessing] post-crop Hamming distance failed:', err)
        }
      }

      if (duplicateOf) {
        const moved = await dataSource.moveToTrash(
          filename,
          'duplicate',
          `Duplicate of ${duplicateOf}`,
        )
        if (moved) {
          duplicatesRemoved.push(filename)
          ctx.onItemRemoved?.(filename, 'duplicate')
        }
      } else {
        seen.set(pHash, filename)
      }
    } catch (err) {
      log.warn(`[PostProcessing] post-crop dedup failed for ${filename}:`, err)
    }
  }

  return { duplicatesRemoved }
}
