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
      <p class="placeholder">Session selection will be implemented here</p>
      <p class="course-info">Course: {{ course?.title }}</p>
      <p class="instructor-info">Instructor: {{ course?.instructor }}</p>

      <div class="sessions-list">
        <div
          v-for="session in mockSessions"
          :key="session.id"
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
            <p>{{ session.date }} - {{ session.duration }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Course {
  id: string
  title: string
  instructor: string
  time: string
}

interface Session {
  id: string
  title: string
  date: string
  duration: string
}

const props = defineProps<{
  course: Course | null
}>()

const emit = defineEmits<{
  sessionSelected: [session: Session]
  backToCourses: []
}>()

const mockSessions = ref<Session[]>([
  { id: '1', title: 'Session 1: Introduction', date: '2024-01-15', duration: '1h 30m' },
  { id: '2', title: 'Session 2: Basic Concepts', date: '2024-01-22', duration: '1h 45m' },
  { id: '3', title: 'Session 3: Advanced Topics', date: '2024-01-29', duration: '2h 00m' },
  { id: '4', title: 'Session 4: Practice Session', date: '2024-02-05', duration: '1h 15m' },
])

const goBack = () => {
  emit('backToCourses')
}

const selectSession = (session: Session) => {
  emit('sessionSelected', session)
}
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
</style>