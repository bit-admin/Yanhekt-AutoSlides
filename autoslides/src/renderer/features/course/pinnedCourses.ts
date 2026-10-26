import { computed, ref } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { isDemoMode } from '@shared/services/runtimeEnv'
import { createLogger } from '@shared/utils/logger'
import { belongsTo, yanhe2PinKey, yanhektIdOf, type PinRequest } from '@common/pins'
import type { PinnedCourse } from '@common/types'
import type { Yanhe2Course } from '@common/yanhe2Curriculum'
import { openCourse } from './courseSelection'
import { navigationStore } from './navigationStore'
import type { Course } from './useCourseList'

const log = createLogger('pinnedCourses')

// Pinned courses live in config and main is their only writer: it syncs them
// with Yanhekt subscriptions (current term) and Yanhe 2.0 bookmarks (every
// term), and broadcasts config after each change, so this computed never goes
// stale. A pin is one course on either site or both (`@common/pins`); its
// snapshot (classrooms, participants, term) lets it open without a network hop.
// The stored list holds every saved account's pins; this shows the current one's.

// The signed-in account's badge, set by each sync (launch, sign-in, account
// switch). Before the first sync, the most recently used saved account.
const syncedOwner = ref<string | null>(null)

const currentOwner = (): string | null => {
  if (syncedOwner.value) return syncedOwner.value
  const accounts = configStore.accounts ?? []
  let latest: (typeof accounts)[number] | null = null
  for (const a of accounts) if (!latest || a.lastUsedAt > latest.lastUsedAt) latest = a
  return latest?.badge ?? null
}

export const pinnedRecordedCourses = computed<PinnedCourse[]>(() => {
  if (overrides.pinnedRecordedCourses) return overrides.pinnedRecordedCourses()
  const owner = currentOwner()
  return (configStore.pinnedRecordedCourses ?? []).filter(p => belongsTo(p, owner))
})

/** Whether the Yanhekt course is pinned. */
export const isPinned = (id: string): boolean =>
  pinnedRecordedCourses.value.some(c => yanhektIdOf(c) === String(id))

/** Whether the Yanhe 2.0 course is pinned (as itself or through its Yanhekt twin). */
export const isYanhe2Pinned = (yanhe2Id: string): boolean =>
  pinnedRecordedCourses.value.some(c => c.yanhe2Id === yanhe2Id || c.id === yanhe2PinKey(yanhe2Id))

// Demo mode owns the list through the override and never reaches main.
const skip = (): boolean => !!overrides.pinnedRecordedCourses || isDemoMode()

// Built field by field: configStore entries and course refs are Vue proxies,
// which cannot cross IPC (Recurring #1).
const requestOf = (course: PinnedCourse | Course): PinRequest => ({
  id: yanhektIdOf({ id: String(course.id ?? '') }),
  yanhe2Id: 'yanhe2Id' in course ? course.yanhe2Id : undefined,
  title: course.title,
  titleEn: course.titleEn,
  number: course.number,
  instructor: course.instructor,
  time: course.time,
  classrooms: course.classrooms?.map(r => ({ name: r.name })),
  participant_count: course.participant_count,
  college_name: course.college_name,
  professors: course.professors ? [...course.professors] : undefined,
  school_year: course.school_year != null ? String(course.school_year) : undefined,
  semester: course.semester != null ? String(course.semester) : undefined,
  imageUrl: course.imageUrl,
})

const yanhe2RequestOf = (course: Yanhe2Course): PinRequest => ({
  id: '',
  yanhe2Id: course.courseId,
  title: course.title,
  number: course.courseCode || undefined,
  instructor: course.teacher || undefined,
  professors: course.teacher ? [course.teacher] : undefined,
  college_name: course.college || undefined,
  school_year: course.schoolYear || undefined,
  semester: course.semester || undefined,
})

/**
 * Sync the account's pins with both sites. Called after login / token verify /
 * account switch with that account's badge. Soft-fails offline.
 */
export async function syncPinnedCoursesFromServer(owner: string): Promise<void> {
  if (owner) syncedOwner.value = owner
  if (skip() || !owner) return
  try {
    await window.electronAPI.pins.sync(owner)
  } catch (error) {
    log.warn('Pin sync failed; keeping local pins:', error)
  }
}

const toggle = async (request: PinRequest): Promise<void> => {
  if (skip()) return
  try {
    await window.electronAPI.pins.toggle(currentOwner() ?? '', request)
  } catch (error) {
    log.warn('Pin toggle failed:', error)
  }
}

/** Pin or unpin a Yanhekt course (Recorded sessions page). */
export const togglePinnedCourse = async (course: PinnedCourse | Course): Promise<void> => {
  if (!course.id) return
  await toggle(requestOf(course))
}

/** Pin or unpin a Yanhe 2.0 course (Curriculum sessions page). */
export const toggleYanhe2Pin = async (course: Yanhe2Course): Promise<void> => {
  if (!course.courseId) return
  await toggle(yanhe2RequestOf(course))
}

/**
 * Fill a pin's stored snapshot with richer fields from an opened course
 * (classrooms, registrar number, term). No-op when it is not pinned or nothing
 * changed. Self-heals thin pins without re-pinning.
 */
export const upgradePinnedCourse = (course: PinnedCourse | Course): void => {
  if (!course.id || skip()) return
  if (!isPinned(String(course.id))) return
  window.electronAPI.pins.upgrade(currentOwner() ?? '', requestOf(course)).catch((error: unknown) => {
    log.warn('Pin upgrade failed:', error)
  })
}

/** Unpin by the pin's key (sidebar and Home). */
export const removePinnedCourse = async (key: string): Promise<void> => {
  if (!key || skip()) return
  try {
    await window.electronAPI.pins.remove(currentOwner() ?? '', key)
  } catch (error) {
    log.warn('Unpin failed:', error)
  }
}

// Open a Yanhekt pin's sessions page (the session page reloads from the id;
// detail fields render via v-if so blanks are harmless) and highlight the
// sidebar pinned item instead of the "Recorded" navigator entry. A pin only
// Yanhe 2.0 has opens on its Curriculum page instead (`components/course/openPin.ts`).
export const openPinnedCourse = (c: PinnedCourse): void => {
  openCourse('recorded', {
    id: yanhektIdOf(c),
    title: c.title,
    titleEn: c.titleEn,
    number: c.number,
    instructor: c.instructor ?? '',
    time: c.time ?? '',
    classrooms: c.classrooms,
    participant_count: c.participant_count,
    college_name: c.college_name,
    professors: c.professors,
    school_year: c.school_year,
    semester: c.semester,
    imageUrl: c.imageUrl,
  } as Course)
  navigationStore.setActivePinned(c.id)
}
