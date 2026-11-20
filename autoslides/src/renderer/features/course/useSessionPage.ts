import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ApiClient, type SessionData, type CourseInfoResponse } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { snapshotSession, type SessionSnapshot } from '@shared/services/sessionSnapshot'
import { DownloadService, type DownloadItem, type DownloadQueueAddResult } from '@shared/services/downloadService'
import { TaskQueue, type TaskQueueAddResult } from '@shared/services/taskQueueService'
import {
  appGateDeps,
  downloadFileOf,
  gateMany,
  gateOne,
  keepExistingVideo,
  type EnqueueMode,
  type GateLecture,
  type GateManyResult,
} from '@shared/services/lectureOutputGate'
import { lectureLabel } from '@common/lectureNaming'
import type { Course } from './useCourseList'
import { lookupCourseById, needsListHydration } from './lookupCourseById'
import { upgradePinnedCourse } from './pinnedCourses'
import { createLogger } from '@shared/utils/logger';
import { localeTag } from '@shared/i18n'
const log = createLogger('SessionPage');

/** The slice of `Course` the sessions page consumes (a thin/pinned course may carry only this). */
export type SessionCourse = Pick<
  Course,
  | 'id' | 'title' | 'titleEn' | 'number' | 'instructor' | 'time'
  | 'classrooms' | 'college_name' | 'participant_count'
  | 'professors' | 'school_year' | 'semester'
