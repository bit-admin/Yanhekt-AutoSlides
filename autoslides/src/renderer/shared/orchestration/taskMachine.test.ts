import { describe, it, expect } from 'vitest'
import type { TaskStatus } from '@shared/services/taskQueueService'
import { reduceTask } from './taskMachine'

describe('reduceTask', () => {
  it('START moves a queued task to in_progress and stamps startedAt', () => {
    expect(reduceTask('queued', { type: 'START' })).toEqual({
      status: 'in_progress',
      progress: 0,
      startedAt: 'now'
    })
  })

  it('COMPLETE finishes with progress 100 and stamps completedAt', () => {
    expect(reduceTask('in_progress', { type: 'COMPLETE' })).toEqual({
      status: 'completed',
      progress: 100,
      completedAt: 'now'
    })
  })

  it('FAIL errors with progress 0, the message, and completedAt', () => {
    expect(reduceTask('in_progress', { type: 'FAIL', error: 'boom' })).toEqual({
      status: 'error',
      progress: 0,
      error: 'boom',
      completedAt: 'now'
    })
  })

  describe('PROGRESS', () => {
    it('clamps/floors progress only while in_progress', () => {
      expect(reduceTask('in_progress', { type: 'PROGRESS', value: 42.9 })).toEqual({ progress: 42 })
      expect(reduceTask('in_progress', { type: 'PROGRESS', value: -3 })).toEqual({ progress: 0 })
      expect(reduceTask('in_progress', { type: 'PROGRESS', value: 150 })).toEqual({ progress: 100 })
    })

    it('is a no-op when not in_progress', () => {
      for (const s of ['queued', 'completed', 'error'] as TaskStatus[]) {
        expect(reduceTask(s, { type: 'PROGRESS', value: 50 })).toBeNull()
      }
    })
  })

  describe('PAUSE', () => {
    it('reverts a running task to queued, resets progress, clears startedAt', () => {
      expect(reduceTask('in_progress', { type: 'PAUSE' })).toEqual({
        status: 'queued',
        progress: 0,
        startedAt: 'clear'
      })
    })

    it('is a no-op when not in_progress', () => {
      for (const s of ['queued', 'completed', 'error'] as TaskStatus[]) {
        expect(reduceTask(s, { type: 'PAUSE' })).toBeNull()
      }
    })
  })
})
