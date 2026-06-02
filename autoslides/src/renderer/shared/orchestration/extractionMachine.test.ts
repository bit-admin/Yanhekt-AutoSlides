import { describe, it, expect } from 'vitest'
import type { ExtractionStatus } from '@shared/services/downloadService'
import { reduceExtraction, isTerminalExtraction } from './extractionMachine'

describe('reduceExtraction', () => {
  it('marks an item pending with reset progress', () => {
    expect(reduceExtraction(undefined, { type: 'MARK_PENDING' })).toEqual({
      status: 'pending',
      progress: 0
    })
    expect(reduceExtraction('none', { type: 'MARK_PENDING' })).toEqual({
      status: 'pending',
      progress: 0
    })
  })

  describe('happy path: pending → extracting → normalizing → post_processing → completed', () => {
    it('starts extraction from pending', () => {
      expect(reduceExtraction('pending', { type: 'EXTRACT_STARTED' })).toEqual({
        status: 'extracting',
        progress: 0
      })
    })

    it('begins normalization from extracting', () => {
      expect(reduceExtraction('extracting', { type: 'NORMALIZE_STARTED' })).toEqual({
        status: 'normalizing'
      })
    })

    it('begins post-processing', () => {
      expect(reduceExtraction('normalizing', { type: 'POSTPROCESS_STARTED' })).toEqual({
        status: 'post_processing'
      })
      // Also legal directly from extracting (no color-reduction pass).
      expect(reduceExtraction('extracting', { type: 'POSTPROCESS_STARTED' })).toEqual({
        status: 'post_processing'
      })
    })

    it('completes with full progress on POSTPROCESS_DONE', () => {
      expect(reduceExtraction('post_processing', { type: 'POSTPROCESS_DONE' })).toEqual({
        status: 'completed',
        progress: 100
      })
    })
  })

  describe('no-post-process / empty-slides paths', () => {
    it('FINISH completes with progress 100 from extracting', () => {
      expect(reduceExtraction('extracting', { type: 'FINISH' })).toEqual({
        status: 'completed',
        progress: 100
      })
    })

    it('FINISH completes with progress 100 from normalizing', () => {
      expect(reduceExtraction('normalizing', { type: 'FINISH' })).toEqual({
        status: 'completed',
        progress: 100
      })
    })
  })

  describe('progress guard', () => {
    it('applies clamped/rounded progress only while extracting', () => {
      expect(reduceExtraction('extracting', { type: 'EXTRACT_PROGRESS', percent: 42.6 })).toEqual({
        progress: 43
      })
      expect(reduceExtraction('extracting', { type: 'EXTRACT_PROGRESS', percent: -5 })).toEqual({
        progress: 0
      })
      expect(reduceExtraction('extracting', { type: 'EXTRACT_PROGRESS', percent: 250 })).toEqual({
        progress: 100
      })
    })

    it('ignores progress when not extracting', () => {
      for (const s of ['pending', 'normalizing', 'post_processing'] as ExtractionStatus[]) {
        expect(reduceExtraction(s, { type: 'EXTRACT_PROGRESS', percent: 50 })).toBeNull()
      }
    })
  })

  describe('failure paths', () => {
    it('DOWNLOAD_FAILED cancels a pending item with the error', () => {
      expect(reduceExtraction('pending', { type: 'DOWNLOAD_FAILED', error: 'net down' })).toEqual({
        status: 'cancelled',
        error: 'net down'
      })
    })

    it('DOWNLOAD_FAILED is a no-op when not pending', () => {
      expect(reduceExtraction('extracting', { type: 'DOWNLOAD_FAILED', error: 'x' })).toBeNull()
    })

    it('EXTRACT_FAILED → error with message', () => {
      expect(reduceExtraction('extracting', { type: 'EXTRACT_FAILED', error: 'boom' })).toEqual({
        status: 'error',
        error: 'boom'
      })
    })

    it('NORMALIZE_FAILED → error with message', () => {
      expect(reduceExtraction('normalizing', { type: 'NORMALIZE_FAILED', error: 'bad png' })).toEqual({
        status: 'error',
        error: 'bad png'
      })
    })

    it('POSTPROCESS_FAILED → error with message', () => {
      expect(reduceExtraction('post_processing', { type: 'POSTPROCESS_FAILED', error: 'ai 429' })).toEqual({
        status: 'error',
        error: 'ai 429'
      })
    })
  })

  describe('cancel precedence', () => {
    it('CANCEL moves any in-flight stage to cancelled', () => {
      for (const s of ['pending', 'extracting', 'normalizing', 'post_processing'] as ExtractionStatus[]) {
        expect(reduceExtraction(s, { type: 'CANCEL' })).toEqual({ status: 'cancelled' })
      }
    })

    it('once cancelled, every advance event is a no-op (cancel wins the race)', () => {
      const advances = [
        { type: 'EXTRACT_STARTED' },
        { type: 'NORMALIZE_STARTED' },
        { type: 'POSTPROCESS_STARTED' },
        { type: 'POSTPROCESS_DONE' },
        { type: 'FINISH' },
        { type: 'EXTRACT_PROGRESS', percent: 80 }
      ] as const
      for (const ev of advances) {
        expect(reduceExtraction('cancelled', ev)).toBeNull()
      }
    })
  })

  describe('terminal-state immutability', () => {
    it('nothing escapes a terminal state', () => {
      const terminals: ExtractionStatus[] = ['completed', 'error', 'cancelled']
      const events = [
        { type: 'MARK_PENDING' },
        { type: 'EXTRACT_STARTED' },
        { type: 'FINISH' },
        { type: 'CANCEL' },
        { type: 'POSTPROCESS_DONE' },
        { type: 'EXTRACT_FAILED', error: 'x' }
      ] as const
      for (const t of terminals) {
        for (const ev of events) {
          expect(reduceExtraction(t, ev)).toBeNull()
        }
      }
    })
  })

  describe('isTerminalExtraction', () => {
    it('classifies terminal vs in-flight states', () => {
      expect(isTerminalExtraction('completed')).toBe(true)
      expect(isTerminalExtraction('error')).toBe(true)
      expect(isTerminalExtraction('cancelled')).toBe(true)
      expect(isTerminalExtraction('extracting')).toBe(false)
      expect(isTerminalExtraction('pending')).toBe(false)
      expect(isTerminalExtraction(undefined)).toBe(false)
      expect(isTerminalExtraction('none')).toBe(false)
    })
  })
})
