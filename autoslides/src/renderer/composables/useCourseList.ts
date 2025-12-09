import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ApiClient, type LiveStream, type LiveListResponse, type CourseData, type CourseListResponse, type SemesterOption } from '../services/apiClient'
import { TokenManager } from '../services/authService'
import { DataStore } from '../services/dataStore'

export interface Course {
  id: string
  title: string
  instructor: string
  time: string
  status?: number
  subtitle?: string
  schedule_started_at?: string
  schedule_ended_at?: string
  participant_count?: number
  session?: {
    professor?: {
      name: string
    }
    section_group_title?: string
  }
  target?: string
  target_vga?: string
  professors?: string[]
  classrooms?: { name: string }[]
  school_year?: string
  semester?: string
  college_name?: string
}

export interface UseCourseListOptions {
  mode: Ref<'live' | 'recorded'>
  t: (key: string) => string
  onCourseSelected: (course: Course) => void
}

export interface UseCourseListReturn {
  // State
  searchQuery: Ref<string>
  isLoading: Ref<boolean>
  courses: Ref<Course[]>
  currentPage: Ref<number>
  totalPages: Ref<number>
  errorMessage: Ref<string>
  showWelcome: Ref<boolean>

  // Semester state (recorded mode)
  availableSemesters: Ref<SemesterOption[]>
  selectedSemesters: Ref<number[]>
  showSemesterDropdown: Ref<boolean>
  semesterDropdownText: Ref<string>

  // Computed
  paginatedCourses: ComputedRef<Course[]>

  // Methods
  searchCourses: () => Promise<void>
  fetchPersonalCourses: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  selectCourse: (course: Course) => void
  getStatusClass: (status?: number) => string
  getStatusText: (status?: number) => string

  // Semester methods
  loadAvailableSemesters: () => Promise<void>
  toggleSemesterDropdown: () => void
  updateSemesterDropdownText: () => void
  handleClickOutside: (event: Event) => void

  // State management
  resetPageState: () => void
  initSemesterDropdownText: () => void
}

