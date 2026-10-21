/**
 * Task mode for the Yanhe 2.0 player: what `useTaskQueue` is to the Yanhekt
 * one. The page registers this as the task driver for its aita session; the
 * queue then starts it, and it plays the screen recording from the start at
 * the task speed with slide extraction on, reports progress, and at the end
 * hands the slides to post-processing and completes the task.
 *
 * The page owns the player and the extraction; this only drives them, through
 * the functions it is given.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import { configStore } from '@shared/services/configStore'
import { TaskQueue } from '@shared/services/taskQueueService'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2TaskDriver')

const READY_TIMEOUT_MS = 30_000
const POLL_MS = 200
const ATTEMPTS = 3

export interface UseYanhe2TaskDriverOptions {
  /** aita session id: the driver only runs tasks of this lecture. */
  subId: string
  /** The single-stream element (the screen, once selected). */
  videoPlayer: Ref<HTMLVideoElement | null>
  loading: Ref<boolean>
  /** Set when the lecture cannot be played; a task then fails with it. */
  problem: Ref<string | null>
  /** True when the recording has a screen stream. */
  hasScreen: ComputedRef<boolean>
  /** True when the single screen stream is the one on show. */
  onScreen: ComputedRef<boolean>
  selectScreen: () => void
  setPlaybackRate: (rate: number) => void
  /** Turn extraction on. Resolves with why it did not start, or null once it runs. */
  startExtraction: () => Promise<string | null>
  stopExtraction: () => void
  /** The `slides_*` folder of the running extraction. */
  outputPath: () => string | null
  /** File names of the slides extracted so far. */
  slideFiles: () => string[]
}

export function useYanhe2TaskDriver(options: UseYanhe2TaskDriverOptions) {
  const { videoPlayer, loading, problem, hasScreen, onScreen } = options

  const currentTaskId = ref<string | null>(null)
  const isTaskMode = ref(false)
  const isTaskRunning = computed(() => isTaskMode.value && currentTaskId.value !== null)
  let completing = false
  let lastProgress = -1
  let unregister: (() => void) | null = null

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /** Wait until `ready()` holds, or fail with what is wrong. */
  const waitFor = async (ready: () => boolean, what: string): Promise<void> => {
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (!ready()) {
      if (problem.value) throw new Error(`Yanhe 2.0 could not play this lecture (${problem.value})`)
      if (!isTaskMode.value) throw new Error('Task stopped')
      if (Date.now() > deadline) throw new Error(`${what} timeout`)
      await sleep(POLL_MS)
    }
  }

  const videoReady = () => {
    const video = videoPlayer.value
    return !!video && onScreen.value && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0
  }

  const begin = async (): Promise<void> => {
    await waitFor(() => !loading.value, 'Lecture load')
    if (!hasScreen.value) throw new Error('No screen recording stream available for task')
    options.selectScreen()
    await waitFor(videoReady, 'Video readiness')

    const speed = configStore.taskSpeed || 16
    options.setPlaybackRate(speed)
    const refused = await options.startExtraction()
    if (refused) throw new Error(refused)

    const video = videoPlayer.value
    if (video?.paused) await video.play()
    lastProgress = -1
  }

  const start = async (task: TaskContext): Promise<void> => {
    if (currentTaskId.value === task.taskId && isTaskMode.value) return
    currentTaskId.value = task.taskId
    isTaskMode.value = true

    for (let attempt = 1; ; attempt++) {
      try {
        await begin()
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Paused or removed while starting: nothing to report.
        if (!isTaskMode.value || currentTaskId.value !== task.taskId) return
        const retry = attempt < ATTEMPTS && /timeout/i.test(message)
        log.warn(`Yanhe 2.0 task start failed (attempt ${attempt}/${ATTEMPTS}):`, message)
        if (!retry) {
          options.stopExtraction()
          TaskQueue.updateTaskStatus(task.taskId, 'error', `Task initialization failed after ${attempt} attempts: ${message}`)
          cleanup()
          return
        }
        await sleep(2000)
      }
    }
  }

  const pause = (task: TaskContext): void => {
    log.debug('Task pause received for:', task.taskId)
    videoPlayer.value?.pause()
    isTaskMode.value = false
    options.stopExtraction()
  }

  const resume = async (task: TaskContext): Promise<void> => {
    currentTaskId.value = null
    await start(task)
  }

  const cleanup = () => {
    currentTaskId.value = null
    isTaskMode.value = false
    lastProgress = -1
  }

  const complete = () => {
    const taskId = currentTaskId.value
    if (!isTaskMode.value || !taskId || completing) return
    completing = true
    try {
      // Queue post-processing before completing, the order the Yanhekt task uses.
      const files = options.slideFiles()
      const outputPath = options.outputPath()
      if (configStore.autoPostProcessing !== false && outputPath && files.length > 0) {
        TaskQueue.startPostProcessing(taskId, outputPath, files)
      }
      TaskQueue.updateTaskStatus(taskId, 'completed')
    } finally {
      options.stopExtraction()
      cleanup()
      completing = false
    }
  }

  const onTimeUpdate = () => {
    const video = videoPlayer.value
    const taskId = currentTaskId.value
    if (!isTaskMode.value || !taskId || !video) return
    const { duration, currentTime } = video
    if (!(duration > 0)) return
    const progress = Math.min(99, Math.max(0, Math.floor((currentTime / duration) * 100)))
    if (progress !== lastProgress) {
      lastProgress = progress
      TaskQueue.updateTaskProgress(taskId, progress)
    }
    if (currentTime >= duration - 5 || currentTime / duration >= 0.99) complete()
  }

  // Follow whichever element is the single stream.
  watch(videoPlayer, (video, previous) => {
    previous?.removeEventListener('timeupdate', onTimeUpdate)
    previous?.removeEventListener('ended', complete)
    video?.addEventListener('timeupdate', onTimeUpdate)
    video?.addEventListener('ended', complete)
  }, { immediate: true })

  const register = () => {
    unregister?.()
    unregister = TaskCoordinator.registerDriver({ mode: 'recorded', yanhe2SubId: options.subId, start, pause, resume })
  }

  const dispose = () => {
    unregister?.()
    unregister = null
    const video = videoPlayer.value
    video?.removeEventListener('timeupdate', onTimeUpdate)
    video?.removeEventListener('ended', complete)
  }

  return { isTaskMode, isTaskRunning, register, dispose }
}
