import { computed } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { openCourse } from './courseSelection'
import { navigationStore } from './navigationStore'
import type { Course } from './useCourseList'
import type { PinnedCourse } from '@common/types'

// Pinned recorded courses persist in config (configStore mirrors AppConfig and
// is re-broadcast after every config:setPinnedRecordedCourses, so this computed
// never goes stale). We capture the full course context at pin time (see
// PinnedCourse) so opening a pin restores classrooms/participants/term without a
// network hop. getCourseInfo still cannot supply those list-only fields; when a
// pin is thin (legacy id+title, or pinned from a cold open), session load can
// recover them via `lookupCourseById` and call `upgradePinnedCourse`.
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

export const togglePinnedCourse = (course: PinnedCourse): void => {
  if (!course.id) return
  const current = pinnedRecordedCourses.value
  const next = current.some(c => String(c.id) === String(course.id))
    ? current.filter(c => String(c.id) !== String(course.id))
    : [...current, course]
  window.electronAPI.config.setPinnedRecordedCourses(toPlain(next))
}

/**
 * Rewrite a pin's stored snapshot with richer list fields (classrooms etc.)
 * recovered via `lookupCourseById`. No-op when the id is not pinned. Self-heals
 * legacy thin pins without requiring the user to re-pin from Search.
 */
export const upgradePinnedCourse = (course: PinnedCourse | Course): void => {
  if (!course.id) return
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
  window.electronAPI.config.setPinnedRecordedCourses(toPlain(next))
}

export const removePinnedCourse = (id: string): void => {
  window.electronAPI.config.setPinnedRecordedCourses(
    toPlain(pinnedRecordedCourses.value.filter(c => c.id !== id)))
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
