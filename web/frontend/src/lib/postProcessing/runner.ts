// Post-processing runner — the web analogue of the desktop's
// usePostProcessing slice. Runs the pHash phases (duplicates + exclusion) plus
// AI filtering (when enabled + configured) on a folder, detached from any Vue
// component so SPA navigation away from the playback page doesn't cancel an
// in-flight run. Two entry points share one pass core:
//  - runPostProcessing: the manual Post-process button (desktop gallery parity);
//  - triggerAutoPostProcessing: the per-slide watch-mode trigger — if a pass is
//    already in flight it queues a re-run instead of skipping, so slides that
//    arrive mid-pass still get a completed pass behind them (the note-upload
//    gate releases a buffered slide only once a pass reports it kept).

import { reactive } from 'vue'
import { PostProcessingPipeline } from './pipeline'
import { createSlideStoreDataSource } from './imageSources'
import { filterEnabledExclusionItems } from './types'
import type { PostProcessingProgress, TrashReason } from './types'
import { parseResultError } from './errorModel'
import { AI_FILTERING_DEFAULTS, POST_PROCESSING_DEFAULTS } from '../extractionDefaults'
import { listActiveImages, setFolderPostProcessing, setSlideAIDecision } from '../slideStore'
import { createClassifier, isAIFilteringActive } from '../ai/aiFilteringClient'
import { authStore } from '../../stores/authStore'
import { compareToolImages } from '../toolFolders'
import { createLogger } from '../logger'
const log = createLogger('PostProcessing')

export interface PostProcessingRunStatus {
  state: 'running' | 'done' | 'error'
  progress: PostProcessingProgress | null
  duplicatesRemoved: number
  excludedRemoved: number
  aiRemoved: number
  aiFailedCount: number
  // First AI failure's ErrorType, for the compact warning line in the panel.
  aiErrorType: string | null
}

// Keyed by folder name; readable from both the extraction panel and the
// Slides page. Entries persist for the session so a finished run's summary
// stays visible until the next run on the same folder replaces it.
export const postProcessingStatus = reactive<Record<string, PostProcessingRunStatus>>({})

const inFlight = new Set<string>()
/** Folders where a new slide arrived while a pass was running → run again. */
const pendingRerun = new Set<string>()
/** Resolvers waiting for a folder to go fully idle (no pass, no queued re-run). */
const idleWaiters = new Map<string, Array<() => void>>()

export interface PassResult {
  /** Files that survived the pass, in extraction order. */
  kept: string[]
  /** Files the pass moved to trash. */
  removed: string[]
}

type PassCompletedListener = (folder: string, result: PassResult) => void
const passListeners = new Set<PassCompletedListener>()

/**
 * Subscribe to completed passes (manual and auto — every completed pass
 * reports). Returns an unsubscribe function. Consumed by the watch-notes
 * engine to release buffered slide uploads.
 */
export function onPassCompleted(listener: PassCompletedListener): () => void {
  passListeners.add(listener)
  return () => passListeners.delete(listener)
}

function notifyPassCompleted(folder: string, result: PassResult): void {
  for (const listener of passListeners) {
    try {
      listener(folder, result)
    } catch (error) {
      log.error('pass-completed listener failed:', error)
    }
  }
}

function notifyIdleIfSettled(folder: string): void {
  if (inFlight.has(folder) || pendingRerun.has(folder)) return
  const waiters = idleWaiters.get(folder)
  if (!waiters) return
  idleWaiters.delete(folder)
  for (const resolve of waiters) resolve()
}

/**
 * Resolves once the folder has no pass in flight and no queued re-run. Used by
 * the watch-notes stop path: an in-flight pass still reports its kept slides
 * before this settles, so stopping never swallows a completed pass's result.
 */
export function whenIdle(folder: string): Promise<void> {
  if (!inFlight.has(folder) && !pendingRerun.has(folder)) return Promise.resolve()
  return new Promise((resolve) => {
    const waiters = idleWaiters.get(folder) ?? []
    waiters.push(resolve)
    idleWaiters.set(folder, waiters)
  })
}

/**
 * One full pipeline pass over the folder's active images. Caller must hold the
 * per-folder inFlight slot. Returns the kept/removed split (extraction order),
 * or null when the pipeline errored.
 */
