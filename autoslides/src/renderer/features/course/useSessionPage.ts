import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ApiClient, type SessionData, type CourseInfoResponse } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { DataStore } from '@shared/services/dataStore'
import { DownloadService, type DownloadQueueAddResult } from '@shared/services/downloadService'
import { TaskQueue, type TaskQueueAddResult } from '@shared/services/taskQueueService'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('SessionPage');

export interface SessionCourse {
  id: string
  title: string
  instructor: string
  time: string
  classrooms?: { name: string }[]
  college_name?: string
  participant_count?: number
  professors?: string[]
  school_year?: string
  semester?: string
}

// Session type extends SessionData from API client
export type Session = SessionData

export interface UseSessionPageOptions {
  course: Ref<SessionCourse | null>
  t: (key: string, params?: Record<string, unknown>) => string
  onSessionSelected: (session: Session) => void
  onBackToCourses: () => void
  onSwitchToDownload: (downloadItemId?: string) => void
  onSwitchToTask: (taskId?: string) => void
}

export interface UseSessionPageReturn {
  // State
  sessions: Ref<Session[]>
  courseInfo: Ref<CourseInfoResponse | null>
  // The incoming course merged with the fields fetched via getCourseInfo. Use
  // this (not the raw prop) for display + persistence so a thin/pinned course
  // shows instructor/professors/term/college once sessions have loaded.
  courseDetails: ComputedRef<SessionCourse | null>
  isLoading: Ref<boolean>
  errorMessage: Ref<string>
  showCourseDetails: Ref<boolean>

  // Navigation
  goBack: () => void
  selectSession: (session: Session) => void

  // UI State
  toggleCourseDetails: () => void

  // Data Loading
  loadCourseSessions: () => Promise<void>

  // Session actions
  addToQueue: (session: Session) => void
  downloadCamera: (session: Session) => void
  downloadScreen: (session: Session) => void

  // Batch actions
  addAllToQueue: () => void
  downloadAllCamera: () => void
  downloadAllScreen: () => void

  // Formatting utilities
  formatDuration: (seconds: number) => string
  getDayName: (day: number) => string
  formatDate: (dateString: string) => string
}

