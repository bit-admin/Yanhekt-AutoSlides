// Pure state machine for the automated task queue (Chain B).
//
// No Vue / DOM dependencies — the sole place task-status transitions are
// decided, unit-tested in taskMachine.test.ts. The reactive TaskQueue service
// applies the returned patch (translating the timestamp sentinels to real
// Date.now() values, which keeps this module pure and testable).

import type { TaskStatus } from '@shared/services/taskQueueService'

export type TaskEvent =
  | { type: 'START' }
  | { type: 'PROGRESS'; value: number }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; error: string }
  | { type: 'PAUSE' }

export interface TaskPatch {
  status?: TaskStatus
  progress?: number
  error?: string
  // Timestamp intents — the service fills the actual value / deletion so the
  // machine stays free of side effects.
  startedAt?: 'now' | 'clear'
  completedAt?: 'now'
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.floor(value)))
}

/**
 * Decide the field patch for `event` given the task's `current` status.
 * Returns `null` for no-op transitions (e.g. progress while not in_progress,
 * pause while not running).
 */
export function reduceTask(current: TaskStatus, event: TaskEvent): TaskPatch | null {
  switch (event.type) {
    case 'START':
      return { status: 'in_progress', progress: 0, startedAt: 'now' }

    case 'PROGRESS':
      if (current !== 'in_progress') return null
      return { progress: clampProgress(event.value) }

    case 'COMPLETE':
      return { status: 'completed', progress: 100, completedAt: 'now' }

    case 'FAIL':
      return { status: 'error', progress: 0, error: event.error, completedAt: 'now' }

    case 'PAUSE':
      // Only a running task reverts to queued; mirrors the old pauseQueue guard.
      if (current !== 'in_progress') return null
      return { status: 'queued', progress: 0, startedAt: 'clear' }

    default:
      return null
  }
}
