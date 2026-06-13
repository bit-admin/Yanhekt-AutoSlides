import { ref, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import { TaskQueue } from '@shared/services/taskQueueService'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import type { SlideExtractionHandle } from '@shared/processing'
import type { PlaybackData } from '@features/video/useVideoPlayer'
import type Hls from 'hls.js'
import { configStore } from '@shared/services/configStore'

export interface UseTaskQueueOptions {
  mode: 'live' | 'recorded'
  sessionId?: string
  videoPlayer: Ref<HTMLVideoElement | null>
  hls: ShallowRef<Hls | null>
  playbackData: Ref<PlaybackData | null>
  selectedStream: Ref<string>
  loading: Ref<boolean>
  error: Ref<string | null>
  currentPlaybackRate: Ref<number>
  isSlideExtractionEnabled: Ref<boolean>
  slideExtractorInstance: ShallowRef<SlideExtractionHandle | null>
  slideExtractionStatus: Ref<{ isRunning: boolean }>
  extractedSlides: Ref<any[]>
  isRetrying: Ref<boolean>
  retryMessage: Ref<string>
  autoPostProcessing: Ref<boolean>
  switchStream: () => Promise<void>
  toggleSlideExtraction: () => Promise<void>
  resetErrorCounters: () => void
}

export interface UseTaskQueueReturn {
  // State
  currentTaskId: Ref<string | null>
  isTaskMode: Ref<boolean>
  taskSpeed: Ref<number>
  taskCompletionInProgress: Ref<string | null>

  // Computed
  isTaskRunning: ComputedRef<boolean>
  shouldDisableControls: ComputedRef<boolean>

  // Methods
  initializeTask: (taskId: string, retryCount?: number) => Promise<void>
  initializeTaskResume: (taskId: string) => Promise<void>
  initializeTaskAfterVideoLoad: (taskId: string, retryCount?: number) => Promise<void>
  waitForVideoReady: () => Promise<void>
  updateTaskProgress: () => void
  checkVideoCompletion: () => void
  onVideoEnded: () => void
  completeCurrentTask: () => Promise<void>
  handleTaskError: (errorMessage: string) => void
  cleanupTaskState: () => void
  setupEventListeners: () => void
  removeEventListeners: () => void
  initConfig: () => Promise<void>
}

export function useTaskQueue(options: UseTaskQueueOptions): UseTaskQueueReturn {
  const {
    mode,
    sessionId,
    videoPlayer,
    hls,
    playbackData,
    selectedStream,
    loading,
    error,
    currentPlaybackRate,
    isSlideExtractionEnabled,
    slideExtractorInstance,
    slideExtractionStatus,
    extractedSlides,
    isRetrying,
    retryMessage,
    autoPostProcessing: _autoPostProcessing, // No longer used - config is checked directly
    switchStream,
    toggleSlideExtraction,
    resetErrorCounters
  } = options

  // State
  const currentTaskId = ref<string | null>(null)
  const isTaskMode = ref(false)
  const taskSpeed = ref(10)
  const taskCompletionInProgress = ref<string | null>(null)

  // Track last reported progress
  let lastReportedProgress = -1

  // Unregister handle for the task driver (set in setupEventListeners)
  let unregisterDriver: (() => void) | null = null

  // Computed
  const isTaskRunning = computed(() => {
    return isTaskMode.value && currentTaskId.value !== null
  })

  const shouldDisableControls = computed(() => {
    return isTaskRunning.value
  })

  // Wait for video to be fully ready for task processing
  const waitForVideoReady = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = 20000
      const startTime = Date.now()
      let consecutiveReadyChecks = 0
      const requiredConsecutiveChecks = 3

      const checkVideoReady = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Video readiness timeout'))
          return
        }

        const video = videoPlayer.value
        if (!video) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        if (video.readyState < 2) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        if (hls.value && hls.value.media !== video) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        if (video.duration && (video.duration === 0 || isNaN(video.duration))) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        if (!playbackData.value || !selectedStream.value || loading.value) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        if (error.value && error.value.includes('fatal')) {
          consecutiveReadyChecks = 0
          setTimeout(checkVideoReady, 200)
          return
        }

        consecutiveReadyChecks++

        if (consecutiveReadyChecks >= requiredConsecutiveChecks) {
          console.log(`Video is fully ready for task processing (${consecutiveReadyChecks} consecutive checks)`)
          resolve()
        } else {
          setTimeout(checkVideoReady, 200)
        }
      }

      checkVideoReady()
    })
  }

  // Initialize task after video is confirmed ready
  const initializeTaskAfterVideoLoad = async (taskId: string, retryCount = 0) => {
    const maxRetries = 3
    const retryDelay = 2000

    try {
      console.log(`Initializing task after video load (attempt ${retryCount + 1}/${maxRetries + 1}):`, taskId)

      // Classroom-adaptive SSIM threshold is now resolved per-extraction inside
      // the pipeline from the run's own classrooms (carried via course.classrooms
      // → buildExtractionInput → input.classrooms), so concurrent tasks no longer
      // race on shared threshold state. No global mutation needed here.

      // Ensure we're on screen recording stream for task mode
      const screenStreamKey = Object.keys(playbackData.value?.streams || {}).find(
        key => playbackData.value?.streams[key].type === 'screen'
      )

      if (!screenStreamKey) {
        throw new Error('No screen recording stream available for task')
      }

      if (selectedStream.value !== screenStreamKey) {
        console.log('Switching to screen recording for task:', taskId)
        selectedStream.value = screenStreamKey
        await switchStream()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Set task speed for playback rate (only for recorded mode)
      if (videoPlayer.value && mode === 'recorded') {
        currentPlaybackRate.value = taskSpeed.value
        videoPlayer.value.playbackRate = taskSpeed.value
        console.log('Set task playback rate to:', taskSpeed.value)
      }

      // Initialize slide extraction if not already enabled
      if (!isSlideExtractionEnabled.value) {
        console.log('Auto-starting slide extraction for task:', taskId)
        isSlideExtractionEnabled.value = true
        await toggleSlideExtraction()

        await new Promise(resolve => setTimeout(resolve, 1000))

        if (!slideExtractorInstance.value || !slideExtractionStatus.value.isRunning) {
          throw new Error('Failed to start slide extraction')
        }
      }

      // Update slide extractor with task speed
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.setPlaybackRate(taskSpeed.value)
      }

      // Auto-play the video if not already playing
      if (videoPlayer.value && videoPlayer.value.paused) {
        try {
          await videoPlayer.value.play()
          console.log('Video playback started for task:', taskId)
        } catch (playError) {
          throw new Error('Failed to start video playback: ' + playError)
        }
      }

      // Reset progress tracking for new task
      lastReportedProgress = -1

      console.log('Task initialized successfully after video load:', taskId)
    } catch (initError) {
      console.error(`Task initialization failed after video load (attempt ${retryCount + 1}):`, taskId, initError)

      if (retryCount < maxRetries) {
        const errorMessage = initError instanceof Error ? initError.message : String(initError)

        const isRecoverableError = errorMessage.includes('Failed to start slide extraction') ||
                                  errorMessage.includes('Failed to start video playback') ||
                                  errorMessage.includes('No screen recording stream available')

        if (isRecoverableError) {
          console.log(`Retrying task initialization in ${retryDelay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return initializeTaskAfterVideoLoad(taskId, retryCount + 1)
        }
      }

      const errorMessage = initError instanceof Error ? initError.message : String(initError)
      handleTaskError(`Task initialization failed after ${retryCount + 1} attempts: ${errorMessage}`)
    }
  }

  // Initialize task with improved error handling and video readiness check
  const initializeTask = async (taskId: string, retryCount = 0) => {
    const maxRetries = 2
    const retryDelay = 3000

    try {
      console.log(`Starting task initialization (attempt ${retryCount + 1}/${maxRetries + 1}):`, taskId)

      if (!playbackData.value || loading.value) {
        console.log('Video data not ready, waiting for video to load...')
        await waitForVideoReady()
      }

      await initializeTaskAfterVideoLoad(taskId)
    } catch (initError) {
      console.error(`Task initialization failed (attempt ${retryCount + 1}):`, taskId, initError)
      const errorMessage = initError instanceof Error ? initError.message : String(initError)

      if (retryCount < maxRetries) {
        const isRecoverableError = errorMessage.includes('Video readiness timeout') ||
                                  errorMessage.includes('Failed to start slide extraction') ||
                                  errorMessage.includes('Failed to start video playback')

        if (isRecoverableError) {
          console.log(`Retrying task initialization in ${retryDelay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return initializeTask(taskId, retryCount + 1)
        }
      }

      TaskQueue.updateTaskStatus(taskId, 'error', `Task initialization failed after ${retryCount + 1} attempts: ${errorMessage}`)
    }
  }

  // Initialize task resume with current video state
  const initializeTaskResume = async (taskId: string) => {
    try {
      console.log('Resuming task:', taskId)

      // Classroom-adaptive threshold is resolved per-extraction in the pipeline
      // (see initializeTaskAfterVideoLoad); no global threshold mutation here.

      const isScreenRecordingSelected = playbackData.value?.streams[selectedStream.value]?.type === 'screen'
      if (!isScreenRecordingSelected) {
        const screenStreamKey = Object.keys(playbackData.value?.streams || {}).find(
          key => playbackData.value?.streams[key].type === 'screen'
        )

        if (screenStreamKey) {
          selectedStream.value = screenStreamKey
          await switchStream()
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          throw new Error('Screen recording not available for task resume')
        }
      }

      await waitForVideoReady()

      if (videoPlayer.value && mode === 'recorded') {
        currentPlaybackRate.value = taskSpeed.value
        videoPlayer.value.playbackRate = taskSpeed.value

        if (slideExtractorInstance.value) {
          slideExtractorInstance.value.setPlaybackRate(taskSpeed.value)
        }
      }

      if (!isSlideExtractionEnabled.value) {
        isSlideExtractionEnabled.value = true
        await toggleSlideExtraction()

        await new Promise(resolve => setTimeout(resolve, 500))

        if (!slideExtractorInstance.value || !slideExtractionStatus.value.isRunning) {
          throw new Error('Failed to start slide extraction on resume')
        }
      }

      if (videoPlayer.value && videoPlayer.value.paused) {
        await videoPlayer.value.play()
        console.log('Video playback resumed for task:', taskId)
      }

      lastReportedProgress = -1

      console.log('Task resumed successfully:', taskId)
    } catch (resumeError) {
      console.error('Failed to resume task:', taskId, resumeError)
      const errorMessage = resumeError instanceof Error ? resumeError.message : String(resumeError)
      TaskQueue.updateTaskStatus(taskId, 'error', 'Task resume failed: ' + errorMessage)
      currentTaskId.value = null
      isTaskMode.value = false
    }
  }

  // Update task progress based on video playback progress
  const updateTaskProgress = () => {
    if (!isTaskMode.value || !currentTaskId.value || !videoPlayer.value) return

    const video = videoPlayer.value
    const duration = video.duration
    const currentTime = video.currentTime

    if (duration > 0 && currentTime >= 0) {
      const progressPercentage = Math.min(99, Math.max(0, Math.floor((currentTime / duration) * 100)))

      if (progressPercentage !== lastReportedProgress) {
        lastReportedProgress = progressPercentage
        TaskQueue.updateTaskProgress(currentTaskId.value, progressPercentage)
      }
    }
  }

  const checkVideoCompletion = () => {
    if (!isTaskMode.value || !currentTaskId.value || !videoPlayer.value) return

    const video = videoPlayer.value
    const duration = video.duration
    const currentTime = video.currentTime

    if (duration > 0 && (currentTime >= duration - 5 || currentTime / duration >= 0.99)) {
      console.log('Video completion detected via timeupdate for task:', currentTaskId.value)
      completeCurrentTask()
    }
  }

  const onVideoEnded = () => {
    if (isTaskMode.value && currentTaskId.value) {
      console.log('Video completion detected via ended event for task:', currentTaskId.value)
      completeCurrentTask()
    }
  }

  const completeCurrentTask = async () => {
    if (!isTaskMode.value || !currentTaskId.value) return

    const taskId = currentTaskId.value

    if (taskCompletionInProgress.value === taskId) {
      console.log('Task completion already in progress for:', taskId)
      return
    }

    taskCompletionInProgress.value = taskId
    console.log('Completing task:', taskId)

    // Get slide extraction info for post-processing (non-blocking)
    // Check config directly to ensure we respect the latest setting value
    const config = configStore
    const autoPostProcessingEnabled = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true
    if (autoPostProcessingEnabled && isSlideExtractionEnabled.value && extractedSlides.value.length > 0) {
      console.log('Auto post-processing enabled, queuing post-processing for task:', taskId)
      try {
        // Get output path from slide extractor
        const outputPath = slideExtractorInstance.value?.getOutputPath()
        if (outputPath) {
          // Collect filenames from extracted slides
          const imageFiles = extractedSlides.value.map(slide => `${slide.title}.png`)

          // Start post-processing asynchronously (non-blocking)
          // This will run in parallel with the next task
          TaskQueue.startPostProcessing(taskId, outputPath, imageFiles)
          console.log('Post-processing job queued for task:', taskId)
        } else {
          console.warn('No output path available for post-processing')
        }
      } catch (ppError) {
        console.error('Failed to queue post-processing for task:', taskId, ppError)
      }
    }

    TaskQueue.updateTaskStatus(taskId, 'completed')

    cleanupTaskState()

    taskCompletionInProgress.value = null
  }

  const handleTaskError = (errorMessage: string) => {
    if (isTaskMode.value && currentTaskId.value) {
      console.log('Task error occurred:', currentTaskId.value, errorMessage)
      TaskQueue.updateTaskStatus(currentTaskId.value, 'error', errorMessage)
      cleanupTaskState()
    }
  }

  const cleanupTaskState = () => {
    currentTaskId.value = null
    isTaskMode.value = false

    if (isSlideExtractionEnabled.value) {
      isSlideExtractionEnabled.value = false
      setTimeout(() => {
        toggleSlideExtraction()
      }, 100)
    }

    error.value = null
    isRetrying.value = false
    retryMessage.value = ''

    lastReportedProgress = -1

    resetErrorCounters()

    console.log('Task state cleaned up')
  }

  // Task driver methods — the coordinator routes a task here by mode + sessionId,
  // so the per-event mode/session guards the old window handlers carried are now
  // the coordinator's job. `start` resolves once initialization completes (the
  // status is already 'in_progress', set by TaskQueue before runTask), replacing
  // the old acknowledgment + 30-retry handshake.
  const start = async (task: TaskContext): Promise<void> => {
    if (currentTaskId.value === task.taskId && isTaskMode.value) {
      // Already running this task — nothing to do.
      return
    }

    console.log('Task start received for:', task.taskId)

    currentTaskId.value = task.taskId
    isTaskMode.value = true

    // initializeTask handles its own retries and reports failure via
    // TaskQueue.updateTaskStatus(..., 'error'); it does not throw.
    await initializeTask(task.taskId)
  }

  const pause = (task: TaskContext): void => {
    console.log('Task pause received for:', task.taskId)

    if (videoPlayer.value && !videoPlayer.value.paused) {
      console.log('Pausing video playback for task:', task.taskId)
      videoPlayer.value.pause()
    }

    isTaskMode.value = false

    if (isSlideExtractionEnabled.value) {
      console.log('Stopping slide extraction for task:', task.taskId)
      isSlideExtractionEnabled.value = false
      toggleSlideExtraction()
    }
  }

  const resume = async (task: TaskContext): Promise<void> => {
    isTaskMode.value = true
    await initializeTaskResume(task.taskId)
  }

  const setupEventListeners = () => {
    // Register this PlaybackPage as the task driver for its mode + session.
    unregisterDriver = TaskCoordinator.registerDriver({ mode, sessionId, start, pause, resume })
  }

  const removeEventListeners = () => {
    if (unregisterDriver) {
      unregisterDriver()
      unregisterDriver = null
    }
  }

  const initConfig = async () => {
    try {
      const config = configStore
      taskSpeed.value = config.taskSpeed || 10
    } catch (configError) {
      console.error('Failed to load task queue config:', configError)
    }
  }

  return {
    // State
    currentTaskId,
    isTaskMode,
    taskSpeed,
    taskCompletionInProgress,

    // Computed
    isTaskRunning,
    shouldDisableControls,

    // Methods
    initializeTask,
    initializeTaskResume,
    initializeTaskAfterVideoLoad,
    waitForVideoReady,
    updateTaskProgress,
    checkVideoCompletion,
    onVideoEnded,
    completeCurrentTask,
    handleTaskError,
    cleanupTaskState,
    setupEventListeners,
    removeEventListeners,
    initConfig
  }
}
