<template>
  <div class="home-page custom-scrollbar">
    <div class="home-hero">
      <h1 class="home-greeting">{{ greetingText }}</h1>
      <p class="home-tagline">AutoSlides</p>
    </div>
    <section class="home-section">
      <h2 class="home-section-title">{{ $t('courses.savedSearches.sectionTitle') }}</h2>
      <div class="saved-grid custom-scrollbar">
        <div
          v-for="c in pinnedRecordedCourses"
          :key="'pin:' + c.id"
          class="saved-card saved-card--recorded"
          @click="openPinnedCourse(c)"
        >
          <span class="saved-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 17v5"/>
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
            </svg>
          </span>
          <div class="saved-text">
            <span class="saved-label">{{ c.title }}</span>
            <span class="saved-mode">{{ $t('navigation.recorded') }}</span>
          </div>
          <button
            class="saved-remove"
            :title="$t('sessions.unpin')"
            @click.stop="removePinnedCourse(c.id)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div
          v-for="entry in mergedSavedSearches"
          :key="entry.mode + ':' + entry.keyword"
          :class="['saved-card', `saved-card--${entry.mode}`]"
          @click="openSavedSearch(entry.keyword, entry.mode)"
        >
          <span class="saved-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <div class="saved-text">
            <span class="saved-label">{{ entry.keyword }}</span>
            <span class="saved-mode">{{ $t(entry.mode === 'live' ? 'navigation.live' : 'navigation.recorded') }}</span>
          </div>
          <button
            class="saved-remove"
            :title="$t('courses.savedSearches.remove')"
            @click.stop="removeSavedSearch(entry.mode, entry.keyword)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="saved-card saved-card--add" @click="openAddModal">
          <span class="saved-icon saved-icon--add">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </span>
          <div class="saved-text">
            <span class="saved-label saved-label--add">{{ $t('courses.savedSearches.save') }}</span>
          </div>
        </div>
      </div>
    </section>

    <template v-if="isLoggedIn">
      <section class="home-section">
        <h2 class="home-section-title">{{ $t('home.myLiveStreams') }}</h2>
        <div v-if="isLoadingLive" class="row-loading"><div class="spinner"></div></div>
        <p v-else-if="liveError" class="row-error">{{ liveError }}</p>
        <p v-else-if="liveStreams.length === 0" class="row-empty">{{ $t('courses.noResults') }}</p>
        <div v-else class="course-row custom-scrollbar">
          <div
            v-for="course in liveStreams"
            :key="course.id"
            class="preview-card"
            @click="openCourse('live', course)"
          >
            <div class="preview-thumb">
              <img
                v-if="!coverFailed.has(course.id)"
                :src="FALLBACK_COVER"
                class="preview-img preview-img--cover"
                alt=""
                @error="markCoverFailed(course.id)"
              />
              <div v-else class="preview-placeholder">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <span class="preview-badge" :class="getCourseStatusClass(course.status)">
                {{ getCourseStatusText(course.status, t) }}
              </span>
              <div class="preview-play">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <div class="preview-meta">
              <h3 class="preview-title">{{ course.title }}</h3>
              <p class="preview-subtitle">{{ course.instructor }} · {{ course.time }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="home-section">
        <h2 class="home-section-title">{{ $t('home.myRecordings') }}</h2>
        <div v-if="isLoadingRecorded" class="row-loading"><div class="spinner"></div></div>
        <p v-else-if="recordedError" class="row-error">{{ recordedError }}</p>
        <p v-else-if="recordings.length === 0" class="row-empty">{{ $t('courses.noResults') }}</p>
        <div v-else class="course-row custom-scrollbar">
          <div
            v-for="course in recordings"
            :key="course.id"
            class="preview-card"
            @click="openCourse('recorded', course)"
          >
            <div class="preview-thumb">
              <img
                v-if="!coverFailed.has(course.id)"
                :src="FALLBACK_COVER"
                class="preview-img preview-img--cover"
                alt=""
                @error="markCoverFailed(course.id)"
              />
              <div v-else class="preview-placeholder">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <span class="preview-badge preview-badge--id">#{{ course.id }}</span>
            </div>
            <div class="preview-meta">
              <h3 class="preview-title">{{ course.title }}</h3>
              <p class="preview-subtitle">{{ course.instructor }} · {{ course.time }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>
    <p v-else class="home-signin-hint">{{ $t('home.signInHint') }}</p>

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
  getCourseStatusClass,
  getCourseStatusText,
  type Course,
} from '../../composables/useCourseList'
import { openCourse } from '../../composables/courseSelection'
import { useSearchPage } from '../../composables/useSearchPage'
import { mergedSavedSearches, addSavedSearch, removeSavedSearch } from '../../composables/savedSearches'
import { pinnedRecordedCourses, openPinnedCourse, removePinnedCourse } from '../../composables/pinnedCourses'
import { authStore } from '../../stores/authStore'
import { navigationStore } from '../../stores/navigationStore'

const FALLBACK_COVER = 'https://coss.yanhekt.cn/images/front_cover.png'
const ROW_SIZE = 12

const { t, locale } = useI18n()
const { isLoggedIn, userNickname, userId } = authStore
const { activeNav } = navigationStore
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

// Simple time-of-day greeting (the desktop app's weighted greeting catalog is
// deliberately not ported).
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
const coverFailed = ref(new Set<string>())
let loadedForUser: string | null = null

const markCoverFailed = (id: string) => {
  coverFailed.value.add(id)
  coverFailed.value = new Set(coverFailed.value)
}

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
  padding: 24px 32px 28px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.home-hero {
  margin-top: 12px;
  margin-bottom: 22px;
}

.home-greeting {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--text-primary);
}

