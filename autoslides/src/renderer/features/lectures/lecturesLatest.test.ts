import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
  await nextTick()
}

const holder = vi.hoisted(() => ({ store: null as null | { outputDirectory: string } }))
const config = vi.hoisted(() => ({ outputDirectory: '/a' }))
const scans: Array<Deferred<Array<{ name: string; path: string; size: number; mtimeMs: number }>>> = []
const folderCalls: Array<Deferred<Array<{ name: string; path: string }>>> = []
const timelines = new Map<string, Deferred<unknown>>()
const metaCalls: Array<{ ids: string[]; answer: Deferred<Map<string, unknown>> }> = []

vi.mock('@shared/services/configStore', async () => {
  const { reactive } = await import('vue')
  const store = reactive(config)
  holder.store = store
  return { configStore: store }
})
vi.mock('@shared/overrideRegistry', () => ({ overrides: {} }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))
vi.mock('@shared/services/slideVideoQueue', () => ({ SlideVideoQueue: {} }))
vi.mock('@shared/services/slideTimelineClient', () => ({
  getTimeline: (folder: string) => {
    const answer = timelines.get(folder) ?? deferred<unknown>()
    timelines.set(folder, answer)
    return answer.promise
  },
}))
vi.mock('./lectureCourseMetaCache', () => ({
  hydrateCourseMetas: (ids: string[]) => {
    const answer = deferred<Map<string, unknown>>()
    metaCalls.push({ ids, answer })
    return answer.promise
  },
}))

vi.stubGlobal('window', {
  electronAPI: {
    lectures: {
      listVideos: () => {
        const scan = deferred<Array<{ name: string; path: string; size: number; mtimeMs: number }>>()
        scans.push(scan)
        return scan.promise
      },
    },
    pdfmaker: {
      getFolders: () => {
        const call = deferred<Array<{ name: string; path: string }>>()
        folderCalls.push(call)
        return call.promise
      },
      getImageAsBase64: async () => null,
    },
  },
})

import { useLecturesPage, type LectureVideoItem } from './useLecturesPage'
import { useLectureLibrary } from './useLectureLibrary'
import { useLectureSlideChapters } from './useLectureSlideChapters'

const file = (name: string) => ({ name, path: `/x/${name}`, size: 1, mtimeMs: 1 })
const folder = (courseId: string, sessionId: string) => {
  const name = `slides_课程_第1周__c${courseId}s${sessionId}`
  return { name, path: `/out/${name}` }
}
const timeline = (file: string) => ({
  version: 1,
  extractor: 'builtin',
  createdAt: '',
  updatedAt: '',
  events: [{ id: 'evt_1', changeAt: 0, confirmedAt: 1, initialFile: file }],
  resolutions: { evt_1: { state: 'canonical', file } },
})

// Each test's watchers end with it, so a folder change reaches one page only.
let scope: EffectScope
const scoped = <T>(build: () => T): T => scope.run(build) as T
afterEach(() => scope.stop())

beforeEach(() => {
  scope = effectScope()
  scans.length = 0
  folderCalls.length = 0
  metaCalls.length = 0
  timelines.clear()
  holder.store!.outputDirectory = '/a'
})

describe('the Lectures file scan', () => {
  it('selects a session without selecting other sessions', async () => {
    const page = scoped(() => useLecturesPage())
    const screen = file('screen_test__c101s201.mp4')
    const subtitle = file('screen_test__c101s201.srt')
    const later = file('screen_test__c101s202.mp4')
    const scan = page.loadVideos()
    scans[0].resolve([later, subtitle, screen])
    await scan

    const [course] = page.groups.value
    const session = course.sections.find((section) => section.session?.id === '201')!
    page.toggleSelectMode()
    page.selectGroup(session.paths)
    expect(page.selectedPaths.value).toEqual([screen.path, subtitle.path])

    page.selectGroup(course.paths)
    expect(page.selectedPaths.value).toEqual([screen.path, subtitle.path, later.path])
    page.selectGroup(session.paths)
    expect(page.selectedPaths.value).toEqual([later.path])
  })

  it('keeps the newest scan when the older one answers last', async () => {
    const page = scoped(() => useLecturesPage())
    const first = page.loadVideos()
    const second = page.loadVideos()
    scans[1].resolve([file('new.mp4')])
    await second
    expect(page.isLoading.value).toBe(false)
    scans[0].resolve([file('old.mp4')])
    await first
    expect(page.videos.value.map((v) => v.name)).toEqual(['new.mp4'])
  })

  it('ignores an older scan that fails after a newer one succeeded', async () => {
    const page = scoped(() => useLecturesPage())
    const first = page.loadVideos()
    const second = page.loadVideos()
    scans[1].resolve([file('new.mp4')])
    await second
    scans[0].reject(new Error('gone'))
    await first
    expect(page.loadError.value).toBeNull()
    expect(page.videos.value.map((v) => v.name)).toEqual(['new.mp4'])
  })

  it('keeps the spinner until the newest scan ends, and drops the selection with the folder', async () => {
    const page = scoped(() => useLecturesPage())
    const first = page.loadVideos()
    page.selectedPaths.value = ['/a/one.mp4']
    holder.store!.outputDirectory = '/b'
    await nextTick()
    expect(page.selectedPaths.value).toEqual([])
    expect(scans).toHaveLength(2)
    scans[0].resolve([file('a.mp4')])
    await first
    expect(page.isLoading.value).toBe(true)
    expect(page.videos.value).toEqual([])
    scans[1].resolve([file('b.mp4')])
    await settle()
    expect(page.videos.value.map((v) => v.name)).toEqual(['b.mp4'])
    expect(page.isLoading.value).toBe(false)
  })
})

