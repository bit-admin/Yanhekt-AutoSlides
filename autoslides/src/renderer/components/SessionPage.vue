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

      <div v-else-if="!errorMessage">
        <div class="course-details">
          <p class="course-info">Course: {{ course?.title }}</p>
          <p class="instructor-info">Instructor: {{ course?.instructor }}</p>
          <p class="professor-info" v-if="courseInfo?.professor">Professor: {{ courseInfo.professor }}</p>
        </div>

        <div v-if="sessions.length === 0" class="no-sessions">
          <p>No sessions found for this course.</p>
        </div>

        <div v-else class="sessions-list">
          <div
            v-for="session in sessions"
            :key="session.session_id"
            class="session-item"
            @click="selectSession(session)"
          >
            <div class="session-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </div>
            <div class="session-info">
              <h3>{{ session.title }}</h3>
              <div class="session-details">
                <p v-if="session.week_number && session.day">Week {{ session.week_number }}, {{ getDayName(session.day) }}</p>
                <p v-if="session.duration">{{ formatDuration(session.duration) }}</p>
                <p class="session-dates" v-if="session.started_at">
                  {{ formatDate(session.started_at) }}
                  <span v-if="session.ended_at"> - {{ formatDate(session.ended_at) }}</span>
                </p>
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

.sessions-list {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.session-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
}

.session-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background-color: #f8f9fa;
  border-radius: 8px;
  color: #007acc;
}

.session-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.session-info p {
  margin: 0;
  font-size: 14px;
  color: #666;
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

.session-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-details p {
  margin: 0;
  font-size: 13px;
  color: #888;
}

.session-dates {
  font-weight: 500;
  color: #666 !important;
}
</style>