.home-tagline {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.75;
}

.home-section {
  margin-bottom: 26px;
}

.home-section-title {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--text-primary);
}

.home-signin-hint {
  margin-top: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

/* Saved Courses: normal vertical grid layout */
.saved-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  padding-bottom: 8px;
}

.saved-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 26px 10px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.saved-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--focus-ring);
}

.saved-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--badge-active-bg);
  color: var(--accent);
  flex-shrink: 0;
}

/* Mode color coding: live = yellow, recorded = blue */
.saved-card--live .saved-icon {
  background: var(--warning-bg);
  color: var(--warning);
}

.saved-card--live .saved-mode {
  color: var(--warning);
}

.saved-card--live:hover {
  border-color: var(--warning);
}

.saved-card--recorded .saved-icon {
  background: var(--blue-badge-bg);
  color: var(--blue-badge-text);
}

.saved-card--recorded .saved-mode {
  color: var(--blue-badge-text);
}

.saved-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.saved-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-mode {
  font-size: 11px;
  color: var(--text-muted);
}

.saved-card--add {
  border-style: dashed;
}

.saved-card--add .saved-icon--add {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.saved-card--add:hover .saved-icon--add {
  color: var(--accent);
}

.saved-label--add {
  color: var(--text-muted);
  font-weight: 500;
}

.saved-card--add:hover .saved-label--add {
  color: var(--accent);
}

.saved-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: var(--hover-tint-strong);
  border-radius: 50%;
  padding: 0;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.saved-card:hover .saved-remove {
  display: flex;
}

.saved-remove:hover {
  background: var(--danger);
  color: var(--text-on-accent);
}

/* Add Saved Search modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.modal-input {
  padding: 8px 11px;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.modal-input::placeholder {
  color: var(--text-muted);
}

.modal-input:focus {
  border-color: var(--accent);
}

/* Full-width macOS segmented Live/Recorded control: gray track, white active
   pill (matches the Search page mode switch) */
.mode-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-segment {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-segment:hover {
  color: var(--text-primary);
}

.mode-segment.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.modal-action-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}

/* Personal rows: normal vertical grid layout */
.course-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 16px;
  padding-bottom: 8px;
}

/* Infuse-style preview card: 16:9 thumbnail on top, text below */
.preview-card {
  width: 100%;
  cursor: pointer;
}

.preview-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.preview-card:hover .preview-thumb {
  border-color: var(--accent);
  box-shadow: 0 4px 14px var(--focus-ring);
}

.preview-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* CDN cover art has varied aspect ratios — center-crop to fill the 16:9 frame */
.preview-img--cover {
  object-position: center;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-muted);
}

.preview-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 2px;
  background: var(--overlay-dark);
  color: var(--text-on-accent);
  pointer-events: none;
  transition: transform 0.2s;
}

.preview-card:hover .preview-play {
  transform: scale(1.08);
}

.preview-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.preview-badge--id {
  background: var(--overlay-dark);
  color: var(--text-on-accent);
  text-transform: none;
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

.preview-meta {
  padding: 9px 2px 0;
}

.preview-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-subtitle {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.row-error {
  color: var(--danger);
  font-size: 13px;
}

.row-empty {
  color: var(--text-muted);
  font-size: 13px;
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
</style>
