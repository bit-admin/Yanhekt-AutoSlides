<template>
  <div class="home-page custom-scrollbar">
    <!-- Greeting & Header -->
    <div class="home-hero">
      <h1 class="home-greeting">{{ greetingText }}</h1>
    </div>

    <!-- YouTube-style scrollable horizontal chips -->
    <div class="chips-container custom-scrollbar-x">
      <button 
        class="chip active" 
        @click="navigate('home')"
      >
        {{ $t('navigation.home') }}
      </button>

      <!-- Subscribed recorded courses as chips -->
      <button
        v-for="c in subscribedRecordedCourses"
        :key="'chip-pin:' + c.id"
        class="chip chip--subscribed"
        @click="openSubscribedCourse(c)"
      >
        <span class="chip-dot"></span>
        <span class="chip-label">{{ c.title }}</span>
        <span
          class="chip-remove"
          :title="$t('sessions.unsubscribe')"
          @click.stop="removeSubscribedCourse(c.id)"
        >
          ×
        </span>
      </button>

      <!-- Saved Searches as chips -->
      <button
        v-for="entry in mergedSavedSearches"
        :key="'chip-search:' + entry.mode + ':' + entry.keyword"
        :class="['chip', `chip--${entry.mode}`]"
        @click="openSavedSearch(entry.keyword, entry.mode)"
      >
        <span class="chip-label">{{ entry.keyword }}</span>
        <span class="chip-mode">{{ $t(entry.mode === 'live' ? 'navigation.live' : 'navigation.recorded') }}</span>
        <span
          class="chip-remove"
          :title="$t('courses.savedSearches.remove')"
          @click.stop="removeSavedSearch(entry.mode, entry.keyword)"
        >
          ×
        </span>
      </button>

      <!-- Add Chip Button -->
      <button class="chip chip--add" @click="openAddModal">
        <svg class="chip-add-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>{{ $t('courses.savedSearches.save') }}</span>
      </button>
    </div>

    <template v-if="isLoggedIn">
      <!-- Live Streams Section -->
      <section class="home-section">
        <h2 class="home-section-title">{{ $t('home.myLiveStreams') }}</h2>
        <div v-if="isLoadingLive" class="row-loading"><div class="spinner"></div></div>
        <p v-else-if="liveError" class="row-error">{{ liveError }}</p>
        <p v-else-if="liveStreams.length === 0" class="row-empty">{{ $t('courses.noResults') }}</p>
        
        <div v-else class="video-grid">
          <div
            v-for="course in liveStreams"
            :key="course.id"
            class="video-card"
            @click="openCourse('live', course)"
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
              <!-- Pulse LIVE Badge -->
              <span class="video-badge badge-live">
                <span class="pulse-dot"></span>
                {{ getCourseStatusText(course.status, t) }}
              </span>
              <div class="video-hover-overlay">
                <svg class="play-arrow" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            <!-- Avatar + Meta Row -->
            <div class="video-detail-row">
              <div class="instructor-avatar" :style="{ backgroundColor: getAvatarBg(course.instructor || course.title) }">
                {{ getInitials(course.instructor || course.title) }}
              </div>
              <div class="video-meta">
                <h3 class="video-title" :title="course.title">{{ course.title }}</h3>
                <p class="video-instructor">{{ course.instructor }}</p>
                <p class="video-stats">{{ course.time }} · {{ course.subtitle || $t('home.liveSession') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Recordings Section -->
      <section class="home-section">
        <h2 class="home-section-title">{{ $t('home.myRecordings') }}</h2>
        <div v-if="isLoadingRecorded" class="row-loading"><div class="spinner"></div></div>
        <p v-else-if="recordedError" class="row-error">{{ recordedError }}</p>
        <p v-else-if="recordings.length === 0" class="row-empty">{{ $t('courses.noResults') }}</p>
        
        <div v-else class="video-grid">
          <div
            v-for="course in recordings"
            :key="course.id"
            class="video-card"
            @click="openCourse('recorded', course)"
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
              <!-- Course ID Badge -->
              <span class="video-badge badge-id">#{{ course.id }}</span>
              <div class="video-hover-overlay">
                <svg class="play-arrow" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            <!-- Avatar + Meta Row -->
            <div class="video-detail-row">
              <div class="instructor-avatar" :style="{ backgroundColor: getAvatarBg(course.instructor || course.title) }">
                {{ getInitials(course.instructor || course.title) }}
              </div>
              <div class="video-meta">
                <h3 class="video-title" :title="course.title">{{ course.title }}</h3>
                <p class="video-instructor">{{ course.instructor }}</p>
                <p class="video-stats">{{ course.time }} · {{ course.college_name || $t('home.academicCourse') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
    <p v-else class="home-signin-hint">{{ $t('home.signInHint') }}</p>

    <!-- Save Search Modal (Pill styled) -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
      <div class="modal-box">
        <h3 class="modal-title">{{ $t('courses.savedSearches.modalTitle') }}</h3>
        <input
          v-model="newKeyword"
          type="text"
          class="modal-input"
          :placeholder="$t('courses.savedSearches.placeholder')"
          @keyup.enter="confirmAdd"
          @keyup.esc="closeAddModal"
          ref="keywordInputRef"
        />
        <div class="mode-segments">
          <button
            :class="['mode-segment', { active: newSearchMode === 'live' }]"
            @click="newSearchMode = 'live'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
            </svg>
            {{ $t('navigation.live') }}
          </button>
          <button
            :class="['mode-segment', { active: newSearchMode === 'recorded' }]"
            @click="newSearchMode = 'recorded'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            {{ $t('navigation.recorded') }}
          </button>
        </div>
        <div class="modal-actions">
          <button class="btn modal-action-btn" @click="closeAddModal">{{ $t('courses.savedSearches.cancel') }}</button>
          <button class="btn btn--primary modal-action-btn" @click="confirmAdd" :disabled="!newKeyword.trim()">{{ $t('courses.savedSearches.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPersonalLiveList, getPersonalCourseList } from '../../lib/api'
import {
  transformLiveStreamToCourse,
  transformCourseDataToCourse,
  getCourseStatusText,
  type Course,
} from '../../composables/useCourseList'
import { openCourse } from '../../composables/courseSelection'
import { useSearchPage } from '../../composables/useSearchPage'
import { mergedSavedSearches, addSavedSearch, removeSavedSearch } from '../../composables/savedSearches'
import { subscribedRecordedCourses, openSubscribedCourse, removeSubscribedCourse } from '../../composables/subscribedCourses'
import { authStore } from '../../stores/authStore'
import { getCourseCover, coverFailed, markCoverFailed, getOverlayTextStyle, getAvatarBg, getInitials } from '../../composables/courseCover'
import { navigationStore } from '../../stores/navigationStore'
const ROW_SIZE = 12

const { t, locale } = useI18n()
const { isLoggedIn, userNickname, userId } = authStore
const { activeNav, navigate } = navigationStore
const { openSavedSearch } = useSearchPage()

// Add-saved-search modal
const showAddModal = ref(false)
const newKeyword = ref('')
const newSearchMode = ref<'live' | 'recorded'>('recorded')
const keywordInputRef = ref<HTMLInputElement | null>(null)

const openAddModal = () => {
  newKeyword.value = ''
  newSearchMode.value = 'recorded'
  showAddModal.value = true
  void nextTick(() => keywordInputRef.value?.focus())
}

const closeAddModal = () => {
  showAddModal.value = false
}

const confirmAdd = () => {
  if (!newKeyword.value.trim()) return
  addSavedSearch(newSearchMode.value, newKeyword.value)
  closeAddModal()
}

const greetingText = computed(() => {
  const hour = new Date().getHours()
  const zh = locale.value.startsWith('zh')
  const name = userNickname.value
  let base: string
  if (hour >= 5 && hour < 12) base = zh ? '早上好' : 'Good morning'
  else if (hour >= 12 && hour < 18) base = zh ? '下午好' : 'Good afternoon'
  else if (hour >= 18 && hour < 21) base = zh ? '晚上好' : 'Good evening'
  else base = zh ? '夜深了' : 'Good night'
  return name ? (zh ? `${base}，${name}` : `${base}, ${name}`) : base
})

const liveStreams = ref<Course[]>([])
const recordings = ref<Course[]>([])
const isLoadingLive = ref(false)
const isLoadingRecorded = ref(false)
const liveError = ref('')
const recordedError = ref('')
let loadedForUser: string | null = null

const loadRows = async () => {
  const token = authStore.token.value
  if (!token) return

  isLoadingLive.value = true
  liveError.value = ''
  isLoadingRecorded.value = true
  recordedError.value = ''

  void getPersonalLiveList(token, 1, ROW_SIZE)
    .then((response) => {
      liveStreams.value = response.data.map(transformLiveStreamToCourse)
    })
    .catch((error: unknown) => {
      liveError.value = (error instanceof Error && error.message) || 'Failed to load live streams'
      liveStreams.value = []
    })
    .finally(() => {
      isLoadingLive.value = false
    })

  void getPersonalCourseList(token, { page: 1, pageSize: ROW_SIZE })
    .then((response) => {
      recordings.value = response.data.map(transformCourseDataToCourse)
    })
    .catch((error: unknown) => {
      recordedError.value = (error instanceof Error && error.message) || 'Failed to load recordings'
      recordings.value = []
    })
    .finally(() => {
      isLoadingRecorded.value = false
    })
}

const refreshIfNeeded = () => {
  if (!isLoggedIn.value) return
  if (loadedForUser === userId.value && activeNav.value !== 'home') return
  if (loadedForUser !== userId.value) {
    loadedForUser = userId.value
    void loadRows()
  }
}

onMounted(refreshIfNeeded)
watch([isLoggedIn, userId], ([loggedIn]) => {
  if (loggedIn) {
    loadedForUser = null
    refreshIfNeeded()
  } else {
    liveStreams.value = []
    recordings.value = []
    loadedForUser = null
  }
})
watch(activeNav, (nav) => {
  if (nav === 'home') refreshIfNeeded()
})
</script>

<style scoped>
.home-page {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem 3rem 3rem;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.home-hero {
  margin-bottom: 1.5rem;
}

.home-greeting {
  margin: 0;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03rem;
  color: var(--text-primary);
}

.home-tagline {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Horizontal scrolling chips */
.chips-container {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0 1.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbars for chips */
.custom-scrollbar-x::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar-x {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
  flex-shrink: 0;
}

.chip:hover {
  background-color: var(--bg-hover);
}

.chip.active {
  background-color: var(--text-primary);
  color: var(--bg-page-alt);
  border-color: var(--text-primary);
}

.chip--subscribed {
  border-color: var(--accent-deep);
}

.chip-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background-color: var(--accent-deep);
}

.chip-mode {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
  padding: 0.0625rem 0.25rem;
  border-radius: 0.25rem;
  margin-left: 0.25rem;
}

.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.875rem;
  height: 0.875rem;
  margin-left: 0.25rem;
  border-radius: 50%;
  font-size: 0.6875rem;
  line-height: 1;
  color: var(--text-secondary);
  transition: background-color 0.15s, color 0.15s;
}

.chip-remove:hover {
  background-color: var(--danger);
  color: #ffffff;
}

.chip--add {
  border-style: dashed;
  color: var(--text-secondary);
}

.chip--add:hover {
  color: var(--accent-deep);
  border-color: var(--accent-deep);
}

.chip-add-icon {
  margin-right: -0.125rem;
}

/* Sections & Grids */
.home-section {
  margin-bottom: 2.5rem;
}

.home-section-title {
  margin: 0 0 1.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01rem;
  color: var(--text-primary);
}

.home-signin-hint {
  margin-top: 3rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* YouTube Style Responsive Grid */
.video-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem 1.5rem;
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

/* YouTube Badges */
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
  background-color: var(--accent); /* Red */
  color: #ffffff;
  font-weight: 700;
  text-transform: uppercase;
  top: 0.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
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

/* Details row under thumbnail */
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

/* Modal and segments styling (relative rem units) */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.modal-box {
  background: var(--bg-modal);
  border-radius: 0.75rem;
  padding: 1.5rem;
  width: 20rem;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.modal-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-input);
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.modal-input:focus {
  border-color: var(--link-color);
}

.mode-segments {
  display: flex;
  gap: 0.125rem;
  padding: 0.125rem;
  border-radius: 0.5rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
}

.mode-segment {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem 0;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-segment:hover {
  color: var(--text-primary);
}

.mode-segment.active {
  background: var(--bg-page-alt);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
}

.modal-action-btn {
  flex: 1;
}

.row-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 8rem;
}

.row-error {
  color: var(--danger);
  font-size: 0.8125rem;
}

.row-empty {
  color: var(--text-secondary);
  font-size: 0.8125rem;
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
  .home-page {
    padding: 1rem 1rem 2rem;
  }
}
</style>
