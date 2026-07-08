/**
 * Index-mode data layer for the Cloud Notes page (the merged-in "AutoSlides
 * Index"). Talks to the public Index Worker's v2 read/removal endpoints (via the
 * `cloudNotes` IPC bridge, which routes through the main process) and resolves a
 * selected version's share link into slide image URLs for the right-panel viewer.
 *
 * Browse model (mirrors the website `share/apex/App.tsx`, re-split for the app's
 * three-pane shell):
 *   - No search  → the Recently-added feed fills the middle panel; left is empty.
 *   - After search → the LEFT panel lists courses (grouped from the one search
 *     response); the MIDDLE panel lists the selected course's sessions. Switching
 *     courses re-renders from already-fetched data — no new request. Expanding a
 *     session is the only place `/v2/api/lecture` is called (cached per session).
 *   - Selecting a version resolves its slides into the RIGHT-panel viewer.
 */

import { computed, ref, watch } from 'vue'
import { SHARE_ORIGIN } from '@common/shareLink'
import { overrides } from '@shared/overrideRegistry'
import type {
  IndexLecture,
  IndexVersion,
  IndexRecentFile,
  ShareImportResult,
  NotesResult,
  IndexRemovalResult,
} from '@common/notesTypes'
import type { SlideMetadata } from '@common/slideMetadataTypes'
import { groupLectures, schoolYearRank, semesterRank } from './lectureSort'
import { buildIndexMetadata } from './indexMetadata'

export type IndexSearchMode = 'search' | 'paste'

/** One entry of the term filter dropdown (key = `${schoolYear}||${semester}`). */
export interface IndexTermOption {
  key: string
  schoolYear?: string
  semester?: string
}

/** Right-panel slide-viewer state for the currently-open version. */
export interface IndexViewerDetail {
  courseTitle: string
  sessionTitle: string
  imageCount: number
  urls: string[]
  /** Best-effort slide metadata (identity + review) threaded into import/export. */
  metadata: SlideMetadata | null
  /** Canonical `/v1/s/<shareId>` link (or the pasted link) — for import/export. */
  sourceUrl: string
  /** Raw resolve result, passed straight to `useShareIndexExport.startExport`. */
  resolved: ShareImportResult
}

/** Per-session cache of the `/v2/api/lecture` response (versions + lecture). */
interface SessionCacheEntry {
  loading: boolean
  error: boolean
  lecture: IndexLecture | null
  versions: IndexVersion[]
}

const sessionKey = (courseId: string, sessionId: string): string => `${courseId}.${sessionId}`

// Mirrors the left-panel Search page's search-as-you-type debounce (useSearchPage.ts).
const SEARCH_DEBOUNCE_MS = 400

/**
 * Split a share payload's display title into course + session lines — mirrors
 * the public viewer's `parseTitle` (share/src/lib/title.ts). Used only for a raw
 * pasted link, where we have no lecture context to read the titles from.
 */
export function parseShareTitle(raw: string): { course: string; session: string } {
  const zh = raw.match(/^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/)
  if (zh) return { course: zh[1], session: `第${zh[2]}周 · 星期${zh[3]} · 第${zh[4]}大节` }
  const en = raw.match(/^(.+) - Lecture (\d+)$/)
  if (en) return { course: en[1], session: `Lecture ${en[2]}` }
  return { course: raw.replace(/_/g, ' '), session: '' }
}

