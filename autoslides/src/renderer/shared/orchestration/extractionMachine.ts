// Pure state machine for the download→extract→post-process chain (Chain A).
//
// This module has NO Vue / IPC / DOM dependencies — it is the single source of
// truth for *which* extraction-status transitions are legal, and is unit-tested
// in isolation (extractionMachine.test.ts). The effectful orchestrator
// (extractionOrchestrator.ts) is the single *writer*: it computes events from
// real IPC outcomes, runs them through `reduceExtraction`, and applies the
// returned patch. No status field is mutated anywhere else.
//
// The transition rules below encode invariants that previously lived as inline
// guards scattered across the old extractionQueueService (cancel precedence,
// the "progress only while extracting" guard, terminal-state immutability, the
// no-post-process / empty-slides completion branches).

import type { ExtractionStatus } from '@shared/services/downloadService'

export type ExtractionEvent =
  | { type: 'MARK_PENDING' }
  | { type: 'DOWNLOAD_FAILED'; error: string }
  | { type: 'EXTRACT_STARTED' }
  | { type: 'EXTRACT_PROGRESS'; percent: number }
  | { type: 'EXTRACT_FAILED'; error: string }
  | { type: 'NORMALIZE_STARTED' }
  | { type: 'NORMALIZE_FAILED'; error: string }
  | { type: 'POSTPROCESS_STARTED' }
  | { type: 'POSTPROCESS_DONE' }
  | { type: 'POSTPROCESS_FAILED'; error: string }
  | { type: 'FINISH' }
  | { type: 'CANCEL' }

/** Patch to apply to the DownloadItem's extraction fields. */
export interface ExtractionPatch {
  status?: ExtractionStatus
  progress?: number
  error?: string
}

/** Terminal states from which no event can escape. */
export function isTerminalExtraction(status: ExtractionStatus | undefined): boolean {
  return status === 'completed' || status === 'error' || status === 'cancelled'
}

function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)))
}

/**
 * Decide the patch for `event` given the `current` extraction status.
 * Returns `null` when the event is illegal or a no-op in the current state
 * (e.g. progress while not extracting, or anything once terminal). The caller
 * applies the patch (and only the patch) to the item.
 */
export function reduceExtraction(
  current: ExtractionStatus | undefined,
  event: ExtractionEvent
): ExtractionPatch | null {
  // Terminal immutability — nothing escapes completed / error / cancelled.
  // This is what makes CANCEL "win": once an in-flight stage flips the status
  // to 'cancelled', any later advance event (FINISH, NORMALIZE_STARTED, …) that
  // lost the race with a clean exit becomes a no-op.
  if (isTerminalExtraction(current)) return null

  switch (event.type) {
    case 'MARK_PENDING':
      return { status: 'pending', progress: 0 }

    case 'DOWNLOAD_FAILED':
      // Only meaningful while the item is still waiting to extract.
      if (current !== 'pending') return null
      return { status: 'cancelled', error: event.error }

    case 'EXTRACT_STARTED':
      return { status: 'extracting', progress: 0 }

    case 'EXTRACT_PROGRESS':
      // Progress updates only land while actively extracting.
      if (current !== 'extracting') return null
      return { progress: clampPercent(event.percent) }

    case 'EXTRACT_FAILED':
      return { status: 'error', error: event.error }

    case 'NORMALIZE_STARTED':
      return { status: 'normalizing' }

    case 'NORMALIZE_FAILED':
      return { status: 'error', error: event.error }

    case 'POSTPROCESS_STARTED':
      return { status: 'post_processing' }

    case 'POSTPROCESS_DONE':
      return { status: 'completed', progress: 100 }

    case 'POSTPROCESS_FAILED':
      return { status: 'error', error: event.error }

    case 'FINISH':
      return { status: 'completed', progress: 100 }

    case 'CANCEL':
      return { status: 'cancelled' }

    default:
      return null
  }
}
