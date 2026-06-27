<template>
  <div class="session-page">
    <div class="header">
      <div class="header-main">
        <button @click="goBack" class="btn btn--ghost back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2>{{ course?.title }}</h2>
        <button
          @click="togglePin"
          class="btn pin-btn"
          :class="{ active: pinned }"
          :title="pinned ? $t('sessions.unpin') : $t('sessions.pin')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" :fill="pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"/>
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
          </svg>
        </button>
        <button @click="toggleCourseDetails" class="btn expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="course-details">
        <div class="course-detail-item" v-if="courseDetails?.instructor">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ courseDetails.instructor }}</span>
        </div>
        <div class="course-detail-item" v-if="courseDetails?.professors && courseDetails.professors.length > 0">
          <span class="detail-label">{{ $t('playback.professors') }}</span>
          <span class="detail-value">{{ courseDetails.professors.join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="courseDetails?.time">
          <span class="detail-label">{{ $t('sessions.academicTerm') }}</span>
          <span class="detail-value">{{ courseDetails.time }}</span>
        </div>
        <div class="course-detail-item" v-if="courseDetails?.classrooms && courseDetails.classrooms.length > 0">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ courseDetails.classrooms.map((c: { name: string }) => c.name).join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="courseDetails?.college_name">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ courseDetails.college_name }}</span>
        </div>
        <div class="course-detail-item" v-if="courseDetails?.participant_count !== undefined">
          <span class="detail-label">{{ $t('sessions.participants') }}</span>
          <span class="detail-value">{{ courseDetails.participant_count }} {{ $t('sessions.participantsCount') }}</span>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                </button>
                <button @click.stop="downloadCamera(session)" class="action-btn camera-btn" :title="$t('sessions.downloadCamera')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
                <button @click.stop="downloadScreen(session)" class="action-btn screen-btn" :title="$t('sessions.downloadScreen')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
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
import { computed, onMounted, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionPage, type SessionCourse, type Session } from '@features/course/useSessionPage'
import { isPinned, togglePinnedCourse } from '@features/course/pinnedCourses'

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
  courseDetails,
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

const pinned = computed(() => !!props.course?.id && isPinned(props.course.id))

const togglePin = () => {
  // Pin the merged course so classrooms/participants/term (present when opened
  // from the grid/search) are captured for later restoration.
  const c = courseDetails.value
  if (!c?.id) return
  togglePinnedCourse(c)
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
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Apple Music style title band: full-width tinted bar, hairline underline */
.header {
  flex-shrink: 0;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
}

.back-btn {
  flex-shrink: 0;
}

.header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--text-primary);
  flex: 1;
}

/* Square 32×32 icon button — padding:0 so the chevron is not crushed by
   .btn's horizontal padding under box-sizing: border-box. */
.expand-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

/* Square 32×32 icon button, matching .expand-btn. Accent when pinned. */
.pin-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
}

.pin-btn.active {
  color: var(--accent);
}

.course-details {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
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
  padding: 0 24px 16px;
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
  gap: 8px;
  padding: 2px;
  padding-right: 10px;
}

/* Bordered cards that highlight their border + lift on hover (matches CoursePage) */
.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 48px;
}

.session-item:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--focus-ring);
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
  gap: 10px;
  margin-bottom: 16px;
}

/* Soft tonal chips: tinted fill, neutral hairline border (color carried by the
   fill), solid colored fill on hover */
.batch-btn {
  flex: 1;
  min-height: 38px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.add-all-btn {
  color: var(--success);
  background-color: var(--success-bg);
}

.add-all-btn:hover {
  background-color: var(--success);
  border-color: var(--success);
  color: var(--text-on-accent);
}

.download-camera-btn {
  color: var(--accent);
  background-color: var(--badge-active-bg);
}

.download-camera-btn:hover {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.download-screen-btn {
  color: var(--purple);
  background-color: var(--purple-badge-bg);
}

.download-screen-btn:hover {
  background-color: var(--purple);
  border-color: var(--purple);
  color: var(--text-on-accent);
}

.session-actions {
  width: 108px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* Quiet monochrome icon buttons: grey at rest, tint to their color on hover */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.add-btn:hover {
  background-color: var(--success-bg);
  color: var(--success);
}

.camera-btn:hover {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.screen-btn:hover {
  background-color: var(--purple-hover-bg);
  color: var(--purple);
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
  padding: 48px 16px;
}

.no-sessions {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
  font-style: italic;
}


</style>
