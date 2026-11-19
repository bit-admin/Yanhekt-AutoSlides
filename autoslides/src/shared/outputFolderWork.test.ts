import { describe, expect, it } from 'vitest'
import {
  describeOutputFolderWork,
  hasOutputFolderWork,
  NO_OUTPUT_FOLDER_WORK,
  OutputFolderBusyError,
  parseOutputFolderBusy,
} from './outputFolderWork'

describe('outputFolderWork', () => {
  it('round-trips the counts through an IPC-wrapped message', () => {
    const work = { downloads: 1, extractions: 2, tasks: 0, postProcessing: 3, slideVideos: 1 }
    const wrapped = new Error(`Error invoking remote method 'config:selectOutputDirectory': ${new OutputFolderBusyError(work).message}`)
    expect(parseOutputFolderBusy(wrapped)).toEqual(work)
  })

  it('is null for any other error', () => {
    expect(parseOutputFolderBusy(new Error('EACCES'))).toBeNull()
    expect(parseOutputFolderBusy(undefined)).toBeNull()
  })

  it('describes the work in English', () => {
    expect(describeOutputFolderWork({ downloads: 1, extractions: 0, tasks: 0, postProcessing: 0, slideVideos: 0 })).toBe('1 download')
    expect(describeOutputFolderWork({ downloads: 2, extractions: 1, tasks: 0, postProcessing: 1, slideVideos: 0 })).toBe(
      '2 downloads, 1 extraction and 1 post-processing job',
    )
    expect(new OutputFolderBusyError({ ...NO_OUTPUT_FOLDER_WORK, slideVideos: 2 }).message).toContain('2 slide videos are unfinished')
    expect(new OutputFolderBusyError({ downloads: 1, extractions: 0, tasks: 0, postProcessing: 0, slideVideos: 0 }).message).toContain('1 download is unfinished')
  })

  it('treats all zeros as idle', () => {
    expect(hasOutputFolderWork(NO_OUTPUT_FOLDER_WORK)).toBe(false)
    expect(hasOutputFolderWork({ ...NO_OUTPUT_FOLDER_WORK, tasks: 1 })).toBe(true)
  })
})
