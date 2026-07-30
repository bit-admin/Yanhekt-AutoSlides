import { computed } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { ApiClient, type SubscriptionCourseRow } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { isDemoMode } from '@shared/services/runtimeEnv'
import { createLogger } from '@shared/utils/logger'
import { openCourse } from './courseSelection'
import { navigationStore } from './navigationStore'
import type { Course } from './useCourseList'
import type { PinnedCourse } from '@common/types'

const log = createLogger('pinnedCourses')
const apiClient = new ApiClient()

// Tracks in-flight pin/unpin per course so double-clicks don't race.
const inFlight = new Set<string>()
// One sync at a time (login + switch can otherwise overlap).
let syncInFlight: Promise<void> | null = null

const SUBSCRIPTION_PAGE_SIZE = 100
const MAX_SUBSCRIPTION_PAGES = 50

// Pinned recorded courses persist in config (configStore mirrors AppConfig and
// is re-broadcast after every config:setPinnedRecordedCourses, so this computed
// never goes stale). We capture the full course context at pin time (see
// PinnedCourse) so opening a pin restores classrooms/participants/term without a
// network hop. After Yanhekt subscription sync, snapshots come from the
// subscription list (which includes list-only fields). getCourseInfo still
// cannot supply those; thin legacy pins can still be healed via
// `lookupCourseById` + `upgradePinnedCourse`.
export const pinnedRecordedCourses = computed<PinnedCourse[]>(
  () => overrides.pinnedRecordedCourses
    ? overrides.pinnedRecordedCourses()
    : (configStore.pinnedRecordedCourses ?? []))

export const isPinned = (id: string): boolean =>
  pinnedRecordedCourses.value.some(c => String(c.id) === String(id))

// configStore entries are Vue reactive proxies, which structured-clone (and so
// ipcRenderer.invoke) cannot serialize. Always rebuild plain objects (deep for
// nested arrays) before sending across IPC.
const toPlain = (courses: PinnedCourse[]): PinnedCourse[] =>
  courses.map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    time: c.time,
    classrooms: c.classrooms?.map(r => ({ name: r.name })),
    participant_count: c.participant_count,
    college_name: c.college_name,
    professors: c.professors ? [...c.professors] : undefined,
    school_year: c.school_year,
    semester: c.semester,
  }))

const toPlainOne = (course: PinnedCourse | Course): PinnedCourse => ({
  id: String(course.id),
  title: course.title,
  instructor: course.instructor,
  time: course.time,
  classrooms: course.classrooms?.map(r => ({ name: r.name })),
  participant_count: course.participant_count,
  college_name: course.college_name,
  professors: course.professors ? [...course.professors] : undefined,
  school_year: course.school_year,
  semester: course.semester,
})

const persistPins = (courses: PinnedCourse[]): void => {
  window.electronAPI.config.setPinnedRecordedCourses(toPlain(courses))
}

function professorNamesFromRow(row: SubscriptionCourseRow): string[] {
  if (Array.isArray(row.professor_names) && row.professor_names.length) {
    return row.professor_names.map(String).map(s => s.trim()).filter(Boolean)
  }
  if (Array.isArray(row.professors)) {
    return row.professors
      .map(p => (typeof p === 'string' ? p : (p?.name ?? '')))
      .map(s => s.trim())
      .filter(Boolean)
  }
  return []
}

/** Map a Yanhekt subscription list row into a PinnedCourse snapshot. */
export function mapSubscriptionRowToPinnedCourse(row: SubscriptionCourseRow): PinnedCourse {
  const professors = professorNamesFromRow(row)
  return {
    id: String(row.id),
    title: row.name_zh ?? '',
    instructor: professors.length ? professors.join(', ') : undefined,
    classrooms: row.classrooms
      ?.map(c => ({ name: c.name }))
      .filter(c => !!c.name),
    participant_count: row.participant_count,
    college_name: row.college_name || row.college?.name,
    professors: professors.length ? professors : undefined,
    school_year: row.school_year != null ? String(row.school_year) : undefined,
    semester: row.semester != null ? String(row.semester) : undefined,
  }
}

async function fetchAllSubscriptionRows(token: string): Promise<SubscriptionCourseRow[]> {
  const rows: SubscriptionCourseRow[] = []
  for (let page = 1; page <= MAX_SUBSCRIPTION_PAGES; page++) {
    const result = await apiClient.getSubscriptionList(token, {
      page,
      pageSize: SUBSCRIPTION_PAGE_SIZE,
    })
    const pageRows = result?.data ?? []
    rows.push(...pageRows)
    const lastPage = Number(result?.last_page) || 1
    if (page >= lastPage) break
  }
  return rows
}

