/**
 * Saving a Yanhe 2.0 recording's server slides, wired into the task queue.
 *
 * The slides are treated like a task's own extraction: main finds the same
 * lecture on Yanhekt and writes `Slide_*.png` into its `slides_*` folder, the
 * work shows up as a task row, and the saved files go to post-processing
 * exactly as a finished task's do. If the lecture cannot be found on Yanhekt
 * (or Yanhekt is signed out) nothing is saved and no task is added.
 *
 * Module state, not a composable: a save outlives the tab it was started
 * from, and reopening the tab shows where it stands.
 */
import { reactive } from 'vue'
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2SlideSaveRefusal } from '@common/yanhe2SlideSave'
import { i18n } from '@shared/i18n'
import { configStore } from '@shared/services/configStore'
import { TaskQueue } from '@shared/services/taskQueueService'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2SlideSave')

/** aita session ids being saved right now. */
const saving = reactive(new Set<string>())
/** aita session id → the task row its progress goes to. */
const runningTasks = new Map<string, string>()
let listening = false

export function isSavingYanhe2Slides(subId: string): boolean {
  return saving.has(subId)
}

/** Open Tasks on that row, the way a queued download opens Download. */
function showTask(taskId: string): void {
  window.dispatchEvent(new CustomEvent('switchToTask', { detail: taskId }))
}

/** A save that did not start is said in a message box, like the player's other actions. */
function explain(problem: Yanhe2SlideSaveRefusal): void {
  void window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    message: i18n.global.t(`yanhe2Playback.saveRefused.${problem}`),
  })
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

export async function saveYanhe2Slides(request: { account: string; courseId: string; subId: string }): Promise<void> {
  const { account, subId } = request
  if (saving.has(subId)) return
  saving.add(subId)
  // Plain strings only: nothing reactive crosses the bridge.
  const query = { courseId: request.courseId, subId }

  let taskId: string | null = null
  try {
    const prepared = await window.electronAPI.yanhe2.prepareSlideSave(account, query)
    if (prepared.kind !== 'ok') {
      explain(prepared.kind)
      return
    }

    const { target } = prepared
    // The same row an extraction task of this lecture would be, so the two cannot both be queued.
    const added = TaskQueue.addRunningTask({
      name: `slides_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
      courseTitle: target.courseTitle,
      sessionTitle: target.sessionTitle,
      sessionId: target.sessionId,
      courseId: target.courseId,
    })
    if (!added.added) {
      showTask(added.existingItem.id)
      return
    }
    taskId = added.item.id
    runningTasks.set(subId, taskId)
    listenForProgress()
    showTask(taskId)

    // From here the task row says how it went.
    const result = await window.electronAPI.yanhe2.saveSlides(account, query)
    if (result.kind !== 'ok') {
      TaskQueue.updateTaskStatus(taskId, 'error', i18n.global.t(`yanhe2Playback.saveRefused.${result.kind}`))
      return
    }

    // Queue post-processing before completing, the order a finished task uses.
    if (configStore.autoPostProcessing !== false) {
      TaskQueue.startPostProcessing(taskId, result.target.folderPath, [...result.files])
    }
    TaskQueue.updateTaskStatus(taskId, 'completed')
  } catch (error) {
    log.error('Yanhe 2.0 slide save failed:', error)
    if (taskId) TaskQueue.updateTaskStatus(taskId, 'error', i18n.global.t('yanhe2Playback.saveRefused.failed'))
    else explain('failed')
  } finally {
    runningTasks.delete(subId)
    saving.delete(subId)
  }
}
