import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const calls = {
  live: [] as Array<{ token: string; answer: Deferred<unknown> }>,
  recorded: [] as Array<{ token: string; answer: Deferred<unknown> }>,
}
let token = ''

vi.mock('@shared/services/apiClient', () => ({
  ApiClient: class {
    getPersonalLiveList(t: string) {
      const answer = deferred<unknown>()
      calls.live.push({ token: t, answer })
      return answer.promise
    }
    getPersonalCourseList(t: string) {
      const answer = deferred<unknown>()
      calls.recorded.push({ token: t, answer })
      return answer.promise
    }
  },
}))
vi.mock('@shared/services/authService', () => ({ tokenManager: { getToken: () => token } }))
vi.mock('./useCourseList', () => ({
  transformLiveStreamToCourse: (row: { id: string }) => ({ id: row.id }),
  transformCourseDataToCourse: (row: { id: string }) => ({ id: row.id }),
}))
vi.mock('./liveCourseTitles', () => ({ hydrateLiveTitles: async () => {} }))
vi.mock('@shared/i18n', () => ({ getCurrentLocale: () => 'en' }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { useHomePage } from './useHomePage'

const rows = (...ids: string[]) => ({ data: ids.map((id) => ({ id })) })
const ids = (list: Array<{ id: string }>) => list.map((c) => c.id)

beforeEach(() => {
  calls.live.length = 0
  calls.recorded.length = 0
})

describe('Home rows across an account switch', () => {
  // What HomePage.vue does when the account changes.
  const switchTo = (home: ReturnType<typeof useHomePage>, next: string) => {
    token = next
    home.clearPersonalRows()
    return home.loadPersonalRows()
  }

  it("keeps the new account's rows when the old account's answer arrives last", async () => {
    const home = useHomePage()
    token = 'A'
    const loadA = home.loadPersonalRows()
    const loadB = switchTo(home, 'B')

    calls.live[1].answer.resolve(rows('b-live'))
    calls.recorded[1].answer.resolve(rows('b-rec'))
    await loadB
    calls.live[0].answer.resolve(rows('a-live'))
    calls.recorded[0].answer.resolve(rows('a-rec'))
    await loadA

    expect(calls.live.map((c) => c.token)).toEqual(['A', 'B'])
    expect(ids(home.liveStreams.value)).toEqual(['b-live'])
    expect(ids(home.recordings.value)).toEqual(['b-rec'])
  })

  it("does not show the old account's failure or end the new account's spinner", async () => {
    const home = useHomePage()
    token = 'A'
    const loadA = home.loadPersonalRows()
    const loadB = switchTo(home, 'B')

    calls.live[0].answer.reject(new Error('A failed'))
    calls.recorded[0].answer.reject(new Error('A failed'))
    await loadA
    expect(home.liveError.value).toBe('')
    expect(home.recordedError.value).toBe('')
    expect(home.isLoadingLive.value).toBe(true)
    expect(home.isLoadingRecorded.value).toBe(true)

    calls.live[1].answer.resolve(rows('b-live'))
    calls.recorded[1].answer.resolve(rows())
    await loadB
    expect(home.isLoadingLive.value).toBe(false)
    expect(home.isLoadingRecorded.value).toBe(false)
    expect(ids(home.liveStreams.value)).toEqual(['b-live'])
  })

  it('stays empty after signing out, whatever arrives later', async () => {
    const home = useHomePage()
    token = 'A'
    const loadA = home.loadPersonalRows()
    token = ''
    home.clearPersonalRows()
    expect(home.isLoadingLive.value).toBe(false)

    calls.live[0].answer.resolve(rows('a-live'))
    calls.recorded[0].answer.resolve(rows('a-rec'))
    await loadA
    expect(home.liveStreams.value).toEqual([])
    expect(home.recordings.value).toEqual([])
  })

  it('takes the last of A, B, A whatever the order of the answers', async () => {
    const home = useHomePage()
    token = 'A'
    const first = home.loadPersonalRows()
    const second = switchTo(home, 'B')
    const third = switchTo(home, 'A')

    calls.live[2].answer.resolve(rows('a2-live'))
    calls.recorded[2].answer.resolve(rows('a2-rec'))
    calls.live[1].answer.resolve(rows('b-live'))
    calls.recorded[1].answer.resolve(rows('b-rec'))
    calls.live[0].answer.resolve(rows('a1-live'))
    calls.recorded[0].answer.resolve(rows('a1-rec'))
    await Promise.all([first, second, third])

    expect(ids(home.liveStreams.value)).toEqual(['a2-live'])
    expect(ids(home.recordings.value)).toEqual(['a2-rec'])
  })
})
