import { describe, it, expect } from 'vitest'
import {
  buildLibraryCourses,
  canHybridDual,
  canPlayCamera,
  canPlayScreen,
  canShowDual,
  defaultStreamMode,
  hybridOnlineKind,
  isCameraOnline,
  isScreenOnline,
  sessionHasDual,
  sessionHasLocalVideo,
  slideSeedFromFolder,
  type LibraryFileRef,
  type LibrarySession,
  type LibrarySlideSeed,
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

  it('includes slides-only sessions that have course and session ids', () => {
    const seeds: LibrarySlideSeed[] = [{
      courseId: '9',
      sessionId: '10',
      folderPath: '/out/slides_Algebra_第1周__c9s10',
      folderName: 'slides_Algebra_第1周__c9s10',
      fallbackTitle: 'Algebra_第1周',
    }]
    const courses = buildLibraryCourses([], new Map(), seeds)
    expect(courses).toHaveLength(1)
    expect(courses[0].courseId).toBe('9')
    expect(courses[0].fileCount).toBe(0)
    expect(courses[0].sessions).toHaveLength(1)
    expect(courses[0].sessions[0].sessionId).toBe('10')
    expect(courses[0].sessions[0].slideFolderPath).toBe('/out/slides_Algebra_第1周__c9s10')
    expect(sessionHasLocalVideo(courses[0].sessions[0])).toBe(false)
  })

  it('merges a slide seed into an existing video session', () => {
    const items = [
      item({
        name: 'a [yhid=c1s2] [vtype=screen].mp4',
        path: '/out/a-scr.mp4',
        courseId: '1',
        sessionId: '2',
        videoType: 'screen',
      }),
    ]
    const seeds: LibrarySlideSeed[] = [{
      courseId: '1',
      sessionId: '2',
      folderPath: '/out/slides_Course__c1s2',
      folderName: 'slides_Course__c1s2',
      fallbackTitle: 'Course',
    }]
    const session = buildLibraryCourses(items, new Map(), seeds)[0].sessions[0]
    expect(session.screen?.path).toBe('/out/a-scr.mp4')
    expect(session.slideFolderPath).toBe('/out/slides_Course__c1s2')
  })

  it('copies Yanhekt URLs onto a slides-only session', () => {
    const seeds: LibrarySlideSeed[] = [{
      courseId: '1',
      sessionId: '2',
      folderPath: '/out/slides_Course__c1s2',
      folderName: 'slides_Course__c1s2',
      fallbackTitle: 'Course',
    }]
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
    const session = buildLibraryCourses([], meta, seeds)[0].sessions[0]
    expect(session.mainUrl).toBe('https://cdn.example/main.m3u8')
    expect(session.vgaUrl).toBe('https://cdn.example/vga.m3u8')
    expect(canShowDual(session)).toBe(true)
    expect(defaultStreamMode(session)).toBe('dual')
    expect(isScreenOnline(session)).toBe(true)
    expect(isCameraOnline(session)).toBe(true)
  })
})

describe('slideSeedFromFolder', () => {
  it('requires both course and session ids', () => {
    expect(slideSeedFromFolder({
      name: 'slides_Course__c12s34',
      path: '/out/slides_Course__c12s34',
    })).toMatchObject({ courseId: '12', sessionId: '34' })
    expect(slideSeedFromFolder({
      name: 'slides_Live__c12l99',
      path: '/out/slides_Live__c12l99',
    })).toBeNull()
    expect(slideSeedFromFolder({
      name: 'slides_Legacy',
      path: '/out/slides_Legacy',
    })).toBeNull()
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

  it('treats a no-file session with both URLs as fully online dual', () => {
    const session: LibrarySession = {
      ...base,
      mainUrl: 'https://cdn.example/main.m3u8',
      vgaUrl: 'https://cdn.example/vga.m3u8',
    }
    expect(hybridOnlineKind(session)).toBeNull()
    expect(canHybridDual(session)).toBe(false)
    expect(canPlayScreen(session)).toBe(true)
    expect(canPlayCamera(session)).toBe(true)
    expect(canShowDual(session)).toBe(true)
    expect(isScreenOnline(session)).toBe(true)
    expect(isCameraOnline(session)).toBe(true)
    expect(sessionHasLocalVideo(session)).toBe(false)
    expect(defaultStreamMode(session)).toBe('dual')
  })
})
