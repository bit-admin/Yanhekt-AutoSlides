import { describe, it, expect } from 'vitest'
import {
  buildLibraryCourses,
  canHybridDual,
  defaultStreamMode,
  hybridOnlineKind,
  sessionHasDual,
  type LibraryFileRef,
  type LibrarySession,
} from './libraryModel'
import type { LectureVideoItem } from './useLecturesPage'
import type { LectureCourseMeta } from './lectureCourseMetaCache'

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

  it('copies Yanhekt URLs from course meta onto the session', () => {
    const items = [
      item({
        name: 'a [yhid=c1s2] [vtype=screen].mp4',
        path: '/out/a-scr.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'screen',
      }),
    ]
    const meta = new Map<string, LectureCourseMeta>([
      ['1', {
        courseId: '1',
        title: 'Course',
        sessions: [{
          session_id: '2',
          title: 'Lecture',
          video_id: '99',
          duration: 3600,
          mainUrl: 'https://cdn.example/main.m3u8',
          vgaUrl: 'https://cdn.example/vga.m3u8',
        }],
        degraded: false,
      }],
    ])
    const session = buildLibraryCourses(items, meta)[0].sessions[0]
    expect(session.videoId).toBe('99')
    expect(session.duration).toBe(3600)
    expect(session.mainUrl).toBe('https://cdn.example/main.m3u8')
    expect(session.vgaUrl).toBe('https://cdn.example/vga.m3u8')
    expect(hybridOnlineKind(session)).toBe('camera')
    expect(canHybridDual(session)).toBe(true)
    expect(defaultStreamMode(session)).toBe('screen')
  })
})

describe('hybridOnlineKind', () => {
  const base: Pick<LibrarySession, 'sessionId' | 'title' | 'episode'> = {
    sessionId: '2',
    title: 'Lecture',
    episode: 1,
  }

  function file(path: string, videoType: LibraryFileRef['videoType']): LibraryFileRef {
    return {
      path,
      name: path,
      size: 1,
      mtimeMs: 1,
      videoType,
      displayName: path,
      hasEmbyTags: true,
    }
  }

  it('is null when both files are local', () => {
    const session: LibrarySession = {
      ...base,
      screen: file('/s.mp4', 'screen'),
      camera: file('/c.mp4', 'camera'),
      mainUrl: 'https://cdn.example/main.m3u8',
      vgaUrl: 'https://cdn.example/vga.m3u8',
    }
    expect(sessionHasDual(session)).toBe(true)
    expect(hybridOnlineKind(session)).toBeNull()
    expect(canHybridDual(session)).toBe(false)
    expect(defaultStreamMode(session)).toBe('dual')
  })

  it('returns camera when only screen is local and mainUrl exists', () => {
    const session: LibrarySession = {
      ...base,
      screen: file('/s.mp4', 'screen'),
      mainUrl: 'https://cdn.example/main.m3u8',
    }
    expect(hybridOnlineKind(session)).toBe('camera')
    expect(canHybridDual(session)).toBe(true)
    expect(defaultStreamMode(session)).toBe('screen')
  })

  it('returns screen when only camera is local and vgaUrl exists', () => {
    const session: LibrarySession = {
      ...base,
      camera: file('/c.mp4', 'camera'),
      vgaUrl: 'https://cdn.example/vga.m3u8',
    }
    expect(hybridOnlineKind(session)).toBe('screen')
    expect(canHybridDual(session)).toBe(true)
    expect(defaultStreamMode(session)).toBe('camera')
  })

  it('is null when the complementary URL is missing', () => {
    const screenOnly: LibrarySession = { ...base, screen: file('/s.mp4', 'screen') }
    const cameraOnly: LibrarySession = { ...base, camera: file('/c.mp4', 'camera') }
    expect(hybridOnlineKind(screenOnly)).toBeNull()
    expect(hybridOnlineKind(cameraOnly)).toBeNull()
    expect(canHybridDual(screenOnly)).toBe(false)
    expect(defaultStreamMode(screenOnly)).toBe('screen')
    expect(defaultStreamMode(cameraOnly)).toBe('camera')
  })
})
