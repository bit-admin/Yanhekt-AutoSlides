import { computed, ref, watch } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse, type SemesterOption } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { navigationStore } from './navigationStore'
import { openCourse } from './courseSelection'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'
import { hydrateLiveTitles } from './liveCourseTitles'
import { getCurrentLocale } from '@shared/i18n'
import { configStore } from '@shared/services/configStore'
import { fillIndexCourses, indexRowToCourse } from './courseIndexSearch'
import { isEarlierTermOption as isEarlierTerm, termKeyOfOption, termOptionsBackFrom } from '@common/termOptions'
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
 * Why a course index search shows no grid: `type` before any keyword (the
 * index has no "everything" listing), `local-missing` when the chosen copy on
 * this computer lacks the term, `online-term` when the AutoSlides Index does
 * not cover it, `online-failed` when it did not answer. Null otherwise.
 */
export type IndexNotice = 'type' | 'local-missing' | 'online-term' | 'online-failed'
const indexNotice = ref<IndexNotice | null>(null)

/** What the term picker lists: the current term back to 2023 Fall. */
const availableSemesters = computed<SemesterOption[]>(() => baseSemesters.value)

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
  if (baseSemesters.value.length > 0) return
  try {
    // Yanhekt names only the current term; earlier ones are listed from it.
    const [current] = await apiClient.getAvailableSemesters()
    baseSemesters.value = current ? termOptionsBackFrom(current) : []
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
  indexNotice.value = null

  // The course index answers earlier terms (Yanhekt's search covers only the
  // current one), and the current term too when Settings → General → Search
  // picks it over Yanhekt. `seq` above already made any in-flight search stale.
  if (mode.value === 'recorded') {
    const picked = availableSemesters.value.find((t) => t.id === selectedSemesterIds.value[0])
    if (picked && (isEarlierTerm(picked.id) || configStore.currentTermSearchSource !== 'yanhekt')) {
      await searchIndex(termKeyOfOption(picked), token, seq)
      return
    }
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

/** Clear the grid and say why the index shows nothing. */
const showIndexNotice = (notice: IndexNotice) => {
  results.value = []
  totalPages.value = 1
  currentPage.value = 1
  isLoading.value = false
  indexNotice.value = notice
}

const searchIndex = async (term: string, token: string, seq: number) => {
  const text = keyword.value.trim()
  if (!text) {
    showIndexNotice('type')
    return
  }
  isLoading.value = true
  try {
    const answer = await apiClient.searchCourseIndex(term, text, currentPage.value, RESULTS_PER_PAGE)
    if (seq !== requestSeq) return
    if (!answer.ok) {
      if (answer.reason === 'local-missing') showIndexNotice('local-missing')
      else if (answer.code === 'term-not-indexed') showIndexNotice('online-term')
      else if (answer.code === 'bad-param' || answer.code === 'term-required') results.value = []
      else showIndexNotice('online-failed')
      return
    }
    results.value = answer.courses.map((row) => indexRowToCourse(row, term))
    totalPages.value = answer.lastPage
    currentPage.value = answer.page
    // Names and teachers show at once; the rest arrives card by card.
    void fillIndexCourses(results.value, apiClient, token, () => seq === requestSeq)
  } catch (error: unknown) {
    if (seq !== requestSeq) return
    log.error('Course index search failed:', error)
    errorMessage.value = (error instanceof Error && error.message) || 'Failed to search courses'
    results.value = []
  } finally {
    if (seq === requestSeq) isLoading.value = false
  }
}

// A changed search source re-runs a recorded search in view.
watch(() => [configStore.currentTermSearchSource, configStore.earlierTermSearchSource], () => {
  if (hasSearched.value && mode.value === 'recorded') void executeSearch()
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
    indexNotice,
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
