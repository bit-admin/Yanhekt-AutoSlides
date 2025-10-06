<template>
  <div class="session-page">
    <div class="header">
      <div class="header-main">
        <button @click="goBack" class="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2>{{ course?.title }}</h2>
        <button @click="toggleCourseDetails" class="expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="course-details">
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ course?.instructor }}</span>
        </div>
        <div v-if="course?.classrooms" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ course.classrooms.map(c => c.name).join(', ') }}</span>
        </div>
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.time') }}</span>
          <span class="detail-value">{{ course?.time }}</span>
        </div>
        <div v-if="course?.college_name" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ course.college_name }}</span>
        </div>
        <div v-if="course?.participant_count !== undefined" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.participants') }}</span>
          <span class="detail-value">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
      </div>
    </div>

    <div class="content">
      <div v-if="errorMessage" class="error-message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('sessions.loadingSessions') }}</p>
      </div>

      <div v-else-if="!errorMessage" class="main-content">

        <div v-if="sessions.length === 0" class="no-sessions">
          <p>{{ $t('sessions.noSessions') }}</p>
        </div>

        <div v-else class="sessions-container">
          <div class="batch-actions">
            <button @click="addAllToQueue" class="batch-btn add-all-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button @click="downloadAllCamera" class="batch-btn download-camera-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button @click="downloadAllScreen" class="batch-btn download-screen-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="sessions-list">
            <div
              v-for="session in sessions"
              :key="session.session_id"
              class="session-item"
              @click="selectSession(session)"
            >
              <div class="session-main">
                <div class="session-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <div class="session-info">
                  <div class="session-title">{{ session.title }}</div>
                  <div class="session-meta">
                    <span v-if="session.week_number && session.day" class="session-time">
                      {{ $t('sessions.week') }} {{ session.week_number }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ getDayName(session.day) }}
                    </span>
                    <span v-if="session.duration" class="session-duration">
                      {{ formatDuration(session.duration) }}
                    </span>
                    <span v-if="session.started_at" class="session-date">
                      {{ formatDate(session.started_at) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="session-actions">
                <button @click.stop="addToQueue(session)" class="action-btn add-btn" title="Add to Task">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span class="action-text">{{ $t('sessions.task') }}</span>
                </button>
                <button @click.stop="downloadCamera(session)" class="action-btn camera-btn" title="Download Camera">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="action-text">{{ $t('sessions.camera') }}</span>
                </button>
                <button @click.stop="downloadScreen(session)" class="action-btn screen-btn" title="Download Screen">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span class="action-text">{{ $t('sessions.screen') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClient, type SessionData, type CourseInfoResponse } from '../services/apiClient'
import { TokenManager } from '../services/authService'
import { DataStore } from '../services/dataStore'
import { DownloadService } from '../services/downloadService'
import { TaskQueue } from '../services/taskQueueService'

interface Course {
  id: string
  title: string
  instructor: string
  time: string
  classrooms?: { name: string }[]
  college_name?: string
  participant_count?: number
}

interface Session extends SessionData {
  // Extends SessionData from API client
}

const props = defineProps<{
  course: Course | null
}>()

const emit = defineEmits<{
  sessionSelected: [session: Session]
  backToCourses: []
  switchToDownload: []
  switchToTask: []
}>()

const { t: $t } = useI18n()

const apiClient = new ApiClient()
const tokenManager = new TokenManager()
const sessions = ref<Session[]>([])
const courseInfo = ref<CourseInfoResponse | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const showCourseDetails = ref(false)

const goBack = () => {
  emit('backToCourses')
}

const toggleCourseDetails = () => {
  showCourseDetails.value = !showCourseDetails.value
}

const selectSession = (session: Session) => {
  // Store session data for playback
  DataStore.setSessionData(session.session_id.toString(), session)
  emit('sessionSelected', session)
}

const loadCourseSessions = async () => {
  if (!props.course) {
    errorMessage.value = $t('sessions.noCourseSelected')
    return
  }

  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = $t('sessions.pleaseLoginFirst')
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await apiClient.getCourseInfo(props.course.id, token)
    courseInfo.value = response
    sessions.value = response.videos
  } catch (error: any) {
    console.error('Failed to load course sessions:', error)
    errorMessage.value = error.message || $t('sessions.failedToLoadSessions')
    sessions.value = []
  } finally {
    isLoading.value = false
  }
}

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
    return $t(dayKey)
  }
  return `${$t('sessions.day')} ${day}`
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

// Task functions
const addToQueue = (session: Session) => {
  // Store session data for task processing
  DataStore.setSessionData(session.session_id.toString(), session)

  const added = TaskQueue.addToQueue({
    name: `slides_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || $t('sessions.unknownCourse'),
    sessionTitle: session.title,
    sessionId: session.session_id.toString(),
    courseId: props.course?.id || 'unknown'
  })

  if (!added) {
    alert($t('sessions.alreadyInTaskQueue'))
  } else {
    // Switch to task tab
    switchToTaskTab()
  }
}

const downloadCamera = (session: Session) => {
  // Store session data for download service to access
  DataStore.setSessionData(session.session_id.toString(), session)

  const added = DownloadService.addToQueue({
    name: `camera_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || $t('sessions.unknownCourse'),
    sessionTitle: session.title,
    sessionId: session.session_id.toString(),
    videoType: 'camera'
  })

  if (!added) {
    alert($t('sessions.alreadyInDownloadQueue'))
  } else {
    // Switch to download tab
    switchToDownloadTab()
  }
}

const downloadScreen = (session: Session) => {
  // Store session data for download service to access
  DataStore.setSessionData(session.session_id.toString(), session)

  const added = DownloadService.addToQueue({
    name: `screen_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || $t('sessions.unknownCourse'),
    sessionTitle: session.title,
    sessionId: session.session_id.toString(),
    videoType: 'screen'
  })

  if (!added) {
    alert($t('sessions.alreadyInDownloadQueueScreen'))
  } else {
    // Switch to download tab
    switchToDownloadTab()
  }
}

const addAllToQueue = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for task processing
    DataStore.setSessionData(session.session_id.toString(), session)

    const added = TaskQueue.addToQueue({
      name: `slides_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || $t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      courseId: props.course?.id || 'unknown'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToTaskTab()
    alert($t('sessions.addedToTaskQueue', { count: addedCount }))
  } else {
    alert($t('sessions.allInTaskQueue'))
  }
}

const downloadAllCamera = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for download service to access
    DataStore.setSessionData(session.session_id.toString(), session)

    const added = DownloadService.addToQueue({
      name: `camera_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || $t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      videoType: 'camera'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToDownloadTab()
    alert($t('sessions.addedToDownloadQueue', { count: addedCount }))
  } else {
    alert($t('sessions.allInDownloadQueue'))
  }
}

const downloadAllScreen = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for download service to access
    DataStore.setSessionData(session.session_id.toString(), session)

    const added = DownloadService.addToQueue({
      name: `screen_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || $t('sessions.unknownCourse'),
      sessionTitle: session.title,
      sessionId: session.session_id.toString(),
      videoType: 'screen'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToDownloadTab()
    alert($t('sessions.addedToDownloadQueueScreen', { count: addedCount }))
  } else {
    alert($t('sessions.allInDownloadQueueScreen'))
  }
}

const switchToDownloadTab = () => {
  // Emit event to switch to download tab in RightPanel
  // This will be caught by the parent component
  emit('switchToDownload')
}

const switchToTaskTab = () => {
  // Emit event to switch to task tab in RightPanel
  // This will be caught by the parent component
  emit('switchToTask')
}

onMounted(() => {
  loadCourseSessions()
})
</script>

<style scoped>
.session-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.header {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f8f9fa;
  margin-bottom: 24px;
  overflow: hidden;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #007acc;
  color: #007acc;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-btn:hover {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.course-details {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.course-detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.placeholder {
  color: #666;
  font-style: italic;
  margin-bottom: 16px;
}

.course-info, .instructor-info {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sessions-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: 16px;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 4px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 48px;
}

.session-item:hover {
  background-color: #f0f8ff;
  box-shadow: 0 1px 3px rgba(0, 122, 204, 0.1);
}

.session-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.session-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #f0f8ff;
  border-radius: 6px;
  color: #007acc;
  flex-shrink: 0;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.session-meta span {
  white-space: nowrap;
}

.session-time {
  color: #007acc;
  font-weight: 500;
}

.session-duration {
  color: #666;
}

.session-date {
  color: #888;
}

.batch-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.batch-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;
}

.batch-btn:hover {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.add-all-btn {
  color: #28a745;
  border-color: #28a745;
}

.add-all-btn:hover {
  background-color: #d4edda;
  border-color: #1e7e34;
}

.download-camera-btn {
  color: #007acc;
  border-color: #007acc;
}

.download-camera-btn:hover {
  background-color: #e3f2fd;
  border-color: #0056b3;
}

.download-screen-btn {
  color: #6f42c1;
  border-color: #6f42c1;
}

.download-screen-btn:hover {
  background-color: #f3e5f5;
  border-color: #59359a;
}

.session-actions {
  width: 200px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
  gap: 2px;
}

.action-text {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-btn {
  color: #28a745;
  border-color: #28a745;
}

.add-btn:hover {
  background-color: #d4edda;
  border-color: #1e7e34;
}

.camera-btn {
  color: #007acc;
  border-color: #007acc;
}

.camera-btn:hover {
  background-color: #e3f2fd;
  border-color: #0056b3;
}

.screen-btn {
  color: #6f42c1;
  border-color: #6f42c1;
}

.screen-btn:hover {
  background-color: #f3e5f5;
  border-color: #59359a;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
  font-size: 14px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}


.no-sessions {
  text-align: center;
  padding: 48px 16px;
  color: #666;
  font-style: italic;
}

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.sessions-list {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.sessions-list:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.sessions-list::-webkit-scrollbar {
  width: 6px;
}

.sessions-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.sessions-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.sessions-list:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.sessions-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .session-page {
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .header {
    background-color: #2d2d2d;
    border: 1px solid #404040;
  }

  .header-main {
    background-color: #2d2d2d;
  }

  .header h2 {
    color: #e0e0e0;
  }

  .back-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #b0b0b0;
  }

  .back-btn:hover {
    border-color: #4da6ff;
    color: #4da6ff;
  }

  .expand-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #b0b0b0;
  }

  .expand-btn:hover {
    border-color: #4da6ff;
    background-color: #333;
  }

  .course-details {
    background-color: #2d2d2d;
    border-top: 1px solid #404040;
  }

  .detail-label {
    color: #b0b0b0;
  }

  .detail-value {
    color: #e0e0e0;
  }

  .error-message {
    background-color: #3d1a1a;
    border: 1px solid #5d2d2d;
    color: #ff6b6b;
  }

  .spinner {
    border: 3px solid #404040;
    border-top: 3px solid #4da6ff;
  }

  .sessions-container {
    background-color: #2d2d2d;
  }

  .sessions-list {
    background-color: #333;
  }

  .session-item {
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .session-item:hover {
    background-color: #1a2332;
  }

  .session-icon {
    background-color: #1a2332;
    color: #4da6ff;
  }

  .session-title {
    color: #e0e0e0;
  }

  .session-meta {
    color: #b0b0b0;
  }

  .session-time {
    color: #4da6ff;
  }

  .session-duration {
    color: #b0b0b0;
  }

  .session-date {
    color: #999;
  }

  .batch-actions {
    background-color: #333;
    border: 1px solid #404040;
  }

  .batch-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .batch-btn:hover {
    border-color: #4da6ff;
    background-color: #1a2332;
  }

  .add-all-btn {
    color: #66cc66;
    border-color: #66cc66;
  }

  .add-all-btn:hover {
    background-color: #1a3d1a;
    border-color: #4dcc4d;
  }

  .download-camera-btn {
    color: #4da6ff;
    border-color: #4da6ff;
  }

  .download-camera-btn:hover {
    background-color: #1a2332;
    border-color: #66b3ff;
  }

  .download-screen-btn {
    color: #cc99ff;
    border-color: #cc99ff;
  }

  .download-screen-btn:hover {
    background-color: #2d1a3d;
    border-color: #d9b3ff;
  }

  .action-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
  }

  .action-btn:hover {
    background-color: #333;
  }

  .add-btn {
    color: #66cc66;
    border-color: #66cc66;
  }

  .add-btn:hover {
    background-color: #1a3d1a;
    border-color: #4dcc4d;
  }

  .camera-btn {
    color: #4da6ff;
    border-color: #4da6ff;
  }

  .camera-btn:hover {
    background-color: #1a2332;
    border-color: #66b3ff;
  }

  .screen-btn {
    color: #cc99ff;
    border-color: #cc99ff;
  }

  .screen-btn:hover {
    background-color: #2d1a3d;
    border-color: #d9b3ff;
  }

  .no-sessions {
    color: #b0b0b0;
  }

  /* Scrollbar styles for dark mode */
  .sessions-list {
    scrollbar-color: transparent transparent;
  }

  .sessions-list:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .sessions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sessions-list::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .sessions-list:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .sessions-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }
}

</style>