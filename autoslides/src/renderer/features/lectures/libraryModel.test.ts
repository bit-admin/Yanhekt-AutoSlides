import { describe, it, expect } from 'vitest'
import {
  buildLibraryCourses,
  defaultStreamMode,
  sessionHasDual,
} from './libraryModel'
import type { LectureVideoItem } from './useLecturesPage'

function item(partial: Partial<LectureVideoItem> & Pick<LectureVideoItem, 'name' | 'path'>): LectureVideoItem {
  return {
    size: 1,
    mtimeMs: 1,
    displayName: partial.displayName || partial.name,
    recognised: true,
    hasEmbyTags: true,
    ...partial,
  }
}

describe('buildLibraryCourses', () => {
  it('pairs screen + camera under one session and defaults to dual', () => {
    const items = [
      item({
        name: 'a [yhid=c1s2] [vtype=camera].mp4',
        path: '/out/a-cam.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'camera',
        displayName: 'Course - S01E01 - Lecture',
        mtimeMs: 10,
      }),
      item({
        name: 'a [yhid=c1s2] [vtype=screen] [ascomp=small].mp4',
        path: '/out/a-scr.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'screen',
        compressPreset: 'small',
        displayName: 'Course - S01E01 - Lecture',
        mtimeMs: 20,
      }),
    ]

    const courses = buildLibraryCourses(items)
    expect(courses).toHaveLength(1)
    expect(courses[0].sessions).toHaveLength(1)
    const session = courses[0].sessions[0]
    expect(session.screen?.path).toBe('/out/a-scr.mp4')
    expect(session.camera?.path).toBe('/out/a-cam.mp4')
    expect(sessionHasDual(session)).toBe(true)
    expect(defaultStreamMode(session)).toBe('dual')
    expect(session.posterSourcePath).toBe('/out/a-scr.mp4')
  })

  it('ignores unrecognised files', () => {
    const items = [
      item({
        name: 'random.mp4',
        path: '/out/random.mp4',
        recognised: false,
      }),
    ]
    expect(buildLibraryCourses(items)).toEqual([])
  })

  it('prefers newer file when duplicate type', () => {
    const items = [
      item({
        name: 'old [yhid=c1s2] [vtype=screen].mp4',
        path: '/out/old.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'screen',
        mtimeMs: 1,
      }),
      item({
        name: 'new [yhid=c1s2] [vtype=screen].mp4',
        path: '/out/new.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'screen',
        mtimeMs: 99,
      }),
    ]
    const session = buildLibraryCourses(items)[0].sessions[0]
    expect(session.screen?.path).toBe('/out/new.mp4')
    expect(defaultStreamMode(session)).toBe('screen')
  })
})
