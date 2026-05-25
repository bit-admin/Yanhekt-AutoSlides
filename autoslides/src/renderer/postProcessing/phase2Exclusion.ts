// Phase 2 — exclusion-list filtering via pHash + Hamming distance.
//
// Skips files already removed in phase 1. Trash moves happen per-match so the UI
// reflects deletions immediately.

import type {
  ExclusionItem,
  PipelineDataSource,
  PostProcessingContext,
  SlideHashInfo
} from './types'
import type { WorkerHelpers } from './workerHelpers'

export interface ExclusionPhaseResult {
  excludedRemoved: string[]
}

export async function runExclusionPhase(
  slideHashes: SlideHashInfo[],
  alreadyRemoved: Set<string>,
  exclusionList: ExclusionItem[],
  pHashThreshold: number,
  worker: WorkerHelpers,
  dataSource: PipelineDataSource,
  ctx: PostProcessingContext,
  reportProgress: (processed: number, removed: number) => void
): Promise<ExclusionPhaseResult> {
  const removed: string[] = []

  for (let i = 0; i < slideHashes.length; i++) {
    if (ctx.signal?.aborted) break

    const item = slideHashes[i]
    if (item.error || !item.pHash || alreadyRemoved.has(item.filename)) {
      reportProgress(i + 1, removed.length)
      continue
    }

    let excludedReason = ''
    for (const exclusionItem of exclusionList) {
      try {
        const distance = await worker.calculateHammingDistance(item.pHash, exclusionItem.pHash)
        if (distance <= pHashThreshold) {
          excludedReason = `Similar to "${exclusionItem.name}" (distance: ${distance})`
          console.log(`[PostProcessing] Excluded: ${item.filename} - ${excludedReason}`)
          break
        }
      } catch (error) {
        console.warn(
          `[PostProcessing] Exclusion check failed for ${item.filename} vs "${exclusionItem.name}":`,
          error
        )
      }
    }

    if (excludedReason) {
      const moved = await dataSource.moveToTrash(item.filename, 'exclusion', excludedReason)
      if (moved) {
        removed.push(item.filename)
        ctx.onItemRemoved?.(item.filename, 'exclusion')
      }
    }
    reportProgress(i + 1, removed.length)
  }

  return { excludedRemoved: removed }
}
