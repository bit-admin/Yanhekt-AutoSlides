<template>
  <div class="session-page">
    <div class="header">
      <div class="header-main">
        <button @click="goBack" class="btn btn--lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2>{{ course?.title }}</h2>
        <button @click="toggleCourseDetails" class="btn expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="course-details">
        <div class="course-detail-item" v-if="course?.instructor">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ course.instructor }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.professors && course.professors.length > 0">
          <span class="detail-label">{{ $t('playback.professors') }}</span>
          <span class="detail-value">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.time">
          <span class="detail-label">{{ $t('sessions.academicTerm') }}</span>
          <span class="detail-value">{{ course.time }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.classrooms && course.classrooms.length > 0">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ course.classrooms.map((c: { name: string }) => c.name).join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.college_name">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ course.college_name }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.participant_count !== undefined">
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
            <button @click="addAllToQueue" class="btn batch-btn add-all-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button @click="downloadAllCamera" class="btn batch-btn download-camera-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button @click="downloadAllScreen" class="btn batch-btn download-screen-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="sessions-list custom-scrollbar">
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
                <button @click.stop="addToQueue(session)" class="action-btn add-btn" :title="$t('sessions.addToTask')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span class="action-text">{{ $t('sessions.task') }}</span>
                </button>
                <button @click.stop="downloadCamera(session)" class="action-btn camera-btn" :title="$t('sessions.downloadCamera')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="action-text">{{ $t('sessions.camera') }}</span>
                </button>
                <button @click.stop="downloadScreen(session)" class="action-btn screen-btn" :title="$t('sessions.downloadScreen')">
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
import { onMounted, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionPage, type SessionCourse, type Session } from '@features/course/useSessionPage'

const props = defineProps<{
  course: SessionCourse | null
}>()

const emit = defineEmits<{
  sessionSelected: [session: Session]
  backToCourses: []
  switchToDownload: [downloadItemId?: string]
  switchToTask: [taskId?: string]
}>()

const { t } = useI18n()

const {
  sessions,
  isLoading,
  errorMessage,
  showCourseDetails,
  goBack,
  selectSession,
  toggleCourseDetails,
  loadCourseSessions,
  addToQueue,
  downloadCamera,
  downloadScreen,
  addAllToQueue,
  downloadAllCamera,
  downloadAllScreen,
  formatDuration,
  getDayName,
  formatDate
} = useSessionPage({
  course: toRef(() => props.course),
  t,
  onSessionSelected: (session: Session) => emit('sessionSelected', session),
  onBackToCourses: () => emit('backToCourses'),
  onSwitchToDownload: (downloadItemId?: string) => emit('switchToDownload', downloadItemId),
  onSwitchToTask: (taskId?: string) => emit('switchToTask', taskId)
})

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
  background-color: var(--bg-modal);
  color: var(--text-primary);
}

.header {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-elevated);
  margin-bottom: 24px;
  overflow: hidden;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--bg-modal);
}

.header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.expand-btn {
  width: 32px;
  height: 32px;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.course-details {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-modal);
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
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.placeholder {
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 16px;
}

.course-info, .instructor-info {
  margin: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
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
  background-color: var(--bg-elevated);
  border-radius: 8px;
  padding: 4px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-modal);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 48px;
}

.session-item:hover {
  background-color: var(--badge-active-bg);
  box-shadow: 0 1px 3px var(--focus-ring);
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
  background-color: var(--badge-active-bg);
  border-radius: 6px;
  color: var(--accent);
  flex-shrink: 0;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.session-meta span {
  white-space: nowrap;
}

.session-time {
  color: var(--accent);
  font-weight: 500;
}

.session-duration {
  color: var(--text-secondary);
}

.session-date {
  color: var(--text-muted);
}

.batch-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.batch-btn {
  flex: 1;
  min-height: 36px;
}

.add-all-btn {
  color: var(--success);
  border-color: var(--success);
}

.add-all-btn:hover {
  background-color: var(--success-bg);
  border-color: var(--success-border);
}

.download-camera-btn {
  color: var(--accent);
  border-color: var(--accent);
}

.download-camera-btn:hover {
  background-color: var(--badge-active-bg);
  border-color: var(--accent-hover);
}

.download-screen-btn {
  color: var(--purple);
  border-color: var(--purple);
}

.download-screen-btn:hover {
  background-color: var(--purple-hover-bg);
  border-color: var(--purple-hover-border);
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
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-modal);
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
  box-shadow: 0 2px 4px var(--shadow-sm);
}

.add-btn {
  color: var(--success);
  border-color: var(--success);
}

.add-btn:hover {
  background-color: var(--success-bg);
  border-color: var(--success-border);
}

.camera-btn {
  color: var(--accent);
  border-color: var(--accent);
}

.camera-btn:hover {
  background-color: var(--badge-active-bg);
  border-color: var(--accent-hover);
}

.screen-btn {
  color: var(--purple);
  border-color: var(--purple);
}

.screen-btn:hover {
  background-color: var(--purple-hover-bg);
  border-color: var(--purple-hover-border);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 4px;
  color: var(--danger);
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
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--accent);
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
  color: var(--text-secondary);
  font-style: italic;
}


</style>
