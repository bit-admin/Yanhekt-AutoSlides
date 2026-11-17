import { describe, expect, it } from 'vitest'
import type { DownloadItem } from '@shared/services/downloadService'
import { isCliItem, listed, snapshot, type CliItem } from './cliQueueItems'

const item = (over: Partial<DownloadItem> & Pick<DownloadItem, 'id' | 'videoType'>): DownloadItem => ({
  name: `${over.videoType}_课程-第1讲`,
  courseTitle: '课程',
  sessionTitle: '第1讲',
  sessionId: '850101',
  courseId: '70101',
  status: 'queued',
  progress: 0,
  addedAt: 1,
  ...over,
})

const yanhe2 = { account: 'a', courseId: '9001', subId: '9101' }

describe('the Download panel rows the command line sees', () => {
  const queue: DownloadItem[] = [
    item({ id: 'screen', videoType: 'screen' }),
    item({ id: 'camera', videoType: 'camera' }),
    item({ id: 'audio', videoType: 'audio' }),
    // Yanhe 2.0 recordings of a lecture Yanhekt also has: same session id, other source.
    item({ id: 'y2-screen', videoType: 'screen', sessionId: '850102', yanhe2 }),
    item({ id: 'y2-camera', videoType: 'camera', sessionId: '850102', yanhe2 }),
    item({ id: 'y2-audio', videoType: 'audio', sessionId: '850102', yanhe2 }),
    // A Yanhe 2.0 lecture with no Yanhekt session.
    item({ id: 'y2-only', videoType: 'screen', sessionId: '', yanhe2 }),
    item({ id: 'y2-subtitles', videoType: 'subtitles', sessionId: '850102', yanhe2 }),
    item({ id: 'subtitles', videoType: 'subtitles' }),
  ]

  it('are the Yanhekt streams and mic stem only, whatever the session id says', () => {
    expect(queue.filter(isCliItem).map((i) => i.id)).toEqual(['screen', 'camera', 'audio'])
  })

  it('are told as plain values', () => {
    const row = listed(item({ id: 'a', videoType: 'screen', sessionId: 850101 as unknown as string, courseId: 70101 as unknown as string, status: 'error', error: 'HTTP 500' }) as CliItem)
    expect(row).toEqual({
      itemId: 'a',
      state: 'error',
      progress: 0,
      error: 'HTTP 500',
      kind: 'screen',
      name: 'screen_课程-第1讲',
      sessionId: '850101',
      courseId: '70101',
      courseTitle: '课程',
      sessionTitle: '第1讲',
      addedAt: 1,
      completedAt: null,
      extraction: null,
    })
  })

  it('tell the file a finished download wrote, and only then', () => {
    expect(snapshot('a', item({ id: 'a', videoType: 'screen', status: 'completed', progress: 100, filePath: '/then/a.mp4' }))).toEqual({
      itemId: 'a', state: 'completed', progress: 100, filePath: '/then/a.mp4',
    })
    expect(snapshot('a', item({ id: 'a', videoType: 'screen', status: 'downloading', filePath: '/then/a.mp4' })).filePath).toBeUndefined()
  })

  it('reads a row that left the list as removed', () => {
    expect(snapshot('gone', undefined)).toEqual({ itemId: 'gone', state: 'removed', progress: 0 })
  })
})
