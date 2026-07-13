<template>
  <div class="session-page">
    <div class="session-layout">
      <!-- Left Column: Playlist Details (Sticky on desktop, stacks on mobile) -->
      <div class="playlist-sidebar">
        <!-- Back button styled like a ghost header nav -->
        <button @click="goBack" class="btn btn--ghost back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          <span>{{ $t('sessions.backToCourses') }}</span>
        </button>

        <div class="playlist-card">
          <!-- Playlist Thumbnail Cover -->
          <div class="playlist-cover-container">
            <img :src="getCourseCover(course?.id)" class="playlist-cover" alt="" />
            <div v-if="courseDetails?.title" class="video-cover-overlay-text" :style="getOverlayTextStyle(courseDetails.title)">
              {{ courseDetails.title }}
            </div>
            <div class="playlist-cover-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9H2V11H19V9ZM19 5H2V7H19V5ZM2 15H15V13H2V15ZM17 13V19L22 16L17 13Z"/>
              </svg>
              <span>{{ sessions.length }} {{ $t('playback.duration') !== 'Duration' ? '节课' : 'sessions' }}</span>
            </div>
          </div>

          <!-- Playlist Details -->
          <div class="playlist-info">
            <h2 class="playlist-title">{{ courseDetails?.title }}</h2>
            
            <!-- YouTube Subscribe Style Pin Button -->
            <div class="playlist-actions">
              <button
                @click="toggleSubscribe"
                class="btn subscribe-btn"
                :class="{ 'subscribed': subscribed }"
                :title="subscribed ? $t('sessions.unsubscribe') : $t('sessions.subscribe')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="subscribed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span>{{ subscribed ? $t('navigation.pinned') : $t('sessions.subscribe') }}</span>
              </button>
            </div>

            <!-- Course Meta details -->
            <div class="course-details">
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
        </div>
      </div>

      <!-- Right Column: Playlist Videos List -->
      <div class="playlist-videos-container">
        <div v-if="errorMessage" class="error-message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('sessions.loadingSessions') }}</p>
        </div>

        <div v-else class="playlist-list-wrap">
          <div v-if="sessions.length === 0" class="no-sessions">
            <p>{{ $t('sessions.noSessions') }}</p>
          </div>

          <div v-else ref="listEl" class="sessions-list custom-scrollbar">
            <!-- YouTube horizontal list item -->
            <div
              v-for="(session, index) in sessions"
              :key="session.session_id"
              class="session-row-item"
              @click="selectSession(session)"
            >
              <!-- Index number -->
              <div class="session-index">{{ index + 1 }}</div>

              <!-- Mini 16:9 Thumbnail -->
              <div class="session-mini-thumb">
                <img :src="getCourseCover(course?.id)" class="session-thumb-img" alt="" />
                <span v-if="session.duration" class="session-duration-badge">
                  {{ formatDurationBadge(session.duration) }}
                </span>
                <div class="session-thumb-hover">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="8,5 19,12 8,19"/>
                  </svg>
                </div>
              </div>

              <!-- Text Info -->
              <div class="session-details">
                <h4 class="session-title-text">{{ session.title }}</h4>
                <div class="session-meta-row">
                  <span v-if="session.week_number && session.day" class="session-tag">
                    {{ $t('sessions.week') }} {{ session.week_number }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ getDayName(session.day) }}
                  </span>
                  <span v-if="session.started_at" class="session-date-text">
                    {{ formatDate(session.started_at) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionPage, type SessionCourse, type Session } from '../../composables/useSessionPage'
import { isSubscribed, toggleSubscribedCourse } from '../../composables/subscribedCourses'
import { getCourseCover, getOverlayTextStyle } from '../../composables/courseCover'
import { useKeepScroll } from '../../composables/useKeepScroll'

const props = defineProps<{
  course: SessionCourse | null
}>()

// Cached via the RecordedCourseRoute wrapper; activated/deactivated propagate.
const listEl = ref<HTMLElement | null>(null)
useKeepScroll(listEl)

const emit = defineEmits<{
  // Emits the merged course details alongside the session: getCourseInfo
  // fields fetched here (title, professors, term…) must reach the player,
  // since a cold-loaded route only had a minimal course stub.
  sessionSelected: [session: Session, course: SessionCourse | null]
  backToCourses: []
}>()

const { t } = useI18n()

const {
  sessions,
  isLoading,
  errorMessage,
  courseDetails,
  goBack,
  selectSession,
  loadCourseSessions,
  getDayName,
  formatDate
} = useSessionPage({
  course: toRef(() => props.course),
  t,
  onSessionSelected: (session: Session) => emit('sessionSelected', session, courseDetails.value),
  onBackToCourses: () => emit('backToCourses')
})

const subscribed = computed(() => !!props.course?.id && isSubscribed(props.course.id))
const toggleSubscribe = () => {
  const c = courseDetails.value
  if (!c?.id) return
  toggleSubscribedCourse(c)
}

// Formats seconds into HH:MM:SS or MM:SS for duration badge
const formatDurationBadge = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  loadCourseSessions()
})
</script>

