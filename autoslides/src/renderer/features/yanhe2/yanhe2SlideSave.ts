/**
 * Saving a Yanhe 2.0 recording's server slides, wired into the task queue.
 *
 * The slides are treated like a task's own extraction: main finds the same
 * lecture on Yanhekt and writes `Slide_*.png` into its `slides_*` folder, the
 * work is a task row, and the saved files go to post-processing exactly as a
 * finished task's do. A lecture with no slides, or one that cannot be found
 * on Yanhekt (or Yanhekt is signed out), adds no task and saves nothing.
 *
 * Asking is quick (a few reads); saving is not, so accepted lectures wait as
 * task rows and are saved one at a time. That is what lets a whole course be
 * added at once from the Curriculum list.
 *
 * Module state, not a composable: a save outlives the page it was started
 * from, and coming back shows where it stands.
 */
import { reactive, ref } from 'vue'
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2SlideSaveRefusal } from '@common/yanhe2SlideSave'
import { i18n } from '@shared/i18n'
import { configStore } from '@shared/services/configStore'
import { TaskQueue } from '@shared/services/taskQueueService'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2SlideSave')

export interface Yanhe2SlideSaveRequest {
  account: string
  /** aita course id. */
  courseId: string
  /** aita session id. */
  subId: string
}

type Asked =
  | { kind: 'added'; taskId: string }
  /** The task list already has this lecture, as a save or as an extraction. */
  | { kind: 'already_queued' }
  | { kind: Yanhe2SlideSaveRefusal }

interface Job extends Yanhe2SlideSaveRequest {
  taskId: string
}

/** aita session ids from the click until their save is over. */
const pending = reactive(new Set<string>())
/** True while a whole course is being asked about. */
const addingAll = ref(false)
/** Accepted lectures, saved one at a time in this order. */
const jobs: Job[] = []
/** aita session id → the task row its progress goes to. */
const runningTasks = new Map<string, string>()
let working = false
let listening = false

export function isSavingYanhe2Slides(subId: string): boolean {
  return pending.has(subId)
}

export function isAddingAllYanhe2Slides(): boolean {
  return addingAll.value
}

const t = (key: string, named?: Record<string, unknown>): string =>
  named ? i18n.global.t(key, named) : i18n.global.t(key)

/** Said in a message box, like the session lists' other queue notices. */
function notify(message: string): void {
  void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
}

/** Open Tasks, on that row when one is named. */
function showTask(taskId?: string): void {
  window.dispatchEvent(new CustomEvent('switchToTask', { detail: taskId }))
}

function listenForProgress(): void {
  if (listening) return
  listening = true
  window.electronAPI.yanhe2.onSlideSaveProgress(({ subId, done, total }) => {
    const taskId = runningTasks.get(subId)
    // 100 is the task machine's to set, on completion.
    if (taskId && total > 0) TaskQueue.updateTaskProgress(taskId, Math.min(99, (done / total) * 100))
  })
}

/** Check one lecture and, if it can be saved, add its task row and line it up. Saves nothing itself. */
async function ask(request: Yanhe2SlideSaveRequest): Promise<Asked> {
  const { account, courseId, subId } = request
  if (pending.has(subId)) return { kind: 'busy' }
  pending.add(subId)
  let accepted = false
  try {
    // Plain strings only: nothing reactive crosses the bridge.
    const prepared = await window.electronAPI.yanhe2.prepareSlideSave(account, { courseId, subId })
    if (prepared.kind !== 'ok') return { kind: prepared.kind }

    const { target } = prepared
    // The same row an extraction task of this lecture would be, so the two cannot both be queued.
    const added = TaskQueue.addExternalTask({
      name: `slides_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
      courseTitle: target.courseTitle,
      sessionTitle: target.sessionTitle,
      sessionId: target.sessionId,
      courseId: target.courseId,
    })
    if (!added.added) return { kind: 'already_queued' }

    accepted = true
    jobs.push({ account, courseId, subId, taskId: added.item.id })
    void work()
    return { kind: 'added', taskId: added.item.id }
  } catch (error) {
    log.error('Yanhe 2.0 slide save could not be prepared:', error)
    return { kind: 'failed' }
  } finally {
    if (!accepted) pending.delete(subId)
  }
}

/** Save the lined-up lectures, one at a time. From here each task row says how it went. */
async function work(): Promise<void> {
  if (working) return
  working = true
  try {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      await save(job)
      pending.delete(job.subId)
    }
  } finally {
    working = false
  }
}

async function save({ account, courseId, subId, taskId }: Job): Promise<void> {
  // Removed from Tasks while it waited: nothing to do.
  if (!TaskQueue.beginExternalTask(taskId)) return
  runningTasks.set(subId, taskId)
  listenForProgress()
  try {
    const result = await window.electronAPI.yanhe2.saveSlides(account, { courseId, subId })
    if (result.kind !== 'ok') {
      TaskQueue.updateTaskStatus(taskId, 'error', t(`yanhe2Playback.saveRefused.${result.kind}`))
      return
    }
    // Queue post-processing before completing, the order a finished task uses.
    if (configStore.autoPostProcessing !== false) {
      TaskQueue.startPostProcessing(taskId, result.target.folderPath, [...result.files])
    }
    TaskQueue.updateTaskStatus(taskId, 'completed')
  } catch (error) {
    log.error('Yanhe 2.0 slide save failed:', error)
    TaskQueue.updateTaskStatus(taskId, 'error', t('yanhe2Playback.saveRefused.failed'))
  } finally {
    runningTasks.delete(subId)
  }
}

/** One lecture: a task row in Tasks, or a message box saying why not. */
export async function saveYanhe2Slides(request: Yanhe2SlideSaveRequest): Promise<void> {
  const asked = await ask(request)
  if (asked.kind === 'added') showTask(asked.taskId)
  else if (asked.kind === 'already_queued') notify(t('sessions.alreadyInTaskQueue'))
  else if (asked.kind !== 'busy') notify(t(`yanhe2Playback.saveRefused.${asked.kind}`))
}

/**
 * Every lecture of a list: each is checked in turn, the ones with slides and
 * a Yanhekt match become task rows, and one message box says how many.
 */
export async function saveAllYanhe2Slides(requests: Yanhe2SlideSaveRequest[]): Promise<void> {
  if (addingAll.value || requests.length === 0) return
  addingAll.value = true
  let added = 0
  let shown = false
  let stopped: Yanhe2SlideSaveRefusal | null = null
  try {
    for (const request of requests) {
      const asked = await ask(request)
      if (asked.kind === 'added') {
        added++
        if (!shown) showTask()
        shown = true
      } else if (asked.kind === 'signed_out' || asked.kind === 'yanhekt_signed_out' || asked.kind === 'network') {
        // Not about this lecture: every later one would be turned down the same way.
        stopped = asked.kind
        break
      }
    }
  } finally {
    addingAll.value = false
  }

  if (added === 0) {
    notify(stopped ? t(`yanhe2Playback.saveRefused.${stopped}`) : t('yanhe2Curriculum.saveAllNone'))
  } else if (added < requests.length) {
    notify(t('yanhe2Curriculum.saveAllSome', { count: added, skipped: requests.length - added }))
  } else {
    notify(t('sessions.addedToTaskQueue', { count: added }))
  }
}
