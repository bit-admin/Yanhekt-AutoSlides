import { ref, type Ref } from 'vue'
import { ApiClient, type SessionData, type CourseInfoResponse } from '../services/apiClient'
import { TokenManager } from '../services/authService'
import { DataStore } from '../services/dataStore'
import { DownloadService } from '../services/downloadService'
import { TaskQueue } from '../services/taskQueueService'

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
  onSwitchToDownload: () => void
  onSwitchToTask: () => void
}

export interface UseSessionPageReturn {
  // State
  sessions: Ref<Session[]>
  courseInfo: Ref<CourseInfoResponse | null>
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
  const tokenManager = new TokenManager()

  // State
  const sessions = ref<Session[]>([])
  const courseInfo = ref<CourseInfoResponse | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref('')
  const showCourseDetails = ref(false)

  // Helper: Store session data with course information
  const storeSessionData = (session: Session): void => {
    if (course.value) {
      DataStore.setSessionDataWithCourse(session.session_id.toString(), session, {
        id: course.value.id,
        title: course.value.title,
        instructor: course.value.instructor,
        time: course.value.time,
        classrooms: course.value.classrooms,
        college_name: course.value.college_name,
        participant_count: course.value.participant_count
      })
    } else {
      DataStore.setSessionData(session.session_id.toString(), session)
    }
  }

  // Helper: Add session to download queue
  const addSessionToDownload = (session: Session, videoType: 'camera' | 'screen'): boolean => {
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
  const addSessionToTask = (session: Session): boolean => {
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
    } catch (error: unknown) {
      console.error('Failed to load course sessions:', error)
      const errorMsg = error instanceof Error ? error.message : t('sessions.failedToLoadSessions')
      errorMessage.value = errorMsg
      sessions.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Session actions
  const addToQueue = (session: Session): void => {
    const added = addSessionToTask(session)
    if (!added) {
      alert(t('sessions.alreadyInTaskQueue'))
    } else {
      onSwitchToTask()
    }
  }

  const downloadCamera = (session: Session): void => {
    const added = addSessionToDownload(session, 'camera')
    if (!added) {
      alert(t('sessions.alreadyInDownloadQueue'))
    } else {
      onSwitchToDownload()
    }
  }

  const downloadScreen = (session: Session): void => {
    const added = addSessionToDownload(session, 'screen')
    if (!added) {
      alert(t('sessions.alreadyInDownloadQueueScreen'))
    } else {
      onSwitchToDownload()
    }
  }

  // Batch actions
  const addAllToQueue = (): void => {
    let addedCount = 0
    sessions.value.forEach(session => {
      const added = addSessionToTask(session)
      if (added) addedCount++
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
      const added = addSessionToDownload(session, 'camera')
      if (added) addedCount++
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
      const added = addSessionToDownload(session, 'screen')
      if (added) addedCount++
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
