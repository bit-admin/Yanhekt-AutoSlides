<template>
  <div class="course-page">
    <div class="header">
      <h2 class="page-title">{{ mode === 'live' ? $t('courses.title.liveStreams') : $t('courses.title.recordings') }}</h2>
      <button
        v-if="mode === 'recorded' && isLoggedIn"
        type="button"
        class="header-action"
        :title="$t('courses.findOtherRecordings')"
        @click="openAllRecordingsSearch"
      >
        <svg class="header-action-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <span>{{ $t('courses.findOtherRecordings') }}</span>
      </button>
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

      <div v-if="!isLoggedIn" class="signin-state">
        <p>{{ $t('courses.signInToLoad') }}</p>
      </div>

      <div v-else-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <div v-else-if="!errorMessage" class="courses-grid custom-scrollbar">
        <div
          v-for="course in paginatedCourses"
          :key="course.id"
          class="course-card"
          @click="selectCourse(course)"
        >
          <div v-if="mode === 'live'" class="course-status" :class="getStatusClass(course.status)">
            {{ getStatusText(course.status) }}
          </div>
          <div v-if="mode === 'recorded'" class="course-id">
            #{{ course.id }}
          </div>
          <div class="course-info">
            <h3 class="course-title">{{ course.title }}</h3>
            <p class="course-instructor">{{ course.instructor }}</p>
            <p class="course-location" v-if="mode === 'live' && course.subtitle">{{ course.subtitle }}</p>
            <p class="course-location" v-if="mode === 'recorded' && course.classrooms">
              {{ course.classrooms.map(c => c.name).join(', ') }}
            </p>
            <p class="course-time">{{ course.time }}</p>
            <p class="course-section" v-if="mode === 'live' && course.session?.section_group_title">{{ course.session.section_group_title }}</p>
            <p class="course-section" v-if="mode === 'recorded' && course.college_name">{{ course.college_name }}</p>
            <p class="course-participants" v-if="course.participant_count !== undefined">
              {{ course.participant_count }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="isLoggedIn && !isLoading && courses.length > 0" class="pagination">
        <button
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
          class="btn page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
          class="btn page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCourseList } from '@features/course/useCourseList'
import { navigationStore } from '@features/course/navigationStore'
import { useSearchPage } from '@features/course/useSearchPage'
import { useAuth } from '@features/platform/useAuth'

const props = defineProps<{
  mode: 'live' | 'recorded'
}>()

const { t } = useI18n()
const { activeNav } = navigationStore
const { isLoggedIn } = useAuth()
const { openAllRecordingsSearch } = useSearchPage()

const {
  isLoading,
  courses,
  currentPage,
  totalPages,
  errorMessage,
  paginatedCourses,
  fetchPersonalCourses,
  goToPage,
  selectCourse,
  getStatusClass,
  getStatusText
} = useCourseList({
  mode: toRef(props, 'mode'),
  t
})

const refresh = () => {
  if (isLoggedIn.value && !isLoading.value) {
    fetchPersonalCourses()
  }
}

// Navigator clicks on Live/Recorded act like "Get Personal Course List":
// fetch whenever this mode's course grid becomes the active page.
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

// Login while this mode's grid is visible → load it.
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn && activeNav.value === props.mode) {
    refresh()
  }
})
</script>

<style scoped>
.course-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Apple Music style title band: centered title on a full-width tinted bar */
.header {
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 36px;
}

.page-title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.2px;
  text-align: center;
  color: var(--text-primary);
}

.header-action {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, color 0.15s;
}

.header-action:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 1px 4px var(--focus-ring);
}

.header-action-icon {
  flex-shrink: 0;
}

.header-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flex child to shrink */
  padding: 0 24px 16px;
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
  color: var(--danger-bright);
  font-size: 14px;
  flex-shrink: 0;
}

.signin-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* A page is always 16 items: 4 columns × 4 rows stretched to fill the
   available height. Rows grow to share extra space (1fr) but never shrink
   below the card's own content height (min-content) — once 4 rows of content
   no longer fit (short laptop windows), the grid scrolls instead of clipping
   the card text. */
.courses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, minmax(min-content, 1fr));
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px; /* Space for scrollbar */
  min-height: 0; /* Important for scrolling */
}

.course-card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.course-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--focus-ring);
}

.course-status {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-ended {
  background-color: var(--bg-page-alt);
  color: var(--text-secondary);
}

.status-live {
  background-color: var(--success-bg);
  color: var(--success);
}

.status-upcoming {
  background-color: var(--warning-bg);
  color: var(--warning);
}

.status-unknown {
  background-color: var(--bg-elevated);
  color: var(--text-muted);
}

.course-id {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  background-color: var(--border-color);
  color: var(--text-secondary);
}

.course-info {
  text-align: left;
  padding-top: 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.course-title {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* Always reserve two lines so the info block starts at the same height
     on every card, whether the name wraps or not. */
  min-height: 2.4em;
}

.course-instructor {
  margin: 0 0 4px 0;
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-location {
  margin: 0 0 4px 0;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-time {
  margin: 0 0 4px 0;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-section {
  margin: 0 0 4px 0;
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-participants {
  margin: auto 0 0;
  padding-top: 4px;
  font-size: 9px;
  color: var(--accent);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0; /* Prevent pagination from shrinking */
}

/* Square 32×32 icon button — padding:0 so the chevron is not crushed by
   .btn's horizontal padding under box-sizing: border-box. */
.page-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.page-info {
  font-size: 14px;
  color: var(--text-secondary);
  min-width: 60px;
  text-align: center;
}

@media (max-width: 1200px) {
  .courses-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .courses-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .courses-grid {
    grid-template-columns: 1fr;
  }
}
</style>
