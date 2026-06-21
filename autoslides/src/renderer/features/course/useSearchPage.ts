import { ref, watch } from 'vue'
import { ApiClient, type LiveListResponse, type CourseListResponse, type SemesterOption } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { navigationStore } from './navigationStore'
import { openCourse } from './courseSelection'
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from './useCourseList'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('SearchPage');

const SEARCH_DEBOUNCE_MS = 400
const RESULTS_PER_PAGE = 16

const apiClient = new ApiClient()

// Module-singleton search state: the left-panel search bar writes the keyword,
// SearchPage.vue renders the results, and results persist across navigation.
const keyword = ref('')
const mode = ref<'live' | 'recorded'>('recorded')
const availableSemesters = ref<SemesterOption[]>([])
// Selected semester ids; an empty array means "all semesters" (no filter — the
// backend's `semesters[]` param is simply omitted). `semesterInitialized`
// distinguishes the not-yet-defaulted startup state from a deliberate
// empty/"all" selection so we only auto-pick the latest semester once.
const selectedSemesterIds = ref<number[]>([])
const semesterInitialized = ref(false)
const results = ref<Course[]>([])
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
    availableSemesters.value = await apiClient.getAvailableSemesters()
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

  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = 'Please login first'
    results.value = []
    hasSearched.value = true
    return
  }

  if (resetPage) {
    currentPage.value = 1
  }

  const seq = ++requestSeq
  isLoading.value = true
  errorMessage.value = ''
  hasSearched.value = true

  try {
    if (mode.value === 'live') {
      const response: LiveListResponse = await apiClient.searchLiveList(token, keyword.value.trim(), currentPage.value, RESULTS_PER_PAGE)
      if (seq !== requestSeq) return
      results.value = response.data.map(transformLiveStreamToCourse)
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
  } catch (error: any) {
    if (seq !== requestSeq) return
    log.error('Search failed:', error)
    errorMessage.value = error.message || 'Failed to search courses'
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

const setMode = async (m: 'live' | 'recorded') => {
  if (mode.value === m) return
  mode.value = m
  if (m === 'recorded' && !semesterInitialized.value) {
    await selectLatestSemester()
  }
  await executeSearch()
}

const setSemesters = async (ids: number[]) => {
  selectedSemesterIds.value = ids
  semesterInitialized.value = true
  await executeSearch()
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

const openAllRecordingsSearch = async () => {
  cancelPendingSearch()
  keyword.value = ''
  mode.value = 'recorded'
  navigationStore.navigate('search')
  if (!semesterInitialized.value) {
    await selectLatestSemester()
  }
  await executeSearch()
}

const selectResult = (course: Course) => {
  openCourse(mode.value, course)
}

export function useSearchPage() {
  return {
    keyword,
    mode,
    availableSemesters,
    selectedSemesterIds,
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
    openAllRecordingsSearch,
    selectResult
  }
}
