import { describe, expect, it, vi } from 'vitest'

vi.mock('./extractionQueueService', () => ({ ExtractionQueue: { willAutoExtract: async () => false } }))

import type { LectureOutputState } from '@common/lectureOutputs'
import { decideQueue, downloadFileOf, gateMany, gateOne, redoPlan, type GateDeps, type GateLecture } from './lectureOutputGate'

const slides = (extracted: boolean) => ({
  folders: ['slides_课__c1s2'], folderPath: '/out/slides_课__c1s2', slideCount: extracted ? 12 : 0, extracted,
  cropped: true, reviewed: false, edited: false, uploaded: 3, shares: 1, slideVideo: false,
})
const state = (key: string, videoExists: boolean, extracted: boolean | null): LectureOutputState =>
  ({ key, videoExists, slides: extracted === null ? null : slides(extracted) })

describe('decideQueue', () => {
  it('skips a finished extraction for tasks and extracting screen downloads', () => {
    expect(decideQueue('task', false, state('a', false, true))).toEqual({ action: 'skip', reason: 'extracted' })
    expect(decideQueue('screen', true, state('a', true, true))).toEqual({ action: 'skip', reason: 'extracted' })
  })

  it('extracts from the video on disk instead of downloading it again', () => {
    expect(decideQueue('screen', true, state('a', true, false))).toEqual({ action: 'queue', mode: 'existing' })
    expect(decideQueue('screen', true, state('a', true, null))).toEqual({ action: 'queue', mode: 'existing' })
  })

  it('treats an empty or unrecorded folder as a failed run', () => {
    expect(decideQueue('task', false, state('a', false, false))).toEqual({ action: 'queue', mode: 'download' })
  })

  it('skips an existing file for plain downloads, and queues when nothing is known', () => {
    expect(decideQueue('camera', false, state('a', true, true))).toEqual({ action: 'skip', reason: 'downloaded' })
    expect(decideQueue('screen', false, state('a', true, null))).toEqual({ action: 'skip', reason: 'downloaded' })
    expect(decideQueue('audio', false, undefined)).toEqual({ action: 'queue', mode: 'download' })
  })
})

describe('redoPlan', () => {
  const lecture: GateLecture = { key: 'a', courseId: '1', sessionId: '2', videoFile: 'screen_课__c1s2.mp4' }
  it('moves the slides folders and keeps the video for a re-extraction', () => {
    expect(redoPlan('extracted', 'screen', lecture, state('a', true, true)))
      .toEqual({ retire: { slidesFolders: ['slides_课__c1s2'], videoFiles: [] }, mode: 'existing' })
    expect(redoPlan('extracted', 'task', lecture, state('a', true, true)).mode).toBe('download')
  })
  it('moves only the file for a download again', () => {
    expect(redoPlan('downloaded', 'camera', lecture, state('a', true, null)))
      .toEqual({ retire: { slidesFolders: [], videoFiles: ['screen_课__c1s2.mp4'] }, mode: 'download' })
  })
})

it('names the finished file like the downloader', () => {
  expect(downloadFileOf({ name: 'screen_课 程_第1周', courseId: '1', sessionId: '2' }, 'screen')).toBe('screen_课_程_第1周__c1s2.mp4')
  expect(downloadFileOf({ name: 'audio_课', courseId: '1', sessionId: '2' }, 'audio')).toBe('audio_课__c1s2.aac')
})

function deps(states: LectureOutputState[], answer: number, extracts = true) {
  const queued: Array<[string, string]> = []
  const retired: unknown[] = []
  const asked: unknown[] = []
  const dropped: string[] = []
  const d: GateDeps<{ added: boolean }> = {
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    willAutoExtract: async () => extracts,
    probe: async (lectures) => lectures.map((l) => states.find((s) => s.key === l.key) ?? { key: l.key, videoExists: false, slides: null }),
    retire: async (target) => { retired.push(target); return { removed: 1, failed: 0 } },
    ask: async (options) => { asked.push(options); return answer },
    enqueue: (lecture, mode) => { queued.push([lecture.key, mode]); return { added: true } },
    queue: { isBusy: () => false, dropFinished: (lecture) => { dropped.push(lecture.key) } },
  }
  return { d, queued, retired, asked, dropped }
}

