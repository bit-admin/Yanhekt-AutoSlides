// Ported from autoslides/src/renderer/features/video/useSlideExtraction.ts.
// Web changes: output goes to an IndexedDB folder (no output directory /
// ensureDirectory), metadata is written via slideStore (always watch-mode —
// there is no task queue on the web), slides arrive through the adapter's
// onSlideExtracted callback instead of window CustomEvents, and
// post-processing is triggered manually via executePostProcessing (desktop
// gallery parity), running detached so navigation doesn't cancel it.

import { computed, ref, shallowRef, type Ref } from 'vue'
import {
  slideExtractionManager,
  CanvasTaintedError,
  type SlideExtractionHandle,
  type SlideExtractionInput,
  type ExtractedSlide,
} from '../../lib/processing'
import { resolveSsimThreshold } from '../../lib/extractionDefaults'
import { recordWatchExtraction } from '../../lib/slideStore'
import { sanitizeFileName } from '../../lib/sanitizeFileName'
import { runPostProcessing, postProcessingStatus } from '../../lib/postProcessing/runner'
import type { Course } from '../useCourseList'
import type { SessionData } from '../../lib/api'
import { createLogger } from '../../lib/logger'
const log = createLogger('VideoSlideExtraction')

export interface SlideExtractionStatus {
  isRunning: boolean
  slideCount: number
  verificationState: string
  currentVerification: number
}

export interface UseSlideExtractionOptions {
  mode: 'live' | 'recorded'
  course: Ref<Course | null>
  session: Ref<SessionData | null>
  currentPlaybackRate: Ref<number>
}

