import { ref, watch } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse, type SemesterOption } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { navigationStore } from './navigationStore'
import { openCourse } from './courseSelection'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'
import { hydrateLiveTitles } from './liveCourseTitles'
import { getCurrentLocale } from '@shared/i18n'
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
const availableSemesters = ref<SemesterOption[]>([])
// The one term searched, as a one-element array (the picker's shape). There is
// no "all semesters" search on Yanhekt any more (Yanhe 2.0 keeps its own).
// `semesterInitialized` keeps the auto-pick of the current term to the first time.
const selectedSemesterIds = ref<number[]>([])
const semesterInitialized = ref(false)
/** True while an earlier term is picked: those are not searchable here yet. */
const pastTermPicked = ref(false)

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
    out.push({
      id: -(schoolYear * 10 + semester),
      label: `${schoolYear}-${schoolYear + 1} ${semester === 1 ? '第一学期' : '第二学期'}`,
      labelEn: semester === 1 ? `${schoolYear} Fall` : `${schoolYear + 1} Spring`,
      schoolYear,
      semester,
    })
  }
  return out
}
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
  if (availableSemesters.value.length > 0) return
  try {
    // Yanhekt names only the current term; earlier ones are listed from it.
    const [current] = await apiClient.getAvailableSemesters()
    availableSemesters.value = current ? termsThrough(current) : []
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
  pastTermPicked.value = false

  // TODO(index): search an earlier term on the course index (share `/api/search`,
  // as the web app does through its Worker). Until then an earlier term only
  // says it cannot be searched here yet.
  if (mode.value === 'recorded' && selectedSemesterIds.value.some(isEarlierTerm)) {
    // `seq` above already made any in-flight search stale.
    results.value = []
    totalPages.value = 1
    currentPage.value = 1
    isLoading.value = false
    pastTermPicked.value = true
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
    pastTermPicked,
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
