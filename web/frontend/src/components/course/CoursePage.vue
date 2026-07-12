<template>
  <div class="course-page">
    <div class="header">
      <h2 class="page-title">{{ mode === 'live' ? $t('courses.title.liveStreams') : $t('courses.title.recordings') }}</h2>
    </div>

    <div class="content custom-scrollbar" @scroll="handleScroll">
      <div v-if="errorMessage" class="error-message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <div v-if="!isLoggedIn" class="signin-state">
        <p>{{ $t('courses.signInToLoad') }}</p>
      </div>

      <div v-else-if="isLoading && courses.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <template v-else-if="!errorMessage">
        <div class="video-grid">
          <div
            v-for="course in paginatedCourses"
            :key="course.id"
            class="video-card"
            @click="selectCourse(course)"
          >
            <!-- 16:9 Thumbnail -->
            <div class="video-thumbnail-container">
              <img
                v-if="!coverFailed.has(course.id)"
                :src="getCourseCover(course.id)"
                class="video-thumbnail"
                alt=""
                @error="markCoverFailed(course.id)"
              />
              <div v-else class="video-thumbnail-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div v-if="!coverFailed.has(course.id)" class="video-cover-overlay-text" :style="getOverlayTextStyle(course.title)">
                {{ course.title }}
              </div>
              <!-- Badges -->
              <span v-if="mode === 'live'" class="video-badge" :class="getLiveBadgeClass(course.status)">
                <span v-if="course.status === 1" class="pulse-dot"></span>
                {{ getStatusText(course.status) }}
              </span>
              <span v-else class="video-badge badge-id">#{{ course.id }}</span>
              <div class="video-hover-overlay">
                <svg class="play-arrow" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            <!-- Description Meta -->
            <div class="video-detail-row">
              <div class="instructor-avatar" :style="{ backgroundColor: getAvatarBg(course.instructor || course.title) }">
                {{ getInitials(course.instructor || course.title) }}
              </div>
              <div class="video-meta">
                <h3 class="video-title" :title="course.title">{{ course.title }}</h3>
                <p class="video-instructor">{{ course.instructor }}</p>
                <p class="video-stats">
                  {{ course.time }}
                  <span v-if="mode === 'recorded' && course.classrooms"> · {{ course.classrooms.map(c => c.name).join(', ') }}</span>
                  <span v-if="mode === 'live' && course.subtitle"> · {{ course.subtitle }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Infinite scroll loading spinner -->
        <div v-if="isLoading && courses.length > 0" class="scroll-loading">
          <div class="spinner mini-spinner"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCourseList } from '../../composables/useCourseList'
import { navigationStore } from '../../stores/navigationStore'
import { authStore } from '../../stores/authStore'
import { getCourseCover, coverFailed, markCoverFailed, getOverlayTextStyle, getAvatarBg, getInitials } from '../../composables/courseCover'

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const { t } = useI18n()
const { activeNav } = navigationStore
const { isLoggedIn, userId } = authStore

const {
  isLoading,
  courses,
  errorMessage,
  paginatedCourses,
  fetchPersonalCourses,
  loadMore,
  selectCourse,
  getStatusText
} = useCourseList({
  mode: toRef(props, 'mode'),
  t
})

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
    loadMore()
  }
}

const refresh = () => {
  if (isLoggedIn.value && !isLoading.value) {
    fetchPersonalCourses()
  }
}

onMounted(() => {
  if (activeNav.value === props.mode) {
    refresh()
  }
})

watch(activeNav, (nav) => {
  if (nav === props.mode) {
    refresh()
  }
})

watch([isLoggedIn, userId], ([loggedIn]) => {
  if (loggedIn && activeNav.value === props.mode) {
    refresh()
  }
})

const getLiveBadgeClass = (status?: number) => {
  return `video-badge badge-live ${status === 1 ? 'live-active' : 'live-ended'}`
}
</script>

<style scoped>
.course-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.header {
  flex-shrink: 0;
  padding: 1.5rem 3rem 0.5rem;
  background-color: var(--bg-page);
}

.page-title {
  margin: 0;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: left;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 1rem 3rem 2rem;
  overflow-y: auto;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background-color: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 0.5rem;
  color: var(--danger-bright);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.signin-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* responsive grid */
.video-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem 1.5rem;
  flex: 1 0 auto;
}

.video-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  background-color: transparent;
  width: 100%;
}

.video-thumbnail-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  background-color: var(--bg-elevated);
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
}

.video-thumbnail {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-card:hover .video-thumbnail {
  transform: scale(1.03);
}

.video-thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-muted);
}

.video-hover-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.video-card:hover .video-hover-overlay {
  opacity: 1;
}

.play-arrow {
  color: #ffffff;
  transform: scale(0.9);
  transition: transform 0.2s;
}

.video-card:hover .play-arrow {
  transform: scale(1.1);
}

/* Badges */
.video-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  padding: 0.1875rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-id {
  background-color: rgba(15, 15, 15, 0.85);
  color: #ffffff;
}

.badge-live {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #ffffff;
  font-weight: 700;
  text-transform: uppercase;
  top: 0.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
}

.badge-live.live-active {
  background-color: var(--accent);
}

.badge-live.live-ended {
  background-color: var(--neutral-strong);
}

.pulse-dot {
  width: 0.375rem;
  height: 0.375rem;
  background-color: #ffffff;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.9); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.5; }
  100% { transform: scale(0.9); opacity: 1; }
}

.video-detail-row {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding: 0 0.25rem;
}

.instructor-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.video-meta {
  flex: 1;
  min-width: 0;
}

.video-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.25rem;
  max-height: 2.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-instructor {
  margin: 0.375rem 0 0.125rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-stats {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.page-btn {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: 50%;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
}

.page-info {
  font-size: 0.875rem;
  color: var(--text-secondary);
  min-width: 3.75rem;
  text-align: center;
}

@media (max-width: 1024px) {
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .video-grid {
    grid-template-columns: 1fr;
  }
  .header {
    padding: 1.5rem 1.5rem 0.5rem;
  }
  .content {
    padding: 1rem 1.5rem 2rem;
  }
}

.scroll-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
  width: 100%;
  flex-shrink: 0;
}

.mini-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border-width: 2px;
}
</style>