describe('gateOne', () => {
  const lecture: GateLecture = { key: 'a', courseId: '1', sessionId: '2', videoFile: 'screen_课__c1s2.mp4' }

  it('asks before redoing a finished extraction, and Skip leaves everything alone', async () => {
    const { d, queued, retired, asked } = deps([state('a', true, true)], 0)
    expect(await gateOne(d, 'screen', lecture)).toBeNull()
    expect(queued).toEqual([])
    expect(retired).toEqual([])
    expect(asked).toHaveLength(1)
  })

  it('Re-extract moves the folder aside and extracts from the existing video', async () => {
    const { d, queued, retired } = deps([state('a', true, true)], 1)
    expect(await gateOne(d, 'screen', lecture)).toEqual({ added: true })
    expect(retired).toEqual([{ slidesFolders: ['slides_课__c1s2'], videoFiles: [] }])
    expect(queued).toEqual([['a', 'existing']])
  })
})

describe('gateMany', () => {
  const lectures = ['a', 'b', 'c'].map((key) => ({ key, courseId: '1', sessionId: key, videoFile: `screen_${key}.mp4` }))
  const summary = () => ({ title: 'T', message: 'M' })

  it('queues what is not done without asking, then offers to redo the rest', async () => {
    const { d, queued, asked } = deps([state('a', true, true), state('b', true, false)], 0)
    expect(await gateMany(d, 'screen', lectures, summary)).toEqual({ added: 2, queued: 0, skipped: 1, redone: 0, failed: 0, busy: 0, notQueued: 0 })
    expect(queued).toEqual([['b', 'existing'], ['c', 'download']])
    expect(asked).toHaveLength(1)
  })

  it('redoes the skipped lectures when asked', async () => {
    const { d, queued, retired } = deps([state('a', true, true)], 1)
    expect(await gateMany(d, 'screen', lectures, summary)).toEqual({ added: 2, queued: 0, skipped: 0, redone: 1, failed: 0, busy: 0, notQueued: 0 })
    expect(retired).toHaveLength(1)
    expect(queued.at(-1)).toEqual(['a', 'existing'])
  })

  it('never asks when nothing was skipped', async () => {
    const { d, asked } = deps([], 1)
    await gateMany(d, 'task', lectures, summary)
    expect(asked).toEqual([])
  })
})

describe('redo keeps the old output unless a new run can follow', () => {
  const lecture: GateLecture = { key: 'a', courseId: '1', sessionId: '2', videoFile: 'camera_课__c1s2.mp4' }
  const done = [state('a', true, null)]

  it('replaces a finished row: moves the file, drops the row, then queues', async () => {
    const { d, queued, retired, dropped } = deps(done, 1)
    expect(await gateOne(d, 'camera', lecture)).toEqual({ added: true })
    expect(retired).toHaveLength(1)
    expect(dropped).toEqual(['a'])
    expect(queued).toEqual([['a', 'download']])
  })

  it('moves nothing while the lecture is still in the queue', async () => {
    const { d, queued, retired, asked } = deps(done, 1)
    d.queue.isBusy = () => true
    expect(await gateOne(d, 'camera', lecture)).toBeNull()
    expect(retired).toHaveLength(0)
    expect(queued).toHaveLength(0)
    expect(asked).toHaveLength(2)
  })

  it('keeps the finished row when the move fails', async () => {
    const { d, queued, dropped } = deps(done, 1)
    d.retire = async () => ({ removed: 0, failed: 1 })
    expect(await gateOne(d, 'camera', lecture)).toBeNull()
    expect(dropped).toHaveLength(0)
    expect(queued).toHaveLength(0)
  })

  it('counts each batch outcome', async () => {
    const lectures = ['a', 'b', 'c', 'd'].map((key) => ({ ...lecture, key }))
    const { d } = deps(lectures.map((l) => state(l.key, true, null)), 1)
    d.queue.isBusy = (l) => l.key === 'b'
    d.retire = async () => ({ removed: 1, failed: 0 })
    let calls = 0
    d.retire = async () => (++calls === 2 ? { removed: 0, failed: 1 } : { removed: 1, failed: 0 })
    d.enqueue = (l) => ({ added: l.key !== 'd' })
    expect(await gateMany(d, 'camera', lectures, () => ({ title: '', message: '' })))
      .toEqual({ added: 0, queued: 0, skipped: 0, redone: 1, failed: 1, busy: 1, notQueued: 1 })
  })
})