describe('the Lectures library', () => {
  it('lets only the newest run write seeds and progress', async () => {
    const videos = ref<LectureVideoItem[]>([])
    const library = useLectureLibrary(videos, ref([]))
    const first = library.hydrate()
    const second = library.hydrate()
    const old = folder('850101', '70101')
    const fresh = folder('850102', '70102')
    timelines.set(old.path, deferred())
    timelines.set(fresh.path, deferred())
    timelines.get(old.path)!.resolve(timeline('a.png'))
    timelines.get(fresh.path)!.resolve(timeline('b.png'))

    folderCalls[1].resolve([fresh])
    await settle()
    expect(metaCalls.map((c) => c.ids)).toEqual([['850102']])
    folderCalls[0].resolve([old])
    await first
    // The older run stops after its discovery: it neither replaces the seeds
    // nor asks for titles nor ends the newer run's progress.
    expect(metaCalls).toHaveLength(1)
    expect(library.courses.value.map((c) => c.courseId)).toEqual(['850102'])
    expect(library.isHydrating.value).toBe(true)
    metaCalls[0].answer.resolve(new Map())
    await second
    expect(library.isHydrating.value).toBe(false)
    expect(library.isDiscoveringSlides.value).toBe(false)
  })
})

describe('slide chapters in the local player', () => {
  it('never shows the previous lecture’s slides under the next one', async () => {
    const courseId = ref('850101')
    const sessionId = ref('70101')
    const chapters = useLectureSlideChapters(courseId, sessionId, ref(0), ref(100))
    const a = folder('850101', '70101')
    const b = folder('850101', '70102')
    folderCalls[0].resolve([a, b])
    await settle()
    // A's timeline is still on its way when the player moves to B.
    sessionId.value = '70102'
    await nextTick()
    expect(chapters.folderPath.value).toBeNull()
    folderCalls[1].resolve([a, b])
    await settle()
    timelines.get(b.path)!.resolve(timeline('b.png'))
    await settle()
    timelines.get(a.path)!.resolve(timeline('a.png'))
    await settle()
    expect(chapters.folderPath.value).toBe(b.path)
    expect(chapters.chapters.value.map((c) => c.file)).toEqual(['b.png'])
    expect(chapters.loading.value).toBe(false)
  })

  it('puts an Extractor 2.1.0 timeline on the player clock', async () => {
    const chapters = useLectureSlideChapters(ref('850101'), ref('70101'), ref(0), ref(100))
    const a = folder('850101', '70101')
    folderCalls[0].resolve([a])
    await settle()
    timelines.get(a.path)!.resolve({
      ...timeline('a.png'),
      extractor: 'qt',
      source: { path: '/x/screen.mp4', startTime: 1.5 },
      events: [{ id: 'evt_1', changeAt: 11.5, confirmedAt: 12.5, initialFile: 'a.png' }],
    })
    await settle()
    expect(chapters.chapters.value.map((c) => c.startTime)).toEqual([10])
  })

  it('clears at once on a change and ignores a late failure', async () => {
    const sessionId = ref('70101')
    const chapters = useLectureSlideChapters(ref('850101'), sessionId, ref(0), ref(100))
    const a = folder('850101', '70101')
    folderCalls[0].resolve([a])
    await settle()
    timelines.get(a.path)!.resolve(timeline('a.png'))
    await settle()
    expect(chapters.chapters.value).toHaveLength(1)

    const reload = chapters.loadChapters()
    sessionId.value = '70102'
    await nextTick()
    expect(chapters.chapters.value).toEqual([])
    const b = folder('850101', '70102')
    folderCalls[2].resolve([b])
    await settle()
    timelines.get(b.path)!.resolve(timeline('b.png'))
    await settle()
    folderCalls[1].reject(new Error('late'))
    await reload
    expect(chapters.chapters.value.map((c) => c.file)).toEqual(['b.png'])
    expect(chapters.folderPath.value).toBe(b.path)
  })
})