>

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
  addToQueue: (session: Session) => Promise<void>
  downloadCamera: (session: Session) => Promise<void>
  downloadScreen: (session: Session) => Promise<void>
  downloadAudio: (session: Session) => Promise<void>

  // Batch actions
  addAllToQueue: () => Promise<void>
  downloadAllCamera: () => Promise<void>
  downloadAllScreen: () => Promise<void>
  downloadAllAudio: () => Promise<void>

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

  // Rich course fields filled in loadCourseSessions. getCourseInfo supplies
  // instructor / professors / term / college; list-only fields (classrooms,
  // participant_count) come from `lookupCourseById` when the incoming course
  // did not already carry them (grid/search handoff).
  const fetchedCourseInfo = ref<Partial<SessionCourse>>({})

  // The incoming course merged with fetched fields. Incoming values win (the
  // course-grid path already has everything); fetched values fill the gaps.
  const courseDetails = computed<SessionCourse | null>(() => {
    const base = course.value
    if (!base) return null
    const extra = fetchedCourseInfo.value
    return {
      ...base,
      title: base.title || extra.title || '',
      titleEn: base.titleEn || extra.titleEn,
      number: base.number || extra.number,
      instructor: base.instructor || extra.instructor || '',
      professors: base.professors && base.professors.length > 0 ? base.professors : extra.professors,
      college_name: base.college_name || extra.college_name,
      school_year: base.school_year || extra.school_year,
      semester: base.semester || extra.semester,
      time: base.time || extra.time || '',
      classrooms: base.classrooms && base.classrooms.length > 0 ? base.classrooms : extra.classrooms,
      participant_count: base.participant_count ?? extra.participant_count,
    }
  })

  // The session as queued, with the merged course facts, for the item to carry.
  const snapshotOf = (session: Session): SessionSnapshot =>
    snapshotSession(session, courseDetails.value)

  // Helper: Add session to download queue
  const downloadNameOf = (session: Session, videoType: DownloadItem['videoType']): string =>
    `${videoType}_${lectureLabel(course.value?.title, session.title)}`

  const addSessionToDownload = (
    session: Session,
    videoType: DownloadItem['videoType'],
    mode: EnqueueMode = 'download',
  ): DownloadQueueAddResult => {
    // `name` stays the raw human-readable label — it is sanitized once, later,
    // by buildDownloadFileName (sanitizeDownloadName, which differs from
    // sanitizeFileName on path separators). The ids ride alongside so that
    // helper can disambiguate the .mp4 path at dispatch time.
    return DownloadService.addToQueue({
      name: downloadNameOf(session, videoType),
      courseTitle: course.value?.title || t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      courseId: course.value?.id,
      // So the extracted folder's metadata.json has it in its first write.
      courseNumber: courseDetails.value?.number,
      videoType,
      session: snapshotOf(session),
    }, mode === 'existing' ? keepExistingVideo : undefined)
  }

  // Issue #45: what each session already has decides whether it is queued.
  const lectureOf = (session: Session, videoType?: 'camera' | 'screen' | 'audio'): GateLecture => {
    const sessionId = session.session_id.toString()
    return {
      key: sessionId,
      courseId: course.value?.id != null ? String(course.value.id) : undefined,
      sessionId,
      videoFile: videoType
        ? downloadFileOf({ name: downloadNameOf(session, videoType), courseId: course.value?.id, sessionId }, videoType)
        : undefined,
    }
  }
  const sessionByKey = (lecture: GateLecture): Session | undefined =>
    sessions.value.find((s) => s.session_id.toString() === lecture.key)

  const downloadGate = (videoType: 'camera' | 'screen' | 'audio') =>
    appGateDeps<DownloadQueueAddResult>(t, (lecture, mode) => {
      const session = sessionByKey(lecture)
      if (!session) throw new Error(`Session ${lecture.key} is not on this page`)
      return addSessionToDownload(session, videoType, mode)
    })
  const taskGate = () =>
    appGateDeps<TaskQueueAddResult>(t, (lecture) => {
      const session = sessionByKey(lecture)
      if (!session) throw new Error(`Session ${lecture.key} is not on this page`)
      return addSessionToTask(session)
    })

  // Helper: Add session to task queue
  const addSessionToTask = (session: Session): TaskQueueAddResult => {
    // Display label only — the real folder is named by useSlideExtraction.
    return TaskQueue.addToQueue({
      name: `slides_${lectureLabel(course.value?.title, session.title)}`,
      courseTitle: course.value?.title || t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      courseId: course.value?.id || 'unknown',
      session: snapshotOf(session),
    })
  }

  // Navigation
  const goBack = (): void => {
    onBackToCourses()
  }

  const selectSession = (session: Session): void => {
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
      errorMessage.value = ''
      isLoading.value = false
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      const courseId = course.value.id
      // Sessions always need getCourseInfo. List lookup runs in parallel only
      // when classrooms are missing — grid/search handoffs already have them.
      const infoPromise = apiClient.getCourseInfo(courseId, token)
      const listPromise = needsListHydration(course.value)
        ? lookupCourseById(token, courseId)
        : Promise.resolve(null)

      const [response, listCourse] = await Promise.all([infoPromise, listPromise])
      courseInfo.value = response
      sessions.value = response.videos

      // Hydrate the rich fields a thin/pinned course lacks. semester is a number
      // here (vs a string from the course list) — normalize to string. Derive a
      // display term ("2025-2026 Fall") matching useCourseList's formatting.
      // Classrooms / participant_count come only from the list lookup.
      const semesterStr = response.semester != null ? String(response.semester) : undefined
      fetchedCourseInfo.value = {
        title: response.title,
        titleEn: response.title_en,
        number: response.number || listCourse?.number,
        instructor: response.professor,
        professors: response.professors,
        college_name: response.college_name || listCourse?.college_name,
        school_year: response.school_year || listCourse?.school_year,
        semester: semesterStr || listCourse?.semester,
        time: response.school_year
          ? `${response.school_year} ${Number(response.semester) === 1 ? 'Fall' : 'Spring'}`
          : listCourse?.time,
        classrooms: listCourse?.classrooms,
        participant_count: listCourse?.participant_count,
      }

      // Self-heal a thin pin (classrooms, registrar number, term) so the next
      // cold open needs no list hop. Earlier-term pins are never refreshed by
      // the subscription sync, so this is how they gain a number. No-op when
      // this course is not pinned or nothing changed.
      upgradePinnedCourse({
        ...(listCourse ?? {}),
        id: courseId,
        ...fetchedCourseInfo.value,
        title: response.title || listCourse?.title || '',
        instructor: response.professor || listCourse?.instructor || '',
        professors: (response.professors && response.professors.length > 0)
          ? response.professors
          : listCourse?.professors,
        time: fetchedCourseInfo.value.time || '',
        classrooms: listCourse?.classrooms,
        participant_count: listCourse?.participant_count,
      })
    } catch (error: unknown) {
      log.error('Failed to load course sessions:', error)
      const errorMsg = error instanceof Error ? error.message : t('sessions.failedToLoadSessions')
      errorMessage.value = errorMsg
      sessions.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Queue notices — app dialog instead of the thread-blocking native alert().
  const notify = (message: string): void => {
    void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
  }

  // Session actions
  const addToQueue = async (session: Session): Promise<void> => {
    const result = await gateOne(taskGate(), 'task', lectureOf(session))
    if (!result) return
    if (!result.added) {
      notify(t('sessions.alreadyInTaskQueue'))
    } else {
      onSwitchToTask(result.item.id)
    }
  }

  const downloadCamera = async (session: Session): Promise<void> => {
    const result = await gateOne(downloadGate('camera'), 'camera', lectureOf(session, 'camera'))
    if (!result) return
    if (!result.added) {
      notify(t('sessions.alreadyInDownloadQueue'))
    } else {
      onSwitchToDownload(result.item.id)
    }
  }

  const downloadScreen = async (session: Session): Promise<void> => {
    const result = await gateOne(downloadGate('screen'), 'screen', lectureOf(session, 'screen'))
    if (!result) return
    if (!result.added) {
      notify(t('sessions.alreadyInDownloadQueueScreen'))
    } else {
      onSwitchToDownload(result.item.id)
    }
  }

  /**
   * Mic audio is resolved lazily, on click.
   *
   * The session list does not carry the mic URL — only GET /v1/video does — so
   * the button cannot know in advance whether this lecture has one. Probing
   * every row up front would cost one request per session on every course-page
   * open, for a track most lectures do not have. Resolving here costs one
   * request, and ApiClient memoises the answer (including "none") for the rest
   * of the session, so the queue's own later lookup is free.
   */
  const downloadAudio = async (session: Session): Promise<void> => {
    const audioUrl = await apiClient.getMicAudioUrl(session.video_id, tokenManager.getToken() || '')
    if (!audioUrl) {
      notify(t('sessions.noMicAudio'))
      return
    }

    const result = await gateOne(downloadGate('audio'), 'audio', lectureOf(session, 'audio'))
    if (!result) return
    if (!result.added) {
      notify(t('sessions.alreadyInDownloadQueueAudio'))
    } else {
      onSwitchToDownload(result.item.id)
    }
  }

  // Batch actions. One summary at the end; already-done sessions can be
  // redone from it (issue #45).
  const batchSummary = (addedKey: string, allKey: string) => (r: GateManyResult) => ({
    title: t('lectureOutputs.batchTitle'),
    message: [
      r.added > 0 ? t(addedKey, { count: r.added }) : r.queued > 0 ? t(allKey) : '',
      t('lectureOutputs.skippedDone', { count: r.skipped }),
    ].filter(Boolean).join('\n'),
  })

  const finishBatch = (
    r: GateManyResult,
    addedKey: string,
    allKey: string,
    switchTo: () => void,
  ): void => {
    if (r.added + r.redone > 0) switchTo()
    if (r.skipped > 0) {
      // The gate already showed its summary; only failures to move old outputs are new.
      if (r.failed > 0) notify(t('lectureOutputs.retireFailed', { count: r.failed }))
      return
    }
    if (r.failed > 0) notify(t('lectureOutputs.retireFailed', { count: r.failed }))
    else if (r.added > 0) notify(t(addedKey, { count: r.added }))
    else if (r.redone === 0) notify(t(allKey))
  }

  const addAllToQueue = async (): Promise<void> => {
    const keys = ['sessions.addedToTaskQueue', 'sessions.allInTaskQueue'] as const
    const r = await gateMany(taskGate(), 'task', sessions.value.map((s) => lectureOf(s)), batchSummary(...keys))
    finishBatch(r, ...keys, () => onSwitchToTask())
  }

  const downloadAllCamera = async (): Promise<void> => {
    const keys = ['sessions.addedToDownloadQueue', 'sessions.allInDownloadQueue'] as const
    const r = await gateMany(downloadGate('camera'), 'camera', sessions.value.map((s) => lectureOf(s, 'camera')), batchSummary(...keys))
    finishBatch(r, ...keys, () => onSwitchToDownload())
  }

  const downloadAllScreen = async (): Promise<void> => {
    const keys = ['sessions.addedToDownloadQueueScreen', 'sessions.allInDownloadQueueScreen'] as const
    const r = await gateMany(downloadGate('screen'), 'screen', sessions.value.map((s) => lectureOf(s, 'screen')), batchSummary(...keys))
    finishBatch(r, ...keys, () => onSwitchToDownload())
  }

  /**
   * Resolve every session's mic URL, then queue the ones that have one.
   *
   * Capped concurrency because this is the one place that fans out: a course
   * can hold 30+ sessions and firing them all at once would hammer cbiz for no
   * gain. Sessions with no mic track are skipped silently — that is the normal
   * case, not an error worth a dialog per row.
   */
  const downloadAllAudio = async (): Promise<void> => {
    const token = tokenManager.getToken() || ''
    const all = [...sessions.value]
    const withAudio: Session[] = []

    const CONCURRENCY = 4
    let cursor = 0
    const worker = async (): Promise<void> => {
      while (cursor < all.length) {
        const session = all[cursor++]
        if (await apiClient.getMicAudioUrl(session.video_id, token)) {
          withAudio.push(session)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, all.length) }, worker))

    if (withAudio.length === 0) {
      notify(t('sessions.noMicAudioAny'))
      return
    }

    const keys = ['sessions.addedToDownloadQueueAudio', 'sessions.allInDownloadQueueAudio'] as const
    const r = await gateMany(downloadGate('audio'), 'audio', withAudio.map((s) => lectureOf(s, 'audio')), batchSummary(...keys))
    finishBatch(r, ...keys, () => onSwitchToDownload())
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
      return date.toLocaleDateString(localeTag(), {
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
    downloadAudio,

    // Batch actions
    addAllToQueue,
    downloadAllCamera,
    downloadAllScreen,
    downloadAllAudio,

    // Formatting utilities
    formatDuration,
    getDayName,
    formatDate
  }
}
