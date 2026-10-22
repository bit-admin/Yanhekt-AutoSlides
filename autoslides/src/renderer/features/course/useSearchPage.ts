import { computed, ref, watch } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse, type SemesterOption } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { navigationStore } from './navigationStore'
import { openCourse } from './courseSelection'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'
import { hydrateLiveTitles } from './liveCourseTitles'
import { getCurrentLocale } from '@shared/i18n'
import { configStore } from '@shared/services/configStore'
import { ensureSnapshotTerms, snapshotTerms } from '@shared/services/courseSnapshotTerms'
import { parseTermKey } from '@common/courseSnapshotTerm'
import { fillSnapshotCourses, snapshotRowToCourse, snapshotTermKey } from './courseSnapshotSearch'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('SearchPage');

const SEARCH_DEBOUNCE_MS = 400
/** Settle time for semester checkbox runs — shorter than typing. */
const SEMESTER_DEBOUNCE_MS = 250
const RESULTS_PER_PAGE = 16

const apiClient = new ApiClient()

// Module-singleton search state: the left-panel search bar writes the keyword,
// SearchPage.vue renders the results, and results persist across navigation.
const keyword = ref('')
/**
 * `yanhe2` is the Yanhe 2.0 catalogue. This module only holds the switch for
 * it: that search, its terms and its results live in `features/yanhe2`
 * (`useYanhe2Search`), which SearchPage.vue feeds this keyword.
 */
export type SearchMode = 'live' | 'recorded' | 'yanhe2'
const mode = ref<SearchMode>('recorded')
/** The current term back to 2023 Fall; see `availableSemesters` for what the picker lists. */
const baseSemesters = ref<SemesterOption[]>([])
// The one term searched, as a one-element array (the picker's shape). There is
// no "all semesters" search on Yanhekt any more (Yanhe 2.0 keeps its own).
// `semesterInitialized` keeps the auto-pick of the current term to the first time.
const selectedSemesterIds = ref<number[]>([])
const semesterInitialized = ref(false)
/**
 * Why an earlier term shows no search: `off` while Settings → Temporary
 * Workarounds → course snapshot search is off, `missing` when the snapshot has
 * no such term. Null otherwise.
 */
export type EarlierTermBlock = 'off' | 'missing'
const earlierTermBlocked = ref<EarlierTermBlock | null>(null)

/**
 * The oldest term the picker offers: autumn 2023, when this year's
 * fourth-year students started. The course index does not go further back.
 */
const FIRST_TERM = { schoolYear: 2023, semester: 1 } as const

/**
 * Earlier terms have no Yanhekt tag id (Yanhekt only names the current one), so
 * they get a negative picker id, `-(schoolYear * 10 + semester)`. A positive id
 * is the current term's Yanhekt tag id.
 */
const isEarlierTerm = (id: number): boolean => id < 0

/** A picker entry for an earlier term (negative id, see `isEarlierTerm`). */
const earlierTermOption = (schoolYear: number, semester: number): SemesterOption => ({
  id: -(schoolYear * 10 + semester),
  label: `${schoolYear}-${schoolYear + 1} ${semester === 1 ? '第一学期' : '第二学期'}`,
  labelEn: semester === 1 ? `${schoolYear} Fall` : `${schoolYear + 1} Spring`,
  schoolYear,
  semester,
})

/** Newest first: school year, then spring after autumn. */
const termOrder = (t: SemesterOption): number => t.schoolYear * 10 + t.semester

/** The current term, then every earlier term back to FIRST_TERM, newest first. */
const termsThrough = (current: SemesterOption): SemesterOption[] => {
  const out = [current]
  let { schoolYear, semester } = current
  if (!schoolYear) return out
  for (;;) {
    if (semester === 2) semester = 1
    else {
      schoolYear -= 1
      semester = 2
    }
    if (schoolYear < FIRST_TERM.schoolYear || (schoolYear === FIRST_TERM.schoolYear && semester < FIRST_TERM.semester)) break
    out.push(earlierTermOption(schoolYear, semester))
  }
  return out
}

/**
 * What the term picker lists: the current term back to 2023 Fall, plus the
 * snapshot terms ticked in Settings (Temporary Workarounds) while the snapshot
 * search is on. Only terms the snapshot has and that are older than the
 * current term are added.
 */