export function useSessionPage(options: UseSessionPageOptions): UseSessionPageReturn {
  const { course, t, onSessionSelected, onBackToCourses, onSwitchToDownload, onSwitchToTask } = options

  const apiClient = new ApiClient()

  // State
  const sessions = ref<Session[]>([])
  const courseInfo = ref<CourseInfoResponse | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref('')
  const showCourseDetails = ref(false)

  // Rich course fields fetched via getCourseInfo (filled in loadCourseSessions).
  // Lets a thin course opened from a pin (id + title only) gain instructor /
  // professors / academic term / college. `classrooms` is not provided by that
  // endpoint, so it stays as whatever the incoming course carried.
  const fetchedCourseInfo = ref<Partial<SessionCourse>>({})

  // The incoming course merged with fetched fields. Incoming values win (the
  // course-grid path already has everything); fetched values fill the gaps.
  const courseDetails = computed<SessionCourse | null>(() => {
    const base = course.value
    if (!base) return null
    const extra = fetchedCourseInfo.value
    return {
      ...base,
      instructor: base.instructor || extra.instructor || '',
      professors: base.professors && base.professors.length > 0 ? base.professors : extra.professors,
      college_name: base.college_name || extra.college_name,
      school_year: base.school_year || extra.school_year,
      semester: base.semester || extra.semester,
      time: base.time || extra.time || '',
    }
  })

  // Helper: Store session data with course information
  const storeSessionData = (session: Session): void => {
    const c = courseDetails.value
    if (c) {
      DataStore.setSessionDataWithCourse(session.session_id.toString(), session, {
        id: c.id,
        title: c.title,
        instructor: c.instructor,
        time: c.time,
        classrooms: c.classrooms,
        college_name: c.college_name,
        participant_count: c.participant_count,
        professors: c.professors,
        school_year: c.school_year,
        semester: c.semester
      })
    } else {
      DataStore.setSessionData(session.session_id.toString(), session)
    }
  }

  // Helper: Add session to download queue
  const addSessionToDownload = (session: Session, videoType: 'camera' | 'screen'): DownloadQueueAddResult => {
    storeSessionData(session)
    return DownloadService.addToQueue({
      name: `${videoType}_${course.value?.title}_${session.title}`,
      courseTitle: course.value?.title || t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      videoType
    })
  }

  // Helper: Add session to task queue
  const addSessionToTask = (session: Session): TaskQueueAddResult => {
    storeSessionData(session)
    return TaskQueue.addToQueue({
      name: `slides_${course.value?.title}_${session.title}`,
      courseTitle: course.value?.title || t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      courseId: course.value?.id || 'unknown'
    })
  }

  // Navigation
  const goBack = (): void => {
    onBackToCourses()
  }

  const selectSession = (session: Session): void => {
    storeSessionData(session)
    onSessionSelected(session)
  }

  // UI State
  const toggleCourseDetails = (): void => {
    showCourseDetails.value = !showCourseDetails.value
  }

  // Data Loading
  const loadCourseSessions = async (): Promise<void> => {
    if (!course.value) {
      errorMessage.value = t('sessions.noCourseSelected')
      return
    }

    const token = tokenManager.getToken()
    if (!token) {
      errorMessage.value = t('sessions.pleaseLoginFirst')
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      const response = await apiClient.getCourseInfo(course.value.id, token)
      courseInfo.value = response
      sessions.value = response.videos

      // Hydrate the rich fields a thin/pinned course lacks. semester is a number
      // here (vs a string from the course list) — normalize to string. Derive a
      // display term ("2025-2026 Fall") matching useCourseList's formatting.
      const semesterStr = response.semester != null ? String(response.semester) : undefined
      fetchedCourseInfo.value = {
        instructor: response.professor,
        professors: response.professors,
        college_name: response.college_name,
        school_year: response.school_year,
        semester: semesterStr,
        time: response.school_year
          ? `${response.school_year} ${Number(response.semester) === 1 ? 'Fall' : 'Spring'}`
          : undefined,
      }
    } catch (error: unknown) {
      log.error('Failed to load course sessions:', error)
      const errorMsg = error instanceof Error ? error.message : t('sessions.failedToLoadSessions')
      errorMessage.value = errorMsg
      sessions.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Session actions
  const addToQueue = (session: Session): void => {
    const result = addSessionToTask(session)
    if (!result.added) {
      alert(t('sessions.alreadyInTaskQueue'))
    } else {
      onSwitchToTask(result.item.id)
    }
  }

  const downloadCamera = (session: Session): void => {
    const result = addSessionToDownload(session, 'camera')
    if (!result.added) {
      alert(t('sessions.alreadyInDownloadQueue'))
    } else {
      onSwitchToDownload(result.item.id)
    }
  }

  const downloadScreen = (session: Session): void => {
    const result = addSessionToDownload(session, 'screen')
    if (!result.added) {
      alert(t('sessions.alreadyInDownloadQueueScreen'))
    } else {
      onSwitchToDownload(result.item.id)
    }
  }

  // Batch actions
  const addAllToQueue = (): void => {
    let addedCount = 0
    sessions.value.forEach(session => {
      const result = addSessionToTask(session)
      if (result.added) addedCount++
    })

    if (addedCount > 0) {
      onSwitchToTask()
      alert(t('sessions.addedToTaskQueue', { count: addedCount }))
    } else {
      alert(t('sessions.allInTaskQueue'))
    }
  }

  const downloadAllCamera = (): void => {
    let addedCount = 0
    sessions.value.forEach(session => {
      const result = addSessionToDownload(session, 'camera')
      if (result.added) addedCount++
    })

    if (addedCount > 0) {
      onSwitchToDownload()
      alert(t('sessions.addedToDownloadQueue', { count: addedCount }))
    } else {
      alert(t('sessions.allInDownloadQueue'))
    }
  }

  const downloadAllScreen = (): void => {
    let addedCount = 0
    sessions.value.forEach(session => {
      const result = addSessionToDownload(session, 'screen')
      if (result.added) addedCount++
    })

    if (addedCount > 0) {
      onSwitchToDownload()
      alert(t('sessions.addedToDownloadQueueScreen', { count: addedCount }))
    } else {
      alert(t('sessions.allInDownloadQueueScreen'))
    }
  }

  // Formatting utilities
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return 'N/A'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const getDayName = (day: number): string => {
    const dayNames = ['', 'sessions.monday', 'sessions.tuesday', 'sessions.wednesday', 'sessions.thursday', 'sessions.friday', 'sessions.saturday', 'sessions.sunday']
    const dayKey = dayNames[day]
    if (dayKey) {
      return t(dayKey)
    }
    return `${t('sessions.day')} ${day}`
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return {
    // State
    sessions,
    courseInfo,
    courseDetails,
    isLoading,
    errorMessage,
    showCourseDetails,

    // Navigation
    goBack,
    selectSession,

    // UI State
    toggleCourseDetails,

    // Data Loading
    loadCourseSessions,

    // Session actions
    addToQueue,
    downloadCamera,
    downloadScreen,

    // Batch actions
    addAllToQueue,
    downloadAllCamera,
    downloadAllScreen,

    // Formatting utilities
    formatDuration,
    getDayName,
    formatDate
  }
}
