import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  downloads: [] as Array<{ status: string; extractionStatus?: string }>,
  pipelines: [] as Array<{ isActive: boolean }>,
  tasks: [] as Array<{ status: string }>,
  jobs: [] as Array<{ status: string }>,
}))

vi.mock('@shared/services/downloadService', () => ({ DownloadService: { get downloadItems() { return state.downloads } } }))
vi.mock('@shared/services/taskQueueService', () => ({ TaskQueue: { get tasks() { return state.tasks } } }))
vi.mock('@shared/services/postProcessingService', () => ({ PostProcessingService: { get jobs() { return state.jobs } } }))
vi.mock('@shared/processing/manager', () => ({ slideExtractionManager: { getAll: () => state.pipelines } }))

import { countOutputFolderWork, downloadRowIsUnfinished } from './outputFolderWork'

describe('countOutputFolderWork', () => {
  it('counts only work that will still write', () => {
    state.downloads = [
      { status: 'queued' },
      { status: 'downloading' },
      { status: 'completed', extractionStatus: 'extracting' },
      { status: 'completed', extractionStatus: 'completed' },
      { status: 'completed' },
      // A failed download leaves its pending extraction to be skipped, not run.
      { status: 'error', extractionStatus: 'pending' },
    ]
    state.pipelines = [{ isActive: true }, { isActive: false }]
    state.tasks = [{ status: 'queued' }, { status: 'in_progress' }, { status: 'completed' }, { status: 'error' }]
    state.jobs = [{ status: 'processing' }, { status: 'failed' }]
    expect(countOutputFolderWork()).toEqual({ downloads: 3, extractions: 1, tasks: 2, postProcessing: 1 })
  })

  it('treats a finished row as done', () => {
    expect(downloadRowIsUnfinished({ status: 'completed', extractionStatus: 'cancelled' })).toBe(false)
    expect(downloadRowIsUnfinished({ status: 'processing', extractionStatus: undefined })).toBe(true)
  })
})
