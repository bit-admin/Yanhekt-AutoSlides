import { TaskQueue } from '@shared/services/taskQueueService'
import type { PlaybackTab } from '@features/course/tabStore'

/** A task's tab stays open while the task runs, whichever control asks to close it. */
export function isPlaybackTabClosable(tab: Pick<PlaybackTab, 'origin' | 'taskId'>): boolean {
  if (tab.origin !== 'task' || !tab.taskId) return true
  const task = TaskQueue.tasks.find((item) => item.id === tab.taskId)
  return !task || task.status !== 'in_progress'
}
