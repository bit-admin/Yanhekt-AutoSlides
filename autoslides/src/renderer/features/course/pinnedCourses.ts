import { computed, ref } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'
import { ApiClient, type SubscriptionCourseRow } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { isDemoMode } from '@shared/services/runtimeEnv'
import { createLogger } from '@shared/utils/logger'
import { termKeyOf } from '@common/searchSources'
import { openCourse } from './courseSelection'
import { navigationStore } from './navigationStore'
import { belongsTo, isEarlierTermPin, mergeSyncedPins } from './pinMerge'
import type { Course } from './useCourseList'
import type { PinnedCourse } from '@common/types'

const log = createLogger('pinnedCourses')
const apiClient = new ApiClient()

// Tracks in-flight pin/unpin per course so double-clicks don't race.
const inFlight = new Set<string>()
// One sync at a time (login + switch can otherwise overlap). A repeat for the
// same account joins it; another account's sync queues behind it.
let syncInFlight: Promise<void> | null = null
let syncInFlightOwner: string | null = null

const SUBSCRIPTION_PAGE_SIZE = 100
const MAX_SUBSCRIPTION_PAGES = 50

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

// Pinned recorded courses persist in config (configStore mirrors AppConfig and
// is re-broadcast after every config:setPinnedRecordedCourses, so this computed
// never goes stale). We capture the full course context at pin time (see
// PinnedCourse) so opening a pin restores classrooms/participants/term without a
// network hop. Current-term pins follow the Yanhekt subscription list; earlier-
// term pins stay local, because that list no longer returns them (`pinMerge.ts`).
// The stored list holds every saved account's pins; this shows the current one's.
export const pinnedRecordedCourses = computed<PinnedCourse[]>(() => {
  if (overrides.pinnedRecordedCourses) return overrides.pinnedRecordedCourses()
  const owner = currentOwner()
  return (configStore.pinnedRecordedCourses ?? []).filter(p => belongsTo(p, owner))
})

export const isPinned = (id: string): boolean =>
  pinnedRecordedCourses.value.some(c => String(c.id) === String(id))

/** Every stored pin, all accounts, as plain objects. */
const storedPins = (): PinnedCourse[] => toPlain(configStore.pinnedRecordedCourses ?? [])

/** The current term's key (`2026-2027-1`), or null when it cannot be read. */
async function currentTermKey(): Promise<string | null> {
  try {
    const [current] = await apiClient.getAvailableSemesters()
    return current ? termKeyOf(current.schoolYear, current.semester) : null
  } catch {
    return null
  }
}

// configStore entries are Vue reactive proxies, which structured-clone (and so
// ipcRenderer.invoke) cannot serialize. Always rebuild plain objects (deep for
// nested arrays) before sending across IPC.
const toPlain = (courses: PinnedCourse[]): PinnedCourse[] =>
  courses.map(c => ({
    id: c.id,
    title: c.title,
    titleEn: c.titleEn,
    number: c.number,
    instructor: c.instructor,
    time: c.time,
    classrooms: c.classrooms?.map(r => ({ name: r.name })),
    participant_count: c.participant_count,
    college_name: c.college_name,
    professors: c.professors ? [...c.professors] : undefined,
    school_year: c.school_year,
    semester: c.semester,
    imageUrl: c.imageUrl,
    owner: c.owner,
  }))

const toPlainOne =(course: PinnedCourse | Course): PinnedCourse => ({
  id: String(course.id),
  title: course.title,
  titleEn: course.titleEn,
  number: course.number,
  instructor: course.instructor,
  time: course.time,
  classrooms: course.classrooms?.map(r => ({ name: r.name })),
  participant_count: course.participant_count,
  college_name: course.college_name,
  professors: course.professors ? [...course.professors] : undefined,
  school_year: course.school_year,
  semester: course.semester,
  imageUrl: course.imageUrl,
})

