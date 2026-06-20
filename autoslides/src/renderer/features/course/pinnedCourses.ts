import { computed } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { openCourse } from './courseSelection'
import { navigationStore } from './navigationStore'
import type { Course } from './useCourseList'
import type { PinnedCourse } from '@common/types'

// Pinned recorded courses persist in config (configStore mirrors AppConfig and
// is re-broadcast after every config:setPinnedRecordedCourses, so this computed
// never goes stale). We store { id, title }: id drives navigation/session
// loading, title is the sidebar label.
export const pinnedRecordedCourses = computed<PinnedCourse[]>(
  () => overrides.pinnedRecordedCourses
    ? overrides.pinnedRecordedCourses()
    : (configStore.pinnedRecordedCourses ?? []))

export const isPinned = (id: string): boolean =>
  pinnedRecordedCourses.value.some(c => c.id === id)

// configStore entries are Vue reactive proxies, which structured-clone (and so
// ipcRenderer.invoke) cannot serialize. Always rebuild plain objects before
// sending across IPC.
const toPlain = (courses: PinnedCourse[]): PinnedCourse[] =>
  courses.map(c => ({ id: c.id, title: c.title }))

export const togglePinnedCourse = (course: { id: string; title: string }): void => {
  if (!course.id) return
  const current = pinnedRecordedCourses.value
  const next = current.some(c => c.id === course.id)
    ? current.filter(c => c.id !== course.id)
    : [...current, course]
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
  openCourse('recorded', { id: c.id, title: c.title, instructor: '', time: '' } as Course)
  navigationStore.setActivePinned(c.id)
}