export function useCloudIndexBrowse() {
  const searchMode = ref<IndexSearchMode>('search')
  const query = ref('')
  const pasteLink = ref('')
  const searching = ref(false)

  const recentFiles = ref<IndexRecentFile[]>([])
  const statsSummary = ref<{ courseCount: number; lectureCount: number; versionCount: number } | null>(null)

  // null = no search run yet (show recently-added). [] = searched, no matches.
  const results = ref<IndexLecture[] | null>(null)
  const selectedCourseId = ref<string | null>(null)
  const expandedKey = ref<string | null>(null)
  const sessionCache = ref<Record<string, SessionCacheEntry>>({})

  const selectedShareId = ref<string | null>(null)
  const viewer = ref<IndexViewerDetail | null>(null)
  const viewerLoading = ref(false)
  const viewerError = ref(false)

  const hasResults = computed(() => results.value !== null)

  // ── Filters (mirror the Index website's filter bar) ───────────────────────
  // '' = no filter. Options are derived from the one search response; the
  // filtered set drives the LEFT course list only — the selected course's
  // sessions stay unfiltered so clicking into a course shows all of them.
  const collegeFilter = ref('')
  const termFilter = ref('')
  const instructorFilter = ref('')

  const instructorOf = (l: IndexLecture): string =>
    l.instructor || (l.professors ?? []).join(', ')
  /** Encodes a lecture's term as a stable filter key, e.g. "2025-2026||1". */
  const termKeyOf = (l: IndexLecture): string => `${l.schoolYear ?? ''}||${l.semester ?? ''}`

  const colleges = computed(() => {
    const set = new Set((results.value ?? []).map((l) => l.college).filter((v): v is string => !!v))
    return Array.from(set)
  })
  const terms = computed<IndexTermOption[]>(() => {
    const seen = new Map<string, IndexTermOption>()
    for (const l of results.value ?? []) {
      if (!l.schoolYear && !l.semester) continue
      const key = termKeyOf(l)
      if (!seen.has(key)) seen.set(key, { key, schoolYear: l.schoolYear, semester: l.semester })
    }
    return Array.from(seen.values()).sort((a, b) => {
      const yearDiff = schoolYearRank(b.schoolYear) - schoolYearRank(a.schoolYear)
      if (yearDiff !== 0) return yearDiff
      return semesterRank(b.semester) - semesterRank(a.semester)
    })
  })
  const instructors = computed(() => {
    const set = new Set((results.value ?? []).map(instructorOf).filter(Boolean))
    return Array.from(set)
  })
  const showFilterBar = computed(
    () =>
      hasResults.value &&
      (colleges.value.length > 1 || terms.value.length > 1 || instructors.value.length > 1),
  )

  const filteredResults = computed(() =>
    (results.value ?? []).filter((l) => {
      if (collegeFilter.value && l.college !== collegeFilter.value) return false
      if (termFilter.value && termKeyOf(l) !== termFilter.value) return false
      if (instructorFilter.value && instructorOf(l) !== instructorFilter.value) return false
      return true
    }),
  )

  const courseGroups = computed(() => (results.value ? groupLectures(filteredResults.value) : []))
  const allCourseGroups = computed(() => (results.value ? groupLectures(results.value) : []))
  const selectedCourse = computed(
    () => allCourseGroups.value.find((g) => g.courseId === selectedCourseId.value) ?? null,
  )
  const sessions = computed<IndexLecture[]>(() => selectedCourse.value?.items ?? [])

  function resetFilters(): void {
    collegeFilter.value = ''
    termFilter.value = ''
    instructorFilter.value = ''
  }

  // When a filter change hides the selected course, fall back to the first
  // visible one (or none) so the middle panel never shows a hidden course.
  watch([collegeFilter, termFilter, instructorFilter], () => {
    if (!results.value) return
    if (!courseGroups.value.some((g) => g.courseId === selectedCourseId.value)) {
      selectedCourseId.value = courseGroups.value[0]?.courseId ?? null
      expandedKey.value = null
    }
  })

  const notes = overrides.cloudIndexProvider ?? window.electronAPI.cloudNotes

  // ── Loading ────────────────────────────────────────────────────────────

  /** Fetch the homepage aggregates + recently-added files (the no-search view). */
  async function loadRecent(): Promise<void> {
    const res = await notes.indexStats()
    if (!res.ok) return
    recentFiles.value = (res.data.recent ?? []).filter((f) => f.shareId)
    statsSummary.value = {
      courseCount: res.data.courseCount,
      lectureCount: res.data.lectureCount,
      versionCount: res.data.versionCount,
    }
  }

  // Search-as-you-type: debounce while the search box is active. `runSearch`
  // itself writes the trimmed term back into `query` (needed so an external
  // pre-search request populates the box) and records it as the last-executed
  // term, so a programmatic write doesn't re-trigger the debounce watcher below.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastExecutedQuery: string | null = null
  const cancelPendingSearch = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  /** Run a search, group the results by course, and select the first course. */
  async function runSearch(term: string): Promise<void> {
    lastExecutedQuery = term
    query.value = term
    searchMode.value = 'search'
    searching.value = true
    expandedKey.value = null
    sessionCache.value = {}
    resetFilters()
    try {
      const res = await notes.indexSearch(term)
      results.value = res.ok ? res.data : []
      selectedCourseId.value = courseGroups.value[0]?.courseId ?? null
    } finally {
      searching.value = false
    }
  }

  /** Back to the recently-added view (clears the current search). */
  function clearSearch(): void {
    lastExecutedQuery = null
    results.value = null
    selectedCourseId.value = null
    expandedKey.value = null
    query.value = ''
    resetFilters()
  }

  function togglePaste(): void {
    searchMode.value = searchMode.value === 'paste' ? 'search' : 'paste'
  }

  watch(query, () => {
    if (searchMode.value !== 'search') return
    cancelPendingSearch()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      const term = query.value.trim()
      if (term === lastExecutedQuery) return
      if (!term) {
        if (results.value !== null) clearSearch()
        return
      }
      void runSearch(term)
    }, SEARCH_DEBOUNCE_MS)
  })

  // ── Course / session navigation ──────────────────────────────────────────

  /** Switch the middle panel to another course from the already-fetched results. */
  function selectCourse(courseId: string): void {
    if (selectedCourseId.value === courseId) return
    selectedCourseId.value = courseId
    expandedKey.value = null
  }

  function sessionEntryFor(courseId: string, sessionId: string): SessionCacheEntry | undefined {
    return sessionCache.value[sessionKey(courseId, sessionId)]
  }

  function isExpanded(courseId: string, sessionId: string): boolean {
    return expandedKey.value === sessionKey(courseId, sessionId)
  }

  /** Expand/collapse a session's inline version list (lazy `/v2/api/lecture`). */
  async function toggleSession(l: IndexLecture): Promise<void> {
    const key = sessionKey(l.courseId, l.sessionId)
    if (expandedKey.value === key) {
      expandedKey.value = null
      return
    }
    expandedKey.value = key
    if (!sessionCache.value[key]) await loadSession(l.courseId, l.sessionId)
  }

  async function loadSession(courseId: string, sessionId: string): Promise<void> {
    const key = sessionKey(courseId, sessionId)
    sessionCache.value = {
      ...sessionCache.value,
      [key]: { loading: true, error: false, lecture: null, versions: [] },
    }
    const res = await notes.indexLecture(courseId, sessionId)
    sessionCache.value = {
      ...sessionCache.value,
      [key]: res.ok
        ? { loading: false, error: false, lecture: res.data.lecture, versions: res.data.versions }
        : { loading: false, error: true, lecture: null, versions: [] },
    }
  }

  // ── Right-panel viewer ────────────────────────────────────────────────────

  /** Resolve a share id's slides + build metadata into the viewer. */
  async function resolveIntoViewer(
    shareId: string,
    lecture: IndexLecture | null,
    version: IndexVersion | null,
    fallbackTitle?: string,
  ): Promise<void> {
    const link = `${SHARE_ORIGIN}/v1/s/${shareId}`
    const res = await notes.resolveShareLink(link)
    viewerLoading.value = false
    if (!res.ok || res.data.urls.length === 0) {
      viewerError.value = true
      return
    }
    const metadata =
      lecture && version ? buildIndexMetadata({ lecture, versions: [version] }, shareId) : null
    const parsed = parseShareTitle(fallbackTitle ?? res.data.title)
    viewer.value = {
      courseTitle: lecture?.courseTitle || parsed.course,
      sessionTitle: lecture?.sessionTitle || parsed.session,
      imageCount: res.data.urls.length,
      urls: res.data.urls,
      metadata,
      sourceUrl: link,
      resolved: { ...res.data, metadata },
    }
  }

  function beginViewer(shareId: string | null): void {
    selectedShareId.value = shareId
    viewerLoading.value = true
    viewerError.value = false
    viewer.value = null
  }

  /** Open a specific version from an expanded session's version list. */
  async function openVersion(version: IndexVersion, lecture: IndexLecture): Promise<void> {
    if (!version.shareId) return
    beginViewer(version.shareId)
    await resolveIntoViewer(version.shareId, lecture, version)
  }

  /** Open a recently-added file: fetch its lecture (for review flags), then open. */
  async function openRecentFile(file: IndexRecentFile): Promise<void> {
    beginViewer(file.shareId)
    const lecRes = await notes.indexLecture(file.courseId, file.sessionId)
    const lecture: IndexLecture = lecRes.ok
      ? lecRes.data.lecture
      : {
          courseId: file.courseId,
          sessionId: file.sessionId,
          courseTitle: file.courseTitle,
          sessionTitle: file.sessionTitle,
          instructor: file.instructor,
          professors: file.professors,
          semester: file.semester,
          schoolYear: file.schoolYear,
          college: file.college,
        }
    const version: IndexVersion =
      (lecRes.ok ? lecRes.data.versions.find((v) => v.shareId === file.shareId) : undefined) ?? {
        shareId: file.shareId,
        imageCount: file.imageCount,
        reviewed: false,
        edited: false,
        createdAt: file.createdAt,
      }
    await resolveIntoViewer(file.shareId, lecture, version)
  }

  /** Resolve a pasted share link straight into the viewer (no lecture context). */
  async function resolvePaste(): Promise<void> {
    const link = pasteLink.value.trim()
    if (!link) return
    beginViewer(null)
    const res = await notes.resolveShareLink(link)
    viewerLoading.value = false
    if (!res.ok || res.data.urls.length === 0) {
      viewerError.value = true
      return
    }
    const parsed = parseShareTitle(res.data.title)
    viewer.value = {
      courseTitle: parsed.course,
      sessionTitle: parsed.session,
      imageCount: res.data.urls.length,
      urls: res.data.urls,
      metadata: res.data.metadata ?? null,
      sourceUrl: link,
      resolved: res.data,
    }
  }

  function closeViewer(): void {
    viewer.value = null
    viewerError.value = false
    selectedShareId.value = null
  }

  // ── Removal ────────────────────────────────────────────────────────────

  /** Request removal of the signed-in user's own versions of a lecture. */
  function requestRemoval(
    courseId: string,
    sessionId: string,
  ): Promise<NotesResult<IndexRemovalResult>> {
    return notes.requestIndexRemoval(courseId, sessionId)
  }

  /** Refetch a session's versions after a removal; clears the viewer if its
   *  open version is gone. */
  async function reloadSession(courseId: string, sessionId: string): Promise<void> {
    await loadSession(courseId, sessionId)
    const entry = sessionEntryFor(courseId, sessionId)
    if (
      selectedShareId.value &&
      entry &&
      !entry.versions.some((v) => v.shareId === selectedShareId.value)
    ) {
      closeViewer()
    }
  }

  return {
    // state
    searchMode, query, pasteLink, searching,
    recentFiles, statsSummary,
    results, hasResults, courseGroups, selectedCourseId, selectedCourse, sessions,
    collegeFilter, termFilter, instructorFilter, colleges, terms, instructors, showFilterBar,
    expandedKey, selectedShareId, viewer, viewerLoading, viewerError,
    // reads
    sessionEntryFor, isExpanded,
    // actions
    loadRecent, runSearch, clearSearch, togglePaste,
    selectCourse, toggleSession,
    openVersion, openRecentFile, resolvePaste, closeViewer,
    requestRemoval, reloadSession,
  }
}

export type CloudIndexBrowse = ReturnType<typeof useCloudIndexBrowse>