async function runOnePass(
  folder: string,
  promptType: 'live' | 'recorded',
  onItemRemoved?: (filename: string, reason: TrashReason) => void,
): Promise<PassResult | null> {
  postProcessingStatus[folder] = {
    state: 'running',
    progress: null,
    duplicatesRemoved: 0,
    excludedRemoved: 0,
    aiRemoved: 0,
    aiFailedCount: 0,
    aiErrorType: null,
  }

  try {
    const images = await listActiveImages(folder)
    const imageFiles = images.map((i) => i.name).sort(compareToolImages)
    const removed = new Set<string>()

    const aiActive = isAIFilteringActive()
    // Files with a persisted verdict skip phase 3 — on every pass, including
    // manual ones (deliberate deviation from desktop, which excludes only on
    // auto passes): a full pass here re-classifies only new slides, and a
    // slide the user restored from AI trash stays restored. Re-extracting the
    // folder overwrites the records and clears the verdicts.
    const phase3ExcludeFiles = aiActive
      ? images.filter((i) => i.aiDecision != null).map((i) => i.name)
      : []

    const result = await PostProcessingPipeline.run(
      {
        outputPath: folder,
        imageFiles,
        config: {
          pHashThreshold: POST_PROCESSING_DEFAULTS.pHashThreshold,
          enableDuplicateRemoval: POST_PROCESSING_DEFAULTS.enableDuplicateRemoval,
          enableExclusionList: POST_PROCESSING_DEFAULTS.enableExclusionList,
          enableAIFiltering: aiActive,
          exclusionList: filterEnabledExclusionItems(POST_PROCESSING_DEFAULTS.pHashExclusionList).map(
            (item) => ({ name: item.name, pHash: item.pHash }),
          ),
          aiImageResizeWidth: AI_FILTERING_DEFAULTS.imageResizeWidth,
          aiImageResizeHeight: AI_FILTERING_DEFAULTS.imageResizeHeight,
        },
        promptType,
        phase3ExcludeFiles,
        token: authStore.token.value ?? undefined,
      },
      createSlideStoreDataSource(folder),
      {
        onProgress: (snap) => {
          const status = postProcessingStatus[folder]
          if (status) {
            status.progress = { ...snap, phase1: { ...snap.phase1 }, phase2: { ...snap.phase2 }, phase3: { ...snap.phase3 } }
          }
        },
        onItemRemoved: (filename, reason) => {
          removed.add(filename)
          onItemRemoved?.(filename, reason)
        },
        classifier: aiActive ? createClassifier() : undefined,
        // Persist every verdict (including 'slide') — this is what feeds the
        // exclude list above. Failed classifications persist nothing, so they
        // are retried on the next pass.
        onItemClassified: (filename, classification) => {
          void setSlideAIDecision(folder, filename, classification)
        },
      },
    )

    await setFolderPostProcessing(folder, {
      ran: true,
      duplicateRemoval: POST_PROCESSING_DEFAULTS.enableDuplicateRemoval,
      exclusionList: POST_PROCESSING_DEFAULTS.enableExclusionList,
      aiFiltering: aiActive,
      aiClassifierMode: aiActive ? 'llm' : null,
      completedAt: new Date().toISOString(),
    })

    const aiFailed = result.failed.filter((f) => f.filename !== '*')
    postProcessingStatus[folder] = {
      state: result.status === 'completed' ? 'done' : 'error',
      progress: postProcessingStatus[folder]?.progress ?? null,
      duplicatesRemoved: result.duplicatesRemoved.length,
      excludedRemoved: result.excludedRemoved.length,
      aiRemoved: result.aiNotSlide.length + result.aiMaybeSlideEdit.length,
      aiFailedCount: aiFailed.length,
      aiErrorType: aiFailed.length > 0
        ? parseResultError({ success: false, error: aiFailed[0].message, errorKind: aiFailed[0].errorKind }).type
        : null,
    }
    log.info(
      `Post-processing ${result.status} for ${folder}: ${result.duplicatesRemoved.length} duplicates, ${result.excludedRemoved.length} excluded, ${result.aiNotSlide.length + result.aiMaybeSlideEdit.length} AI-filtered (${aiFailed.length} failed)`,
    )
    if (result.status !== 'completed') return null
    return {
      kept: imageFiles.filter((f) => !removed.has(f)),
      removed: [...removed],
    }
  } catch (error) {
    log.error(`Post-processing failed for ${folder}:`, error)
    const status = postProcessingStatus[folder]
    postProcessingStatus[folder] = {
      state: 'error',
      progress: status?.progress ?? null,
      duplicatesRemoved: status?.duplicatesRemoved ?? 0,
      excludedRemoved: status?.excludedRemoved ?? 0,
      aiRemoved: status?.aiRemoved ?? 0,
      aiFailedCount: status?.aiFailedCount ?? 0,
      aiErrorType: status?.aiErrorType ?? null,
    }
    return null
  }
}

/** Manual Post-process button. Ignored while a pass is already running. */
export async function runPostProcessing(
  folder: string,
  promptType: 'live' | 'recorded',
  onItemRemoved?: (filename: string, reason: TrashReason) => void,
): Promise<void> {
  if (inFlight.has(folder)) {
    log.warn(`Post-processing already running for ${folder}`)
    return
  }
  inFlight.add(folder)
  try {
    const result = await runOnePass(folder, promptType, onItemRemoved)
    if (result) notifyPassCompleted(folder, result)
  } finally {
    inFlight.delete(folder)
    notifyIdleIfSettled(folder)
  }
}

/**
 * Per-slide auto trigger (watch mode). If a pass for the folder is already in
 * flight, queues a re-run instead of skipping — the just-saved slide needs a
 * completed pass behind it (dedup verdict + note-gate clearance). Re-runs are
 * full passes: re-reporting already-kept files is harmless (the note gate only
 * releases still-pending filenames), and phase 3 only classifies files without
 * a persisted verdict — i.e. exactly the newly saved slide(s).
 */
export async function triggerAutoPostProcessing(
  folder: string,
  promptType: 'live' | 'recorded',
  onItemRemoved?: (filename: string, reason: TrashReason) => void,
): Promise<void> {
  if (inFlight.has(folder)) {
    pendingRerun.add(folder)
    return
  }
  inFlight.add(folder)
  try {
    do {
      pendingRerun.delete(folder)
      const result = await runOnePass(folder, promptType, onItemRemoved)
      if (result) notifyPassCompleted(folder, result)
    } while (pendingRerun.has(folder))
  } finally {
    inFlight.delete(folder)
    notifyIdleIfSettled(folder)
  }
}
