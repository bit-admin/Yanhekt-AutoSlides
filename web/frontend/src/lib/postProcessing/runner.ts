// Post-processing runner — the web analogue of the desktop's
// usePostProcessing slice behind the playback page's manual Post-process
// button. Runs the pHash phases (duplicates + exclusion) on a folder,
// detached from any Vue component so SPA navigation away from the playback
// page doesn't cancel an in-flight run.

import { reactive } from 'vue'
import { PostProcessingPipeline } from './pipeline'
import { createSlideStoreDataSource } from './imageSources'
import { filterEnabledExclusionItems } from './types'
import type { PostProcessingProgress, TrashReason } from './types'
import { POST_PROCESSING_DEFAULTS } from '../extractionDefaults'
import { listActiveImages, setFolderPostProcessing } from '../slideStore'
import { compareToolImages } from '../toolFolders'
import { createLogger } from '../logger'
const log = createLogger('PostProcessing')

export interface PostProcessingRunStatus {
  state: 'running' | 'done' | 'error'
  progress: PostProcessingProgress | null
  duplicatesRemoved: number
  excludedRemoved: number
}

// Keyed by folder name; readable from both the extraction panel and the
// Slides page. Entries persist for the session so a finished run's summary
// stays visible until the next run on the same folder replaces it.
export const postProcessingStatus = reactive<Record<string, PostProcessingRunStatus>>({})

const inFlight = new Set<string>()

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
  postProcessingStatus[folder] = {
    state: 'running',
    progress: null,
    duplicatesRemoved: 0,
    excludedRemoved: 0,
  }

  try {
    const images = await listActiveImages(folder)
    const imageFiles = images.map((i) => i.name).sort(compareToolImages)

    const result = await PostProcessingPipeline.run(
      {
        outputPath: folder,
        imageFiles,
        config: {
          pHashThreshold: POST_PROCESSING_DEFAULTS.pHashThreshold,
          enableDuplicateRemoval: POST_PROCESSING_DEFAULTS.enableDuplicateRemoval,
          enableExclusionList: POST_PROCESSING_DEFAULTS.enableExclusionList,
          enableAIFiltering: false,
          exclusionList: filterEnabledExclusionItems(POST_PROCESSING_DEFAULTS.pHashExclusionList).map(
            (item) => ({ name: item.name, pHash: item.pHash }),
          ),
        },
        promptType,
      },
      createSlideStoreDataSource(folder),
      {
        onProgress: (snap) => {
          const status = postProcessingStatus[folder]
          if (status) {
            status.progress = { ...snap, phase1: { ...snap.phase1 }, phase2: { ...snap.phase2 }, phase3: { ...snap.phase3 } }
          }
        },
        onItemRemoved,
      },
    )

    await setFolderPostProcessing(folder, {
      ran: true,
      duplicateRemoval: POST_PROCESSING_DEFAULTS.enableDuplicateRemoval,
      exclusionList: POST_PROCESSING_DEFAULTS.enableExclusionList,
      aiFiltering: false,
      aiClassifierMode: null,
      completedAt: new Date().toISOString(),
    })

    postProcessingStatus[folder] = {
      state: result.status === 'completed' ? 'done' : 'error',
      progress: postProcessingStatus[folder]?.progress ?? null,
      duplicatesRemoved: result.duplicatesRemoved.length,
      excludedRemoved: result.excludedRemoved.length,
    }
    log.info(
      `Post-processing ${result.status} for ${folder}: ${result.duplicatesRemoved.length} duplicates, ${result.excludedRemoved.length} excluded`,
    )
  } catch (error) {
    log.error(`Post-processing failed for ${folder}:`, error)
    const status = postProcessingStatus[folder]
    postProcessingStatus[folder] = {
      state: 'error',
      progress: status?.progress ?? null,
      duplicatesRemoved: status?.duplicatesRemoved ?? 0,
      excludedRemoved: status?.excludedRemoved ?? 0,
    }
  } finally {
    inFlight.delete(folder)
  }
}