const availableSemesters = computed<SemesterOption[]>(() => {
  const base = baseSemesters.value
  const current = base[0]
  if (!current || !configStore.yanhektCourseSnapshotSearch) return base
  const present = new Set(snapshotTerms.value.map((t) => t.term))
  const seen = new Set(base.map((t) => t.id))
  const extra: SemesterOption[] = []
  for (const key of configStore.courseSnapshotPickerTerms ?? []) {
    const parts = parseTermKey(key)
    if (!parts || !present.has(key)) continue
    const option = earlierTermOption(parts.schoolYear, parts.semester)
    if (seen.has(option.id) || termOrder(option) >= termOrder(current)) continue
    seen.add(option.id)
    extra.push(option)
  }
  if (extra.length === 0) return base
  return [current, ...[...base.slice(1), ...extra].sort((a, b) => termOrder(b) - termOrder(a))]
})

// A term taken off the picker (unticked, or its import cleared) falls back to the current one.
watch(availableSemesters, (terms) => {
  const picked = selectedSemesterIds.value[0]
  if (picked === undefined || terms.length === 0 || terms.some((t) => t.id === picked)) return
  selectedSemesterIds.value = [terms[0].id]
  if (hasSearched.value && mode.value === 'recorded') void executeSearch()
})
const results = ref<Course[]>([])

// Results persist across navigation, so a language switch has to fill in the
// live titles that were skipped while another locale was active.
watch(getCurrentLocale, () => {
  if (mode.value === 'live') void hydrateLiveTitles(results.value)
})
const currentPage = ref(1)
const totalPages = ref(1)
const isLoading = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
// Sequence number so stale responses (rapid keyword/mode/semester flips) are dropped.
let requestSeq = 0

const cancelPendingSearch = () => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

const ensureSemesters = async () => {
  // The snapshot's terms decide which ticked extras the picker can list.
  void ensureSnapshotTerms()
  if (baseSemesters.value.length > 0) return
  try {
    // Yanhekt names only the current term; earlier ones are listed from it.
    const [current] = await apiClient.getAvailableSemesters()
    baseSemesters.value = current ? termsThrough(current) : []
  } catch (error) {
    log.error('Failed to load available semesters:', error)
  }
}

const selectLatestSemester = async () => {
  await ensureSemesters()
  if (availableSemesters.value.length > 0) {
    selectedSemesterIds.value = [availableSemesters.value[0].id]
  }
  semesterInitialized.value = true
}

const executeSearch = async (resetPage = true) => {
  cancelPendingSearch()

  // Not a Yanhekt search: `useYanhe2Search` follows the keyword on its own.
  if (mode.value === 'yanhe2') return

  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = ''
    results.value = []
    hasSearched.value = false
    isLoading.value = false
    return
  }

  if (resetPage) {
    currentPage.value = 1
  }

  const seq = ++requestSeq
  errorMessage.value = ''
  hasSearched.value = true
  earlierTermBlocked.value = null

  // Earlier terms: Yanhekt's search only covers the current one, so they come
  // from the course snapshot bundled with the app (a temporary workaround until
  // the course index; TODO(index)). `seq` above already made any in-flight
  // search stale.
  const earlierTerm = mode.value === 'recorded' ? selectedSemesterIds.value.find(isEarlierTerm) : undefined
  if (earlierTerm !== undefined) {
    await searchSnapshot(earlierTerm, token, seq)
    return
  }

  isLoading.value = true

  try {
    if (mode.value === 'live') {
      const response: LiveListResponse = await apiClient.searchLiveList(token, keyword.value.trim(), currentPage.value, RESULTS_PER_PAGE)
      if (seq !== requestSeq) return
      results.value = response.data.map(transformLiveStreamToCourse)
      // Live rows have no name_en — fill it per course, in the background.
      void hydrateLiveTitles(results.value)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    } else {
      const response: CourseListResponse = await apiClient.getCourseList(token, {
        keyword: keyword.value.trim(),
        semesters: [...selectedSemesterIds.value],
        page: currentPage.value,
        pageSize: RESULTS_PER_PAGE
      })
      if (seq !== requestSeq) return
      results.value = response.data.map(transformCourseDataToCourse)
      totalPages.value = response.last_page
      currentPage.value = response.current_page
    }
  } catch (error: unknown) {
    if (seq !== requestSeq) return
    log.error('Search failed:', error)
    errorMessage.value = (error instanceof Error && error.message) || 'Failed to search courses'
    results.value = []
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
    }
  }
}

