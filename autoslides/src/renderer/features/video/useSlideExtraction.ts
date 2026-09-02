import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import {
  slideExtractionManager,
  type SlideExtractionHandle,
  type SlideExtractionInput,
  type ExtractedSlide,
} from '@shared/processing'
import { ssimThresholdService } from '@shared/services/ssimThresholdService'
import { recordRecordedExtraction } from '@shared/services/slideMetadataClient'
import { buildSlideFolderName, parseSessionTitle } from '@common/lectureNaming'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('VideoSlideExtraction');

// Types for slide extraction
export interface SlideExtractionStatus {
  isRunning: boolean
  slideCount: number
  verificationState: string
  currentVerification: number
}

export type { Course } from '@features/course/useCourseList'
import type { Course } from '@features/course/useCourseList'
import { configStore } from '@shared/services/configStore'

import type { SessionData } from '@common/apiTypes'
/** Recorded session row from /v1/course (alias kept for existing importers). */
export type Session = SessionData

export interface UseSlideExtractionOptions {
  mode: 'live' | 'recorded'
  course: Ref<Course | null>
  session: Ref<Session | null>
  currentPlaybackRate: Ref<number>
  // Whether the current extraction is driven by the task queue (unattended) vs.
  // the user actively watching. Determines the `trigger` recorded in metadata
  // ('auto' for tasks, 'watch' for manual playback). Lazily read at extraction
  // start so it can reference a sibling composable created after this one.
  isTaskExtraction?: () => boolean
}

export interface UseSlideExtractionReturn {
  // State
  isSlideExtractionEnabled: Ref<boolean>
  slideExtractionStatus: Ref<SlideExtractionStatus>
  slideExtractorInstance: ShallowRef<SlideExtractionHandle | null>
  extractorInstanceId: Ref<string | null>
  extractedSlides: Ref<ExtractedSlide[]>
  videoElementProvider: ShallowRef<(() => HTMLVideoElement | null) | null>

  // Methods
  toggleSlideExtraction: () => Promise<void>
  initializeSlideExtraction: () => Promise<void>
  updateSlideExtractionStatus: () => void
  updateSSIMThresholdForClassrooms: () => void
  onSlideExtracted: (event: CustomEvent) => Promise<void>
  onSlidesCleared: (event: CustomEvent) => void
  cleanupSlideExtraction: () => void
  setupEventListeners: () => void
  removeEventListeners: () => void
}

