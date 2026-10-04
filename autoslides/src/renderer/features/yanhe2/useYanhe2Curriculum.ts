/**
 * Yanhe 2.0 → Curriculum page state.
 *
 * The signed-in account's enrolled courses, then one course's sessions in the
 * same page (the way Recorded opens its sessions list). Two reads in main; the
 * JWT never comes here.
 *
 * The host passes the account badge and whether its Yanhe 2.0 session is live,
 * so this domain needs nothing from `features/platform`.
 */
import { ref, watch, type Ref } from 'vue'
import type { Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2Course } from '@common/yanhe2Curriculum'
import { createLogger } from '@shared/utils/logger'
import { yanhe2Reads } from './yanhe2Reads'

const log = createLogger('Yanhe2Curriculum')

/** Why the current view has nothing to show. `signed_out` is handled by the host's session state. */
export type Yanhe2CurriculumProblem = 'network' | 'failed'

export function useYanhe2Curriculum(options: {
  /** Signed-in account's student id, '' when there is none. */
  badge: Ref<string>
  /** That account has a live Yanhe 2.0 session. */
  signedIn: Ref<boolean>
  /** The Curriculum page is the one on screen. */
  active: Ref<boolean>
}) {
  const { badge, signedIn, active } = options

  // ---- Enrolled courses ----------------------------------------------------
  const courses = ref<Yanhe2Course[]>([])
  const coursesLoading = ref(false)
  const coursesProblem = ref<Yanhe2CurriculumProblem | null>(null)
  /** True once the list on screen is a real answer, so "no courses" is not shown before one. */
  const coursesLoaded = ref(false)
  /** Account the list on screen belongs to. */
  let coursesKey = ''
  let coursesTicket = 0

  // ---- One course's sessions -----------------------------------------------
  /** The course whose sessions are showing; null on the course grid. */
  const selected = ref<Yanhe2Course | null>(null)
  const sessions = ref<Yanhe2CalendarSession[]>([])
  const sessionsLoading = ref(false)
  const sessionsProblem = ref<Yanhe2CurriculumProblem | null>(null)
  const sessionsLoaded = ref(false)
  /** `account|courseId` the sessions on screen belong to. */
  let sessionsKey = ''
  let sessionsTicket = 0

  async function loadCourses(): Promise<void> {
    const account = badge.value
    if (!account || !signedIn.value) return
    const ticket = ++coursesTicket
    // A revisit refreshes what is on screen in place; another account starts clean.
    if (account !== coursesKey) {
      courses.value = []
      coursesLoaded.value = false
    }
    coursesLoading.value = true
    coursesProblem.value = null
    try {
      const result = await yanhe2Reads.myCourses(account)
      if (ticket !== coursesTicket) return
      if (result.kind === 'ok') {
        courses.value = result.data
        coursesLoaded.value = true
        coursesKey = account
      } else if (result.kind !== 'signed_out') {
        coursesProblem.value = result.kind
      }
    } catch (error) {
      log.warn('Course list failed:', error)
      if (ticket === coursesTicket) coursesProblem.value = 'failed'
    } finally {
      if (ticket === coursesTicket) coursesLoading.value = false
    }
  }

  async function loadSessions(): Promise<void> {
    const account = badge.value
    const course = selected.value
    if (!account || !signedIn.value || !course) return
    const key = `${account}|${course.courseId}`
    const ticket = ++sessionsTicket
    if (key !== sessionsKey) {
      sessions.value = []
      sessionsLoaded.value = false
    }
    sessionsLoading.value = true
    sessionsProblem.value = null
    try {
      const result = await yanhe2Reads.courseDetail(account, course.courseId)
      if (ticket !== sessionsTicket) return
      if (result.kind === 'ok') {
        sessions.value = result.data.sessions
        sessionsLoaded.value = true
        sessionsKey = key
      } else if (result.kind !== 'signed_out') {
        sessionsProblem.value = result.kind
      }
    } catch (error) {
      log.warn('Course detail failed:', error)
      if (ticket === sessionsTicket) sessionsProblem.value = 'failed'
    } finally {
      if (ticket === sessionsTicket) sessionsLoading.value = false
    }
  }

  const refresh = (): Promise<void> => (selected.value ? loadSessions() : loadCourses())

  function openCourse(course: Yanhe2Course): void {
    // A plain copy: the row is replaced by the next list refresh.
    selected.value = { ...course }
    void loadSessions()
  }

  function backToCourses(): void {
    sessionsTicket++
    selected.value = null
    sessionsLoading.value = false
    sessionsProblem.value = null
    if (active.value) void loadCourses()
  }

  // Opening the page, a sign-in or an account switch each reload the view on
  // screen. Nothing is fetched while the page is hidden.
  watch(
    [active, signedIn, badge],
    ([isActive, isSignedIn, account], previous) => {
      // Another account's courses are not this one's: back to the grid.
      if (previous && account !== previous[2]) {
        sessionsTicket++
        selected.value = null
        sessions.value = []
        sessionsKey = ''
        sessionsLoaded.value = false
        sessionsLoading.value = false
        sessionsProblem.value = null
      }
      if (!isSignedIn) {
        coursesTicket++
        sessionsTicket++
        courses.value = []
        sessions.value = []
        coursesKey = ''
        sessionsKey = ''
        coursesLoaded.value = false
        sessionsLoaded.value = false
        coursesLoading.value = false
        sessionsLoading.value = false
        return
      }
      if (isActive) void refresh()
    },
    { immediate: true },
  )

  return {
    courses,
    coursesLoading,
    coursesProblem,
    coursesLoaded,
    selected,
    sessions,
    sessionsLoading,
    sessionsProblem,
    sessionsLoaded,
    refresh,
    openCourse,
    backToCourses,
  }
}