<style scoped>
.session-page {
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.session-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* Playlist Sidebar (Sticky Left Panel) */
.playlist-sidebar {
  width: 24rem;
  background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-page) 100%);
  border-right: 1px solid var(--border-color);
  padding: 1.5rem 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.back-btn {
  align-self: flex-start;
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  margin-left: -0.5rem;
}

.playlist-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.playlist-cover-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.playlist-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-cover-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 15, 15, 0.8);
  backdrop-filter: blur(4px);
  color: #ffffff;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.playlist-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.playlist-title {
  margin: 0;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.8rem;
  color: var(--text-primary);
}

/* Subscribe pill button */
.playlist-actions {
  display: flex;
  gap: 0.5rem;
  margin: 0.25rem 0;
}

.subscribe-btn {
  background-color: var(--text-primary);
  border-color: var(--text-primary);
  color: var(--bg-page-alt);
  font-weight: 600;
  padding: 0.5rem 1.25rem;
  height: var(--control-height);
  border-radius: 6.25rem;
}

.subscribe-btn:hover {
  opacity: 0.9;
}

.subscribe-btn.subscribed {
  background-color: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.subscribe-btn.subscribed:hover {
  background-color: var(--bg-hover);
  filter: brightness(0.9);
}

/* Course details grid */
.course-details {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin-top: 0.5rem;
}

.course-detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05rem;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

/* Right Content: Videos List */
.playlist-videos-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 1.5rem;
}

.playlist-list-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

/* YouTube Horizontal Session Row */
.session-row-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
  user-select: none;
}

.session-row-item:hover {
  background-color: var(--bg-hover);
}

.session-index {
  width: 2.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-align: center;
  flex-shrink: 0;
}

.session-mini-thumb {
  position: relative;
  width: 7.5rem;
  aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: var(--bg-elevated);
  flex-shrink: 0;
  margin-right: 1.25rem;
}

.session-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.session-duration-badge {
  position: absolute;
  bottom: 0.25rem;
  right: 0.25rem;
  background-color: rgba(15, 15, 15, 0.85);
  color: #ffffff;
  padding: 0.0625rem 0.25rem;
  border-radius: 0.1875rem;
  font-size: 0.6875rem;
  font-weight: 500;
}

.session-thumb-hover {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  opacity: 0;
  transition: opacity 0.15s;
}

.session-row-item:hover .session-thumb-hover {
  opacity: 1;
}

.session-details {
  flex: 1;
  min-width: 0;
}

.session-title-text {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.25rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.session-tag {
  color: var(--accent-deep);
  font-weight: 500;
}

.session-date-text {
  color: var(--text-muted);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 0.5rem;
  color: var(--danger-bright);
  font-size: 0.875rem;
}

.no-sessions {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.875rem;
}

/* Responsive breakpoint styling */
@media (max-width: 900px) {
  .session-layout {
    flex-direction: column;
    overflow-y: auto;
  }
  
  .playlist-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 1rem;
  }
  
  .playlist-card {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .playlist-cover-container {
    width: 12.5rem;
  }
  
  .playlist-videos-container {
    padding: 1rem;
    overflow-y: visible;
  }
}

@media (max-width: 480px) {
  .playlist-card {
    flex-direction: column;
  }
  .playlist-cover-container {
    width: 100%;
  }
  .session-index {
    display: none;
  }
  .session-mini-thumb {
    width: 6.25rem;
    margin-right: 0.75rem;
  }
}
</style>