export function useCourseList(options: UseCourseListOptions): UseCourseListReturn {
  const { mode, t, onCourseSelected } = options

  const apiClient = new ApiClient()
  const tokenManager = new TokenManager()
  const coursesPerPage = 16

  // Core state
  const searchQuery = ref('')
  const isLoading = ref(false)
  const courses = ref<Course[]>([])
  const currentPage = ref(1)
  const totalPages = ref(1)
  const errorMessage = ref('')
  const showWelcome = ref(true)
  const lastAction = ref<'search' | 'personal' | null>(null)

  // Semester state (recorded mode)
  const availableSemesters = ref<SemesterOption[]>([])
  const selectedSemesters = ref<number[]>([])
  const showSemesterDropdown = ref(false)
  const semesterDropdownText = ref('')

  // Computed
  const paginatedCourses = computed(() => courses.value)

  // Transform functions
  const transformLiveStreamToCourse = (stream: LiveStream): Course => {
    const startTime = new Date(stream.schedule_started_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const endTime = new Date(stream.schedule_ended_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return {
      id: stream.id || stream.live_id || '',
      title: stream.title || 'Untitled',
      instructor: stream.session?.professor?.name || 'Unknown',
      time: `${startTime} - ${endTime}`,
      status: stream.status,
      subtitle: stream.subtitle,
      schedule_started_at: stream.schedule_started_at,
      schedule_ended_at: stream.schedule_ended_at,
      participant_count: stream.participant_count,
      session: stream.session,
      target: stream.target,
      target_vga: stream.target_vga
    }
  }

  const transformCourseDataToCourse = (courseData: CourseData): Course => {
    const professors = courseData.professors ? courseData.professors.join(', ') : 'Unknown'

    const semesterText = courseData.semester === '1' ? 'Fall' : 'Spring'
    const timeInfo = `${courseData.school_year} ${semesterText}`

    return {
      id: courseData.id,
      title: courseData.name_zh,
      instructor: professors,
      time: timeInfo,
      professors: courseData.professors,
      classrooms: courseData.classrooms,
      school_year: courseData.school_year,
      semester: courseData.semester,
      college_name: courseData.college_name,
      participant_count: courseData.participant_count
    }
  }

  // Search and fetch methods
  const searchCourses = async (resetPage = true) => {
    const token = tokenManager.getToken()
    if (!token) {
      errorMessage.value = 'Please login first'
      return
    }

    showWelcome.value = false
    isLoading.value = true
    errorMessage.value = ''
    lastAction.value = 'search'

    // Reset to page 1 for new searches, but not when navigating pages
    if (resetPage) {
      currentPage.value = 1
    }

    try {
      if (mode.value === 'live') {
        const keyword = searchQuery.value.trim()
        const response: LiveListResponse = await apiClient.searchLiveList(token, keyword, currentPage.value, coursesPerPage)
        courses.value = response.data.map(transformLiveStreamToCourse)
        totalPages.value = response.last_page
        currentPage.value = response.current_page
      } else {
        const requestOptions = {
          keyword: searchQuery.value.trim(),
          semesters: [...selectedSemesters.value],
          page: currentPage.value,
          pageSize: coursesPerPage
        }
        const response: CourseListResponse = await apiClient.getCourseList(token, requestOptions)
        courses.value = response.data.map(transformCourseDataToCourse)
        totalPages.value = response.last_page
        currentPage.value = response.current_page
      }
    } catch (error: any) {
      console.error('Search failed:', error)
      errorMessage.value = error.message || 'Failed to search courses'
      courses.value = []
    } finally {
      isLoading.value = false
    }
  }

  const fetchPersonalCourses = async (resetPage = true) => {
    const token = tokenManager.getToken()
    if (!token) {
      errorMessage.value = 'Please login first'
      return
    }

    showWelcome.value = false
    isLoading.value = true
    errorMessage.value = ''
    lastAction.value = 'personal'

    // Reset to page 1 for new fetches, but not when navigating pages
    if (resetPage) {
      currentPage.value = 1
    }

    try {
      if (mode.value === 'live') {
        const response: LiveListResponse = await apiClient.getPersonalLiveList(token, currentPage.value, coursesPerPage)
        courses.value = response.data.map(transformLiveStreamToCourse)
        totalPages.value = response.last_page
        currentPage.value = response.current_page
      } else {
        const requestOptions = {
          page: currentPage.value,
          pageSize: coursesPerPage
        }
        const response: CourseListResponse = await apiClient.getPersonalCourseList(token, requestOptions)
        courses.value = response.data.map(transformCourseDataToCourse)
        totalPages.value = response.last_page
        currentPage.value = response.current_page
      }
    } catch (error: any) {
      console.error('Failed to fetch personal courses:', error)
      errorMessage.value = error.message || 'Failed to fetch personal courses'
      courses.value = []
    } finally {
      isLoading.value = false
    }
  }

  const goToPage = async (page: number) => {
    if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
      currentPage.value = page

      if (lastAction.value === 'search') {
        await searchCourses(false) // Don't reset page when navigating
      } else {
        await fetchPersonalCourses(false) // Don't reset page when navigating
      }
    }
  }

  // Status helpers
  const getStatusClass = (status?: number): string => {
    switch (status) {
      case 0: return 'status-ended'
      case 1: return 'status-live'
      case 2: return 'status-upcoming'
      default: return 'status-unknown'
    }
  }

  const getStatusText = (status?: number): string => {
    switch (status) {
      case 0: return t('courses.status.ended')
      case 1: return t('courses.status.live')
      case 2: return t('courses.status.upcoming')
      default: return t('courses.status.unknown')
    }
  }

  // Course selection
  const selectCourse = (course: Course) => {
    if (mode.value === 'live') {
      const streamData: LiveStream = {
        id: course.id,
        title: course.title,
        subtitle: course.subtitle,
        status: course.status || 0,
        schedule_started_at: course.schedule_started_at || '',
        schedule_ended_at: course.schedule_ended_at || '',
        participant_count: course.participant_count,
        session: course.session,
        target: course.target,
        target_vga: course.target_vga
      }
      DataStore.setStreamData(course.id, streamData)
    }

    onCourseSelected(course)
  }

  // Semester management
  const loadAvailableSemesters = async () => {
    try {
      const semesters = await apiClient.getAvailableSemesters()
      availableSemesters.value = semesters
    } catch (error) {
      console.error('Failed to load available semesters:', error)
    }
  }

  const toggleSemesterDropdown = () => {
    showSemesterDropdown.value = !showSemesterDropdown.value
  }

  const updateSemesterDropdownText = () => {
    if (selectedSemesters.value.length === 0) {
      semesterDropdownText.value = t('courses.semester.allSemesters')
    } else if (selectedSemesters.value.length === 1) {
      const semester = availableSemesters.value.find(s => s.id === selectedSemesters.value[0])
      semesterDropdownText.value = semester ? semester.labelEn : `${selectedSemesters.value.length} ${t('courses.semester.selected')}`
    } else {
      semesterDropdownText.value = `${selectedSemesters.value.length} ${t('courses.semester.selected')}`
    }
  }

  const handleClickOutside = (event: Event) => {
    const target = event.target as HTMLElement
    if (!target.closest('.semester-selector')) {
      showSemesterDropdown.value = false
    }
  }

  // State management
  const resetPageState = () => {
    courses.value = []
    currentPage.value = 1
    totalPages.value = 1
    searchQuery.value = ''
    selectedSemesters.value = []
    semesterDropdownText.value = t('courses.semester.allSemesters')
    showSemesterDropdown.value = false
    errorMessage.value = ''
    showWelcome.value = true
    lastAction.value = null
  }

  const initSemesterDropdownText = () => {
    semesterDropdownText.value = t('courses.semester.allSemesters')
  }

  return {
    // State
    searchQuery,
    isLoading,
    courses,
    currentPage,
    totalPages,
    errorMessage,
    showWelcome,

    // Semester state
    availableSemesters,
    selectedSemesters,
    showSemesterDropdown,
    semesterDropdownText,

    // Computed
    paginatedCourses,

    // Methods
    searchCourses,
    fetchPersonalCourses,
    goToPage,
    selectCourse,
    getStatusClass,
    getStatusText,

    // Semester methods
    loadAvailableSemesters,
    toggleSemesterDropdown,
    updateSemesterDropdownText,
    handleClickOutside,

    // State management
    resetPageState,
    initSemesterDropdownText
  }
}
