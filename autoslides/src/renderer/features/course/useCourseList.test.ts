import { nextTick, ref } from 'vue'
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

const live: Array<{ token: string; page: number; answer: Deferred<unknown> }> = []
let token = ''

vi.mock('@shared/services/apiClient', () => ({
  ApiClient: class {
    getPersonalLiveList(t: string, page: number) {
      const answer = deferred<unknown>()
      live.push({ token: t, page, answer })
      return answer.promise
    }
  },
}))
vi.mock('@shared/services/authService', () => ({ tokenManager: { getToken: () => token } }))
vi.mock('./courseNumber', () => ({ courseNumberOf: () => undefined }))
vi.mock('./courseSelection', () => ({ openCourse: () => {} }))
vi.mock('./liveCourseTitles', () => ({ hydrateLiveTitles: async () => {} }))
vi.mock('./enrolledCourses', () => ({ enrolledCoursesOf: () => [], refreshEnrolledCourses: async () => ({ kind: 'ok' }) }))
vi.mock('@shared/services/runtimeEnv', () => ({ isDemoMode: () => false }))
vi.mock('@shared/i18n', () => ({ getCurrentLocale: () => 'en', localeTag: () => 'en-US' }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }))

import { useCourseList } from './useCourseList'

const page = (...ids: string[]) => ({
  data: ids.map((id) => ({ id, title: id, status: 1, course_id: id })),
  last_page: 1,
  current_page: 1,
})
const ids = (list: Array<{ id: string }>) => list.map((c) => String(c.id))

beforeEach(() => {
  live.length = 0
})

describe('the Live grid across an account switch', () => {
  const setup = () => {
    const owner = ref('A')
    token = 'A'
    const list = useCourseList({ mode: ref('live'), t: (key) => key, owner })
    const switchTo = async (next: string) => {
      token = next
      owner.value = next
      await nextTick()
      // What CoursePage.vue's account watcher does. Wrapped, so awaiting the
      // switch does not wait for the load.
      return { done: list.fetchPersonalCourses() }
    }
    return { list, switchTo }
  }

  it('asks again for the new account while the old load is still running', async () => {
    const { list, switchTo } = setup()
    const loadA = list.fetchPersonalCourses()
    const { done: loadB } = await switchTo('B')
    expect(live.map((c) => c.token)).toEqual(['A', 'B'])

    live[0].answer.resolve(page('a1'))
    await loadA
    expect(list.courses.value).toEqual([])
    expect(list.isLoading.value).toBe(true)

    live[1].answer.resolve(page('b1'))
    await loadB
    expect(ids(list.courses.value)).toEqual(['b1'])
    expect(list.isLoading.value).toBe(false)
  })

  it("drops the old account's rows and failure when they arrive last", async () => {
    const { list, switchTo } = setup()
    const loadA = list.fetchPersonalCourses()
    const { done: loadB } = await switchTo('B')
    live[1].answer.resolve(page('b1'))
    await loadB
    live[0].answer.reject(new Error('A failed'))
    await loadA
    expect(ids(list.courses.value)).toEqual(['b1'])
    expect(list.errorMessage.value).toBe('')
  })

  it('joins a repeat of the load that is running instead of asking twice', async () => {
    const { list } = setup()
    const first = list.fetchPersonalCourses()
    const second = list.fetchPersonalCourses()
    expect(live).toHaveLength(1)
    live[0].answer.resolve(page('a1'))
    await Promise.all([first, second])
    expect(ids(list.courses.value)).toEqual(['a1'])

    // Once it has ended, the same request is a new load.
    void list.fetchPersonalCourses()
    expect(live).toHaveLength(2)
  })

  it('ends up on the last account of A, B, A', async () => {
    const { list, switchTo } = setup()
    const first = list.fetchPersonalCourses()
    const { done: second } = await switchTo('B')
    const { done: third } = await switchTo('A')
    live[2].answer.resolve(page('a2'))
    live[0].answer.resolve(page('a1'))
    live[1].answer.resolve(page('b1'))
    await Promise.all([first, second, third])
    expect(ids(list.courses.value)).toEqual(['a2'])
  })
})