/** Clear the grid and say why an earlier term cannot be searched. */
const blockEarlierTerm = (reason: EarlierTermBlock) => {
  results.value = []
  totalPages.value = 1
  currentPage.value = 1
  isLoading.value = false
  earlierTermBlocked.value = reason
}

const searchSnapshot = async (pickerId: number, token: string, seq: number) => {
  const term = snapshotTermKey(pickerId)
  if (!configStore.yanhektCourseSnapshotSearch || !term) {
    blockEarlierTerm(term ? 'off' : 'missing')
    return
  }
  isLoading.value = true
  try {
    const page = await apiClient.searchCourseSnapshot(term, keyword.value.trim(), currentPage.value, RESULTS_PER_PAGE)
    if (seq !== requestSeq) return
    if (!page) {
      blockEarlierTerm('missing')
      return
    }
    results.value = page.data.map((row) => snapshotRowToCourse(row, term))
    totalPages.value = page.last_page
    currentPage.value = page.current_page
    // Names and teachers show at once; the rest arrives card by card.
    void fillSnapshotCourses(results.value, apiClient, token, () => seq === requestSeq)
  } catch (error: unknown) {
    if (seq !== requestSeq) return
    log.error('Snapshot search failed:', error)
    errorMessage.value = (error instanceof Error && error.message) || 'Failed to search courses'
    results.value = []
  } finally {
    if (seq === requestSeq) isLoading.value = false
  }
}

// Turning the snapshot search on or off re-runs an earlier-term search in view.
watch(() => configStore.yanhektCourseSnapshotSearch, () => {
  if (!hasSearched.value || mode.value !== 'recorded') return
  if (selectedSemesterIds.value.some(isEarlierTerm)) void executeSearch()
})

// Search-as-you-type: debounce while the Search page is active.
watch(keyword, () => {
  if (navigationStore.activeNav.value !== 'search') return
  cancelPendingSearch()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    executeSearch()
  }, SEARCH_DEBOUNCE_MS)
})

const goToPage = async (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page
    await executeSearch(false)
  }
}

const setMode = async (m: SearchMode) => {
  if (mode.value === m) return
  mode.value = m
  if (m === 'recorded' && !semesterInitialized.value) {
    await selectLatestSemester()
  }
  await executeSearch()
}

/**
 * One term at a time. Debounced so flicking through terms costs one search.
 *
 * Reuses `debounceTimer` (and so `cancelPendingSearch`) rather than adding a
 * second timer, so a keystroke and a term change cannot both be pending.
 */
const setSemesters = (ids: number[]) => {
  if (ids.length === 0) return
  selectedSemesterIds.value = ids.slice(0, 1)
  semesterInitialized.value = true
  cancelPendingSearch()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void executeSearch()
  }, SEMESTER_DEBOUNCE_MS)
}


// Focusing the sidebar search bar opens the Search page; the first visit runs
// an initial search immediately (empty keyword is a valid search).
const handleSidebarFocus = async () => {
  navigationStore.navigate('search')
  if (!hasSearched.value && !isLoading.value) {
    if (mode.value === 'recorded' && !semesterInitialized.value) {
      await selectLatestSemester()
    }
    await executeSearch()
  }
}

const handleSidebarEnter = () => {
  executeSearch()
}

// Home page saved-course click: prefill and run.
const openSavedSearch = async (kw: string, m: 'live' | 'recorded') => {
  cancelPendingSearch()
  keyword.value = kw
  mode.value = m
  navigationStore.navigate('search')
  if (m === 'recorded') {
    await selectLatestSemester()
  }
  // The keyword watcher scheduled a debounce; run immediately instead.
  await executeSearch()
}

const selectResult = (course: Course) => {
  if (mode.value === 'yanhe2') return
  openCourse(mode.value, course)
}

export function useSearchPage() {
  return {
    keyword,
    mode,
    availableSemesters,
    selectedSemesterIds,
    earlierTermBlocked,
    results,
    currentPage,
    totalPages,
    isLoading,
    errorMessage,
    hasSearched,
    executeSearch,
    goToPage,
    setMode,
    setSemesters,
    handleSidebarFocus,
    handleSidebarEnter,
    openSavedSearch,
    selectResult
  }
}
