/**
 * A Yanhe 2.0 recording as an extraction task: the queue opens it in the
 * Yanhe 2.0 player, which plays the screen recording at the task speed and
 * extracts its slides (`useYanhe2TaskDriver`), exactly as a Yanhekt task does.
 *
 * The task row carries the same lecture's Yanhekt ids and titles (main finds
 * them, `yanhe2:prepareExtraction`), so its name is the one a Yanhekt task or
 * a server-slides save of it would have, and the queue will not take the
 * lecture twice. The aita ids ride along to play it.
 */
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2ExtractionRefusal } from '@common/yanhe2Extraction'
import { TaskQueue } from '@shared/services/taskQueueService'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2ExtractionTask')

export interface Yanhe2ExtractionTaskRequest {
  account: string
  /** The session row, which the task's playback tab is opened from. */
  session: Yanhe2CalendarSession
}

export type Yanhe2ExtractionTaskAsked =
  | { kind: 'added'; taskId: string }
  /** The task list already has this lecture. */
  | { kind: 'already_queued' }
  | { kind: Yanhe2ExtractionRefusal }

/** Find the lecture and add its task row. Plays nothing: the queue starts it. */
export async function askYanhe2ExtractionTask(request: Yanhe2ExtractionTaskRequest): Promise<Yanhe2ExtractionTaskAsked> {
  const { account } = request
  // A plain copy: the row is reactive, and the task outlives the list.
  const session: Yanhe2CalendarSession = { ...request.session }
  try {
    const prepared = await window.electronAPI.yanhe2.prepareExtraction(account, { courseId: session.courseId, subId: session.subId })
    if (prepared.kind !== 'ok') return { kind: prepared.kind }
    const { target } = prepared
    const added = TaskQueue.addToQueue({
      name: `slides_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
      courseTitle: target.courseTitle,
      sessionTitle: target.sessionTitle,
      sessionId: target.sessionId,
      courseId: target.courseId,
      yanhe2: { account, session },
    })
    return added.added ? { kind: 'added', taskId: added.item.id } : { kind: 'already_queued' }
  } catch (error) {
    log.error('Yanhe 2.0 extraction task could not be prepared:', error)
    return { kind: 'failed' }
  }
}