const persistPins = (courses: PinnedCourse[]): Promise<void> =>
  window.electronAPI.config.setPinnedRecordedCourses(toPlain(courses))

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
  const imageUrl = (row.image_url || row.college?.image_url || '').trim() || undefined
  return {
    id: String(row.id),
    title: row.name_zh ?? '',
    titleEn: row.name_en,
    number: row.number != null && String(row.number).trim() !== '' ? String(row.number) : undefined,
    instructor: professors.length ? professors.join(', ') : undefined,
    classrooms: row.classrooms
      ?.map(c => ({ name: c.name }))
      .filter(c => !!c.name),
    participant_count: row.participant_count,
    college_name: row.college_name || row.college?.name,
    professors: professors.length ? professors : undefined,
    school_year: row.school_year != null ? String(row.school_year) : undefined,
    semester: row.semester != null ? String(row.semester) : undefined,
    imageUrl,
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
 * Pull the Yanhekt subscription list into the local pin cache for `owner` (the
 * signed-in account's badge). The list replaces this account's current-term
 * pins; its earlier-term pins stay (Yanhekt no longer returns them) and other
 * accounts' pins are left alone. Called after login / token verify / account
 * switch. Soft-fails offline.
 */
export async function syncPinnedCoursesFromServer(owner: string): Promise<void> {
  if (owner) syncedOwner.value = owner
  if (shouldSkipNetwork() || !owner) return
  if (syncInFlight && syncInFlightOwner === owner) return syncInFlight

  const prior = syncInFlight ?? Promise.resolve()
  const run: Promise<void> = prior.then(async () => {
    const token = tokenManager.getToken()
    if (!token || syncedOwner.value !== owner) return

    try {
      const [rows, currentTerm] = await Promise.all([
        fetchAllSubscriptionRows(token),
        currentTermKey(),
      ])
      // The account may have switched while this ran; its own sync follows.
      if (syncedOwner.value !== owner) return
      const serverPins = rows.map(mapSubscriptionRowToPinnedCourse)
      // Awaited so a queued sync reads the list this one wrote.
      await persistPins(mergeSyncedPins(storedPins(), serverPins, owner, currentTerm))
    } catch (error) {
      // Keep last-known local pins on network/API failure.
      log.warn('Subscription sync failed; keeping local pins:', error)
    }
  }).finally(() => {
    if (syncInFlight === run) {
      syncInFlight = null
      syncInFlightOwner = null
    }
  })
  syncInFlight = run
  syncInFlightOwner = owner
  return run
}

/** Whether a stored pin is the current account's pin of course `id`. */
const isOwnPin = (p: PinnedCourse, id: string, owner: string | null): boolean =>
  String(p.id) === id && belongsTo(p, owner)

export const togglePinnedCourse = async (course: PinnedCourse | Course): Promise<void> => {
  if (!course.id) return

  // Demo override owns the list; mutate local config only if no override.
  if (overrides.pinnedRecordedCourses) return

  const id = String(course.id)
  if (inFlight.has(id)) return
  inFlight.add(id)

  const owner = currentOwner()
  const previous = storedPins()
  const isPin = !previous.some(c => isOwnPin(c, id, owner))
  const next = isPin
    ? [...previous, { ...toPlainOne(course), owner: owner ?? undefined }]
    : previous.filter(c => !isOwnPin(c, id, owner))

  // Optimistic local write.
  void persistPins(next)

  try {
    if (shouldSkipNetwork()) return
    const token = tokenManager.getToken()
    if (!token) return // offline / signed-out: keep local-only change
    // Earlier-term pins are local only: Yanhekt's list no longer returns them.
    if (isEarlierTermPin(course, await currentTermKey())) return
    if (isPin) {
      await apiClient.subscribeCourse(token, id)
    } else {
      await apiClient.unsubscribeCourse(token, id)
    }
  } catch (error) {
    log.warn('Pin toggle API failed; rolling back:', error)
    void persistPins(previous)
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
  const owner = currentOwner()
  const current = storedPins()
  const idx = current.findIndex(c => isOwnPin(c, String(course.id), owner))
  if (idx === -1) return

  const existing = current[idx]
  const incoming = toPlainOne(course)
  const merged: PinnedCourse = {
    id: String(existing.id),
    title: incoming.title || existing.title,
    titleEn: incoming.titleEn || existing.titleEn,
    number: incoming.number || existing.number,
    instructor: incoming.instructor || existing.instructor,
    time: incoming.time || existing.time,
    classrooms: incoming.classrooms?.length ? incoming.classrooms : existing.classrooms,
    participant_count: incoming.participant_count ?? existing.participant_count,
    college_name: incoming.college_name || existing.college_name,
    professors: incoming.professors?.length ? incoming.professors : existing.professors,
    school_year: incoming.school_year || existing.school_year,
    semester: incoming.semester || existing.semester,
    imageUrl: incoming.imageUrl || existing.imageUrl,
    owner: existing.owner,
  }

  if (JSON.stringify(merged) === JSON.stringify(existing)) return
  const next = current.slice()
  next[idx] = merged
  void persistPins(next)
}

export const removePinnedCourse = async (id: string): Promise<void> => {
  if (!id) return
  if (overrides.pinnedRecordedCourses) return

  const courseId = String(id)
  if (inFlight.has(courseId)) return
  inFlight.add(courseId)

  const owner = currentOwner()
  const previous = storedPins()
  const removed = previous.find(c => isOwnPin(c, courseId, owner))
  if (!removed) {
    inFlight.delete(courseId)
    return
  }

  void persistPins(previous.filter(c => !isOwnPin(c, courseId, owner)))

  try {
    if (shouldSkipNetwork()) return
    const token = tokenManager.getToken()
    if (!token) return
    if (isEarlierTermPin(removed, await currentTermKey())) return
    await apiClient.unsubscribeCourse(token, courseId)
  } catch (error) {
    log.warn('Unpin API failed; rolling back:', error)
    void persistPins(previous)
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