export function useSlideExtraction(options: UseSlideExtractionOptions) {
  const { mode, course, session, currentPlaybackRate, isTaskExtraction } = options

  // State
  const isSlideExtractionEnabled = ref(false)
  const slideExtractionStatus = ref<SlideExtractionStatus>({
    isRunning: false,
    slideCount: 0,
    verificationState: 'none',
    currentVerification: 0
  })
  const slideExtractorInstance = shallowRef<SlideExtractionHandle | null>(null)
  // Stable, unique id for THIS composable instance (one per PlaybackPage),
  // generated eagerly so it can be stamped on the DOM (data-extractor-instance)
  // before extraction starts. The random suffix is essential: parallel tasks of
  // the SAME course share mode + courseId, so a `${mode}_${courseId}_${Date.now()}`
  // id could collide (same ms) and make both tabs reuse one shared pipeline.
  const extractorInstanceId = ref<string | null>(
    `${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  )
  const extractedSlides = ref<ExtractedSlide[]>([])
  // Direct accessor to THIS PlaybackPage's own <video> element, attached by the
  // component after useVideoPlayer is created (see PlaybackPage wiring order).
  // Passed into the pipeline so concurrent tabs each capture their own element
  // instead of falling back to a global-DOM querySelector that can match another
  // tab's <video>.
  const videoElementProvider = shallowRef<(() => HTMLVideoElement | null) | null>(null)

  // Event handlers stored for cleanup
  let slideExtractedHandler: ((event: CustomEvent) => Promise<void>) | null = null
  let slidesClearedHandler: ((event: CustomEvent) => void) | null = null

  // Update SSIM threshold based on classroom information
  // Kept as a standalone method so PlaybackPage can refresh the adaptive
  // threshold display even when extraction is not running.
  const updateSSIMThresholdForClassrooms = () => {
    try {
      const classrooms = course.value?.classrooms

      if (classrooms && classrooms.length > 0) {
        log.debug('Setting classroom context for SSIM threshold:', classrooms.map(c => c.name).join(', '))
        ssimThresholdService.setCurrentClassrooms(classrooms)
      } else {
        log.debug('No classroom information available, clearing SSIM classroom context')
        ssimThresholdService.setCurrentClassrooms(null)
      }
    } catch (error) {
      log.error('Failed to update SSIM threshold for classrooms:', error)
    }
  }

  // Build the SlideExtractionInput payload from current course/session state.
  const buildExtractionInput = async (): Promise<SlideExtractionInput> => {
    const config = configStore
    const outputDir = config.outputDirectory || '~/Downloads/AutoSlides'

    // Course titles are not unique, so the folder carries the course/session
    // ids — otherwise two same-titled lectures resolve to one path and this
    // extraction's slides merge into the other course's folder (mkdir -p).
    //
    // In live mode `course.id` is a BROADCAST id, not a course id
    // (transformLiveStreamToCourse), and there is no session. The real course id
    // rides on `course.courseId` (from the live row's `session.course_id`), so a
    // live folder carries both: the course id groups broadcasts of one course
    // together, the broadcast id keeps each one a distinct folder.
    const isLive = mode === 'live'
    const folderName = buildSlideFolderName(
      {
        courseTitle: course.value?.title,
        sessionTitle: session.value?.title,
        sectionGroupTitle: isLive ? course.value?.session?.section_group_title : undefined,
      },
      isLive
        ? { courseId: course.value?.courseId, liveId: course.value?.id }
        : { courseId: course.value?.id, sessionId: session.value?.session_id },
    )

    const slideOutputPath = `${outputDir}/${folderName}`
    await window.electronAPI.slideExtraction.ensureDirectory(slideOutputPath)

    // Record per-folder metadata (best-effort). Playback extraction is "watch
    // mode" (the user is watching — completeness unverifiable), whether live or
    // recorded; the task queue drives the same composable but is unattended, so
    // it records 'auto'. Live folders now get metadata too (kind: 'live').
    // Offline/web-capture paths don't use this composable and stay metadata-free.
    {
      const sessionId = session.value?.session_id ? String(session.value.session_id) : undefined
      // Live rows carry no `session` object of their own, but their
      // `section_group_title` ("第21周 星期日 第2大节") is the same string a
      // recorded session uses as its title, and encodes week + weekday. A live
      // folder can therefore record everything a recorded one does EXCEPT the
      // session id, which cannot exist yet — a recording is only published once
      // the lecture has finished.
      const liveSessionTitle = isLive ? course.value?.session?.section_group_title : undefined
      const liveSessionParts = parseSessionTitle(liveSessionTitle)
      void recordRecordedExtraction({
        folderPath: slideOutputPath,
        extractor: 'builtin',
        kind: mode === 'live' ? 'live' : 'recorded',
        trigger: isTaskExtraction?.() ? 'auto' : 'watch',
        ssimThreshold: configStore.slideExtraction?.ssimThreshold,
        sessionId,
        source: {
          // Live: `course.id` is a broadcast id and must NOT be written as a
          // courseId — the Index keys on courseId/sessionId and would treat each
          // broadcast as its own course. The real course id is `course.courseId`.
          courseId: isLive ? course.value?.courseId : course.value?.id,
          liveId: isLive ? course.value?.id : undefined,
          courseTitle: course.value?.title,
          sessionId,
          sessionTitle: session.value?.title ?? liveSessionTitle,
          instructor: course.value?.instructor,
          professors: course.value?.professors,
          semester: course.value?.semester,
          schoolYear: course.value?.school_year,
          college: course.value?.college_name,
          classrooms: course.value?.classrooms?.map(c => c.name),
          weekNumber: session.value?.week_number ?? liveSessionParts?.weekNumber,
          day: session.value?.day ?? liveSessionParts?.day,
        },
      })
    }

    // Reuse the stable per-composable id (set eagerly above). Keeping it stable
    // across start/stop means the manager reuses this PlaybackPage's own pipeline
    // and the DOM's data-extractor-instance keeps matching it.
    const instanceId = extractorInstanceId.value as string

    return {
      mode,
      instanceId,
      sourceMode: 'video',
      videoElementProvider: videoElementProvider.value ?? undefined,
      outputPath: slideOutputPath,
      courseInfo: {
        courseName: course.value?.title,
        sessionTitle: session.value?.title || course.value?.session?.section_group_title,
        mode,
      },
      initialPlaybackRate: Number(currentPlaybackRate.value),
      classrooms: course.value?.classrooms ?? null,
    }
  }

  // Preserved for callers that still invoke initializeSlideExtraction()
  // directly (e.g. setting up output paths before toggling). The new run()
  // path also rebuilds the input internally, so this is now a no-op success
  // path on the data we'd hand to the pipeline.
  const initializeSlideExtraction = async () => {
    try {
      updateSSIMThresholdForClassrooms()
      // Rebuild the input as a side effect (validates directory + sets instanceId).
      await buildExtractionInput()
    } catch (error) {
      log.error('Failed to initialize slide extraction:', error)
      throw error
    }
  }

  // Toggle slide extraction
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

  // Update slide extraction status
  const updateSlideExtractionStatus = () => {
    if (slideExtractorInstance.value) {
      const status = slideExtractorInstance.value.getStatus()
      slideExtractionStatus.value = {
        isRunning: status.isRunning,
        slideCount: status.slideCount,
        verificationState: status.verificationState,
        currentVerification: status.currentVerification
      }
    }
  }

  // Handle slide extracted event
  const onSlideExtracted = async (event: CustomEvent) => {
    const { slide, instanceId, mode: eventMode } = event.detail
    // Only handle events from our instance
    if (instanceId === extractorInstanceId.value && eventMode === mode) {
      extractedSlides.value.push(slide)
      updateSlideExtractionStatus()
    }
  }

  // Handle slides cleared event
  const onSlidesCleared = (event: CustomEvent) => {
    const { instanceId, mode: eventMode } = event.detail
    // Only handle events from our instance
    if (instanceId === extractorInstanceId.value && eventMode === mode) {
      extractedSlides.value = []
      updateSlideExtractionStatus()
    }
  }

  // Setup event listeners
  const setupEventListeners = () => {
    slideExtractedHandler = onSlideExtracted
    slidesClearedHandler = onSlidesCleared
    window.addEventListener('slideExtracted', slideExtractedHandler as unknown as EventListener)
    window.addEventListener('slidesCleared', slidesClearedHandler as EventListener)
  }

  // Remove event listeners
  const removeEventListeners = () => {
    if (slideExtractedHandler) {
      window.removeEventListener('slideExtracted', slideExtractedHandler as unknown as EventListener)
    }
    if (slidesClearedHandler) {
      window.removeEventListener('slidesCleared', slidesClearedHandler as EventListener)
    }
  }

  // Cleanup slide extraction
  const cleanupSlideExtraction = () => {
    // Stop slide extraction if running
    if (isSlideExtractionEnabled.value && slideExtractorInstance.value) {
      slideExtractorInstance.value.stop()
    }

    // Clean up extractor instance if it was created specifically for this component
    if (extractorInstanceId.value) {
      slideExtractionManager.remove(extractorInstanceId.value)
    }

    // Remove event listeners
    removeEventListeners()
  }

  return {
    // State
    isSlideExtractionEnabled,
    slideExtractionStatus,
    slideExtractorInstance,
    extractorInstanceId,
    extractedSlides,
    videoElementProvider,

    // Methods
    toggleSlideExtraction,
    initializeSlideExtraction,
    updateSlideExtractionStatus,
    updateSSIMThresholdForClassrooms,
    onSlideExtracted,
    onSlidesCleared,
    cleanupSlideExtraction,
    setupEventListeners,
    removeEventListeners
  }
}
