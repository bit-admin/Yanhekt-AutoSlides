<template>
  <div class="session-page">
    <div class="header">
      <button @click="goBack" class="back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
        Back to Courses
      </button>
      <h2>{{ course?.title }} - Sessions</h2>
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
        <p>Loading sessions...</p>
      </div>

      <div v-else-if="!errorMessage" class="main-content">
        <div class="course-details">
          <p class="course-info">Course: {{ course?.title }}</p>
          <p class="instructor-info">Instructor: {{ course?.instructor }}</p>
          <p class="professor-info" v-if="courseInfo?.professor">Professor: {{ courseInfo.professor }}</p>
        </div>

        <div v-if="sessions.length === 0" class="no-sessions">
          <p>No sessions found for this course.</p>
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
              Add All to Tasks
            </button>
            <button @click="downloadAllCamera" class="batch-btn download-camera-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Download All Camera
            </button>
            <button @click="downloadAllScreen" class="batch-btn download-screen-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Download All Screen
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
                      Week {{ session.week_number }}, {{ getDayName(session.day) }}
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
                  <span class="action-text">Task</span>
                </button>
                <button @click.stop="downloadCamera(session)" class="action-btn camera-btn" title="Download Camera">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="action-text">Camera</span>
                </button>
                <button @click.stop="downloadScreen(session)" class="action-btn screen-btn" title="Download Screen">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span class="action-text">Screen</span>
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

const apiClient = new ApiClient()
const tokenManager = new TokenManager()
const sessions = ref<Session[]>([])
const courseInfo = ref<CourseInfoResponse | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')

const goBack = () => {
  emit('backToCourses')
}

const selectSession = (session: Session) => {
  // Store session data for playback
  DataStore.setSessionData(session.session_id, session)
  emit('sessionSelected', session)
}

const loadCourseSessions = async () => {
  if (!props.course) {
    errorMessage.value = 'No course selected'
    return
  }

  const token = tokenManager.getToken()
  if (!token) {
    errorMessage.value = 'Please login first'
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
    errorMessage.value = error.message || 'Failed to load course sessions'
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
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return dayNames[day] || `Day ${day}`
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
  DataStore.setSessionData(session.session_id, session)

  const added = TaskQueue.addToQueue({
    name: `slides_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || 'Unknown Course',
    sessionTitle: session.title,
    sessionId: session.session_id,
    courseId: props.course?.id || 'unknown'
  })

  if (!added) {
    alert('This session is already in the task queue')
  } else {
    // Switch to task tab
    switchToTaskTab()
  }
}

const downloadCamera = (session: Session) => {
  // Store session data for download service to access
  DataStore.setSessionData(session.session_id, session)

  const added = DownloadService.addToQueue({
    name: `camera_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || 'Unknown Course',
    sessionTitle: session.title,
    sessionId: session.session_id,
    videoType: 'camera'
  })

  if (!added) {
    alert('This camera video is already in the download queue')
  } else {
    // Switch to download tab
    switchToDownloadTab()
  }
}

const downloadScreen = (session: Session) => {
  // Store session data for download service to access
  DataStore.setSessionData(session.session_id, session)

  const added = DownloadService.addToQueue({
    name: `screen_${props.course?.title}_${session.title}`,
    courseTitle: props.course?.title || 'Unknown Course',
    sessionTitle: session.title,
    sessionId: session.session_id,
    videoType: 'screen'
  })

  if (!added) {
    alert('This screen video is already in the download queue')
  } else {
    // Switch to download tab
    switchToDownloadTab()
  }
}

const addAllToQueue = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for task processing
    DataStore.setSessionData(session.session_id, session)

    const added = TaskQueue.addToQueue({
      name: `slides_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || 'Unknown Course',
      sessionTitle: session.title,
      sessionId: session.session_id,
      courseId: props.course?.id || 'unknown'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToTaskTab()
    alert(`Added ${addedCount} sessions to task queue`)
  } else {
    alert('All sessions are already in the task queue')
  }
}

const downloadAllCamera = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for download service to access
    DataStore.setSessionData(session.session_id, session)

    const added = DownloadService.addToQueue({
      name: `camera_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || 'Unknown Course',
      sessionTitle: session.title,
      sessionId: session.session_id,
      videoType: 'camera'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToDownloadTab()
    alert(`Added ${addedCount} camera videos to download queue`)
  } else {
    alert('All camera videos are already in the download queue')
  }
}

const downloadAllScreen = () => {
  let addedCount = 0
  sessions.value.forEach(session => {
    // Store session data for download service to access
    DataStore.setSessionData(session.session_id, session)

    const added = DownloadService.addToQueue({
      name: `screen_${props.course?.title}_${session.title}`,
      courseTitle: props.course?.title || 'Unknown Course',
      sessionTitle: session.title,
      sessionId: session.session_id,
      videoType: 'screen'
    })
    if (added) addedCount++
  })

  if (addedCount > 0) {
    switchToDownloadTab()
    alert(`Added ${addedCount} screen videos to download queue`)
  } else {
    alert('All screen videos are already in the download queue')
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
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
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

.course-details {
  margin-bottom: 24px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.course-info, .instructor-info, .professor-info {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.no-sessions {
  text-align: center;
  padding: 48px 16px;
  color: #666;
  font-style: italic;
}

</style>