export function useSlideExtraction(options: UseSlideExtractionOptions) {
  const { mode, course, session, currentPlaybackRate } = options

  // State
  const isSlideExtractionEnabled = ref(false)
  const slideExtractionStatus = ref<SlideExtractionStatus>({
    isRunning: false,
    slideCount: 0,
    verificationState: 'none',
    currentVerification: 0,
  })
  const slideExtractorInstance = shallowRef<SlideExtractionHandle | null>(null)
  // Stable, unique id for THIS composable instance (one per PlaybackPage).
  const extractorInstanceId = ref<string>(
    `${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  )
  const extractedSlides = ref<ExtractedSlide[]>([])
  // Direct accessor to THIS page's own <video> element, attached by the
  // component after useVideoPlayer is created.
  const videoElementProvider = shallowRef<(() => HTMLVideoElement | null) | null>(null)
  // The IndexedDB folder the current/last run writes into (drives the
  // post-processing status readout in the extraction panel).
  const currentFolder = ref<string | null>(null)
  // Set when frame capture is impossible in this browser (tainted canvas on
  // the Safari native-HLS path); the panel swaps the toggle for a notice.
  const captureNotSupported = ref(false)

  const buildFolderName = (): string => {
    let folderName = 'slides'
    if (course.value?.title) {
      folderName += `_${sanitizeFileName(course.value.title)}`
    }
    if (session.value?.title) {
      folderName += `_${sanitizeFileName(session.value.title)}`
    } else if (course.value?.session?.section_group_title && mode === 'live') {
      folderName += `_${sanitizeFileName(course.value.session.section_group_title)}`
    }
    return folderName
  }

  // Build the SlideExtractionInput payload from current course/session state.
  const buildExtractionInput = async (): Promise<SlideExtractionInput> => {
    const folderName = buildFolderName()
    currentFolder.value = folderName

    // Record per-folder metadata (best-effort). All web extractions are watch
    // mode: the user is watching, completeness is unverifiable.
    const sessionId = session.value?.session_id ? String(session.value.session_id) : undefined
    void recordWatchExtraction({
      folder: folderName,
      kind: mode === 'live' ? 'live' : 'recorded',
      ssimThreshold: resolveSsimThreshold(course.value?.classrooms ?? null),
      source: {
        courseId: course.value?.id,
        courseTitle: course.value?.title,
        sessionId,
        sessionTitle: session.value?.title,
        instructor: course.value?.instructor,
        professors: course.value?.professors,
        semester: course.value?.semester,
        schoolYear: course.value?.school_year,
        college: course.value?.college_name,
        classrooms: course.value?.classrooms?.map((c) => c.name),
        weekNumber: session.value?.week_number,
        day: session.value?.day,
      },
    }).catch((error) => {
      log.error('Failed to record extraction metadata:', error)
    })

    return {
      mode,
      instanceId: extractorInstanceId.value,
      sourceMode: 'video',
      videoElementProvider: videoElementProvider.value ?? undefined,
      outputPath: folderName,
      courseInfo: {
        courseName: course.value?.title,
        sessionTitle: session.value?.title || course.value?.session?.section_group_title,
        mode,
      },
      initialPlaybackRate: Number(currentPlaybackRate.value),
      classrooms: course.value?.classrooms ?? null,
    }
  }

  // Splice a post-processing-removed slide out of the reactive gallery mirror
  // (and release its object URL — the strip won't render it again).
  const removeSlideByFilename = (filename: string) => {
    const index = extractedSlides.value.findIndex((slide) => `${slide.title}.png` === filename)
    if (index >= 0) {
      const [removed] = extractedSlides.value.splice(index, 1)
      if (removed?.dataUrl) URL.revokeObjectURL(removed.dataUrl)
    }
  }

  // Toggle slide extraction (bound to the panel checkbox's v-model + @change).
  const toggleSlideExtraction = async () => {
    if (isSlideExtractionEnabled.value) {
      try {
        const input = await buildExtractionInput()
        const handle = await slideExtractionManager.run(input, {
          onStatusChanged: (status) => {
            slideExtractionStatus.value = {
              isRunning: status.isRunning,
              slideCount: status.slideCount,
              verificationState: status.verificationState,
              currentVerification: status.currentVerification,
            }
          },
          onSlideExtracted: (slide) => {
            extractedSlides.value.push(slide)
          },
          onSlidesCleared: () => {
            extractedSlides.value = []
          },
          onError: (error) => {
            if (error instanceof CanvasTaintedError) {
              log.error('Frame capture unavailable (tainted canvas) — stopping extraction')
              captureNotSupported.value = true
              isSlideExtractionEnabled.value = false
              slideExtractorInstance.value?.stop()
            }
          },
        })
        if (!handle) {
          isSlideExtractionEnabled.value = false
          return
        }
        slideExtractorInstance.value = handle
        updateSlideExtractionStatus()
      } catch (error) {
        log.error('Failed to start slide extraction:', error)
        isSlideExtractionEnabled.value = false
      }
    } else {
      // Stop slide extraction
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.stop()
        slideExtractionStatus.value.isRunning = false
      }
    }
  }

  /** Whether the current folder has a post-processing run in flight. */
  const isPostProcessing = computed(
    () =>
      currentFolder.value !== null &&
      postProcessingStatus[currentFolder.value]?.state === 'running',
  )

  // Manual post-processing trigger (the panel's Post-process button, desktop
  // gallery parity). Detached: survives navigation away from the playback page.
  const executePostProcessing = () => {
    if (!currentFolder.value || isPostProcessing.value) return
    void runPostProcessing(currentFolder.value, mode, removeSlideByFilename)
  }

  /** Stop extraction if running and flip the toggle off (stream-switch guard). */
  const forceStopSlideExtraction = () => {
    if (isSlideExtractionEnabled.value) {
      isSlideExtractionEnabled.value = false
      slideExtractorInstance.value?.stop()
      slideExtractionStatus.value.isRunning = false
    }
  }

  const updateSlideExtractionStatus = () => {
    if (slideExtractorInstance.value) {
      const status = slideExtractorInstance.value.getStatus()
      slideExtractionStatus.value = {
        isRunning: status.isRunning,
        slideCount: status.slideCount,
        verificationState: status.verificationState,
        currentVerification: status.currentVerification,
      }
    }
  }

  // Cleanup slide extraction (component unmount). A post-processing run
  // started via the button is detached and keeps going; un-post-processed
  // slides simply stay in the folder for the Slides page.
  const cleanupSlideExtraction = () => {
    if (isSlideExtractionEnabled.value && slideExtractorInstance.value) {
      slideExtractorInstance.value.stop()
    }
    slideExtractionManager.remove(extractorInstanceId.value)
  }

  return {
    // State
    isSlideExtractionEnabled,
    slideExtractionStatus,
    slideExtractorInstance,
    extractorInstanceId,
    extractedSlides,
    videoElementProvider,
    currentFolder,
    captureNotSupported,
    isPostProcessing,

    // Methods
    toggleSlideExtraction,
    executePostProcessing,
    forceStopSlideExtraction,
    updateSlideExtractionStatus,
    cleanupSlideExtraction,
  }
}

export type UseSlideExtractionReturn = ReturnType<typeof useSlideExtraction>