function shouldSkipNetwork(): boolean {
  return !!overrides.pinnedRecordedCourses || isDemoMode()
}

/**
 * Pull the Yanhekt subscription list into the local pin cache (replace).
 * Called after login / token verify / account switch. Soft-fails offline.
 */
export async function syncPinnedCoursesFromServer(): Promise<void> {
  if (shouldSkipNetwork()) return
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    const token = tokenManager.getToken()
    if (!token) return

    try {
      const rows = await fetchAllSubscriptionRows(token)
      persistPins(rows.map(mapSubscriptionRowToPinnedCourse))
    } catch (error) {
      // Keep last-known local pins on network/API failure.
      log.warn('Subscription sync failed; keeping local pins:', error)
    }
  })().finally(() => {
    syncInFlight = null
  })

  return syncInFlight
}

export const togglePinnedCourse = async (course: PinnedCourse | Course): Promise<void> => {
  if (!course.id) return

  // Demo override owns the list; mutate local config only if no override.
  if (overrides.pinnedRecordedCourses) return

  const id = String(course.id)
  if (inFlight.has(id)) return
  inFlight.add(id)

  const previous = toPlain(pinnedRecordedCourses.value)
  const isPin = !previous.some(c => String(c.id) === id)
  const next = isPin
    ? [...previous, toPlainOne(course)]
    : previous.filter(c => String(c.id) !== id)

  // Optimistic local write.
  persistPins(next)

  try {
    if (shouldSkipNetwork()) return
    const token = tokenManager.getToken()
    if (!token) return // offline / signed-out: keep local-only change
    if (isPin) {
      await apiClient.subscribeCourse(token, id)
    } else {
      await apiClient.unsubscribeCourse(token, id)
    }
  } catch (error) {
    log.warn('Pin toggle API failed; rolling back:', error)
    persistPins(previous)
  } finally {
    inFlight.delete(id)
  }
}

/**
 * Rewrite a pin's stored snapshot with richer list fields (classrooms etc.)
 * recovered via `lookupCourseById`. No-op when the id is not pinned. Self-heals
 * legacy thin pins without requiring the user to re-pin from Search.
 */
export const upgradePinnedCourse = (course: PinnedCourse | Course): void => {
  if (!course.id) return
  if (overrides.pinnedRecordedCourses) return
  const current = pinnedRecordedCourses.value
  const idx = current.findIndex(c => String(c.id) === String(course.id))
  if (idx === -1) return

  const existing = current[idx]
  const incoming = toPlainOne(course)
  const merged: PinnedCourse = {
    id: String(existing.id),
    title: incoming.title || existing.title,
    instructor: incoming.instructor || existing.instructor,
    time: incoming.time || existing.time,
    classrooms: incoming.classrooms?.length ? incoming.classrooms : existing.classrooms,
    participant_count: incoming.participant_count ?? existing.participant_count,
    college_name: incoming.college_name || existing.college_name,
    professors: incoming.professors?.length ? incoming.professors : existing.professors,
    school_year: incoming.school_year || existing.school_year,
    semester: incoming.semester || existing.semester,
  }

  const next = current.slice()
  next[idx] = merged
  persistPins(next)
}

export const removePinnedCourse = async (id: string): Promise<void> => {
  if (!id) return
  if (overrides.pinnedRecordedCourses) return

  const courseId = String(id)
  if (inFlight.has(courseId)) return
  inFlight.add(courseId)

  const previous = toPlain(pinnedRecordedCourses.value)
  const next = previous.filter(c => String(c.id) !== courseId)
  if (next.length === previous.length) {
    inFlight.delete(courseId)
    return
  }

  persistPins(next)

  try {
    if (shouldSkipNetwork()) return
    const token = tokenManager.getToken()
    if (!token) return
    await apiClient.unsubscribeCourse(token, courseId)
  } catch (error) {
    log.warn('Unpin API failed; rolling back:', error)
    persistPins(previous)
  } finally {
    inFlight.delete(courseId)
  }
}

// Open a pinned course's sessions page (the session page reloads from the id;
// detail fields render via v-if so blanks are harmless) and highlight the
// sidebar pinned item instead of the "Recorded" navigator entry. Shared by the
// sidebar pinned list and the Home page pinned cards.
export const openPinnedCourse = (c: PinnedCourse): void => {
  openCourse('recorded', {
    id: c.id,
    title: c.title,
    instructor: c.instructor ?? '',
    time: c.time ?? '',
    classrooms: c.classrooms,
    participant_count: c.participant_count,
    college_name: c.college_name,
    professors: c.professors,
    school_year: c.school_year,
    semester: c.semester,
  } as Course)
  navigationStore.setActivePinned(c.id)
}
