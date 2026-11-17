import { nextTick } from 'vue'
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

const calls: Array<{ token: string; keyword: string; answer: Deferred<unknown> }> = []
let token: string | null = 'A'

vi.mock('@shared/services/apiClient', () => ({
  ApiClient: class {
    getAvailableSemesters() {
      return Promise.resolve([])
    }
    searchLiveList(t: string, keyword: string) {
      const answer = deferred<unknown>()
      calls.push({ token: t, keyword, answer })
      return answer.promise
    }
    getCourseList(t: string, query: { keyword: string }) {
      const answer = deferred<unknown>()
      calls.push({ token: t, keyword: query.keyword, answer })
      return answer.promise
    }
  },
}))
vi.mock('@shared/services/authService', () => ({ tokenManager: { getToken: () => token } }))
vi.mock('./navigationStore', () => ({ navigationStore: { activeNav: { value: 'search' }, navigate: () => {} } }))
vi.mock('./courseSelection', () => ({ openCourse: () => {} }))
vi.mock('./useCourseList', () => ({
  transformLiveStreamToCourse: (row: unknown) => row,
  transformCourseDataToCourse: (row: unknown) => row,
}))
vi.mock('./liveCourseTitles', () => ({ hydrateLiveTitles: async () => {} }))
vi.mock('./courseIndexSearch', () => ({ fillIndexCourses: async () => {}, indexRowToCourse: (row: unknown) => row }))
vi.mock('@shared/i18n', () => ({ getCurrentLocale: () => 'en' }))
vi.mock('@shared/services/configStore', () => ({
  configStore: { currentTermSearchSource: 'yanhekt', earlierTermSearchSource: 'index' },
}))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { useSearchPage } from './useSearchPage'

const page = (...ids: string[]) => ({ data: ids.map((id) => ({ id })), last_page: 1, current_page: 1 })
const ids = (list: Array<{ id: string | number }>) => list.map((c) => String(c.id))

// The search state is a module singleton: each test starts from live mode,
// an empty keyword and nothing in flight.
const search = useSearchPage()
beforeEach(async () => {
  vi.useFakeTimers()
  token = 'A'
  search.mode.value = 'live'
  search.keyword.value = ''
  await nextTick()
  await vi.runAllTimersAsync()
  for (const call of calls) call.answer.resolve(page())
  await vi.runAllTimersAsync()
  calls.length = 0
  search.results.value = []
})
afterEach(() => vi.useRealTimers())

describe('the Search page and answers that arrive late', () => {
  it('drops an answer for the previous keyword during the typing pause', async () => {
    search.keyword.value = 'a'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    expect(calls.map((c) => c.keyword)).toEqual(['a'])
    expect(search.isLoading.value).toBe(true)

    // Typed on: the replacement search has not started yet.
    search.keyword.value = 'ab'
    await nextTick()
    expect(search.isLoading.value).toBe(false)
    calls[0].answer.resolve(page('for-a'))
    await vi.advanceTimersByTimeAsync(0)
    expect(search.results.value).toEqual([])

    await vi.advanceTimersByTimeAsync(400)
    expect(calls.map((c) => c.keyword)).toEqual(['a', 'ab'])
    calls[1].answer.resolve(page('for-ab'))
    await vi.advanceTimersByTimeAsync(0)
    expect(ids(search.results.value)).toEqual(['for-ab'])
    expect(search.isLoading.value).toBe(false)
  })

  it('drops an answer once the mode is Yanhe 2.0 and leaves no spinner', async () => {
    const running = search.executeSearch()
    expect(search.isLoading.value).toBe(true)
    const switched = search.setMode('yanhe2')
    expect(search.isLoading.value).toBe(false)
    calls[0].answer.resolve(page('late'))
    await running
    await switched
    expect(search.results.value).toEqual([])
    expect(search.isLoading.value).toBe(false)
  })

  it('drops an answer and an error for an account that is no longer signed in', async () => {
    const first = search.executeSearch()
    token = 'B'
    calls[0].answer.resolve(page('for-A'))
    await first
    expect(search.results.value).toEqual([])
    expect(search.isLoading.value).toBe(false)

    token = 'A'
    const second = search.executeSearch()
    token = null
    calls[1].answer.reject(new Error('refused'))
    await second
    expect(search.errorMessage.value).toBe('')
    expect(search.isLoading.value).toBe(false)
  })

  it('lets only the newest of two overlapping searches write', async () => {
    const first = search.executeSearch()
    const second = search.executeSearch()
    calls[1].answer.resolve(page('new'))
    await second
    calls[0].answer.resolve(page('old'))
    await first
    expect(ids(search.results.value)).toEqual(['new'])
  })
})
