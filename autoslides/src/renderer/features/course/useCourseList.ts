import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ApiClient, type LiveStream, type LiveListResponse, type CourseData, type CourseListResponse } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { openCourse } from './courseSelection'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('CourseList');

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

// Transform functions (shared by the course grid, Home page rows, and Search page)
export const transformLiveStreamToCourse = (stream: LiveStream): Course => {
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

export const transformCourseDataToCourse = (courseData: CourseData): Course => {
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

// Status helpers (shared by every surface that renders live course cards)
export const getCourseStatusClass = (status?: number): string => {
  switch (status) {
    case 0: return 'status-ended'
    case 1: return 'status-live'
    case 2: return 'status-upcoming'
    default: return 'status-unknown'
  }
}

export const getCourseStatusText = (status: number | undefined, t: (key: string) => string): string => {
  switch (status) {
    case 0: return t('courses.status.ended')
    case 1: return t('courses.status.live')
    case 2: return t('courses.status.upcoming')
    default: return t('courses.status.unknown')
  }
}

export interface UseCourseListOptions {
  mode: Ref<'live' | 'recorded'>
  t: (key: string) => string
}

export interface UseCourseListReturn {
  // State
  isLoading: Ref<boolean>
  courses: Ref<Course[]>
  currentPage: Ref<number>
  totalPages: Ref<number>
  errorMessage: Ref<string>

  // Computed
  paginatedCourses: ComputedRef<Course[]>

  // Methods
  fetchPersonalCourses: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  selectCourse: (course: Course) => void
  getStatusClass: (status?: number) => string
  getStatusText: (status?: number) => string
}

export function useCourseList(options: UseCourseListOptions): UseCourseListReturn {
  const { mode, t } = options

  const apiClient = new ApiClient()
  const coursesPerPage = 16

  // Core state
  const isLoading = ref(false)
  const courses = ref<Course[]>([])
  const currentPage = ref(1)
  const totalPages = ref(1)
  const errorMessage = ref('')

  // Computed
  const paginatedCourses = computed(() => courses.value)

  const fetchPersonalCourses = async (resetPage = true) => {
    const token = tokenManager.getToken()
    if (!token) {
      errorMessage.value = 'Please login first'
      return
    }

    isLoading.value = true
    errorMessage.value = ''

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
      log.error('Failed to fetch personal courses:', error)
      errorMessage.value = error.message || 'Failed to fetch personal courses'
      courses.value = []
    } finally {
      isLoading.value = false
    }
  }

  const goToPage = async (page: number) => {
    if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
      currentPage.value = page
      await fetchPersonalCourses(false) // Don't reset page when navigating
    }
  }

  // Status helpers
  const getStatusClass = (status?: number): string => getCourseStatusClass(status)
  const getStatusText = (status?: number): string => getCourseStatusText(status, t)

  // Course selection
  const selectCourse = (course: Course) => {
    openCourse(mode.value, course)
  }

  return {
    // State
    isLoading,
    courses,
    currentPage,
    totalPages,
    errorMessage,

    // Computed
    paginatedCourses,

    // Methods
    fetchPersonalCourses,
    goToPage,
    selectCourse,
    getStatusClass,
    getStatusText
  }
}
