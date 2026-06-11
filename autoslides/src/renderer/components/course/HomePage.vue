<template>
  <div class="home-page custom-scrollbar">
    <div class="home-hero">
      <h1 class="home-greeting">{{ greetingText }}</h1>
      <p class="home-tagline">{{ $t('courses.welcome.subtitle') }}</p>
    </div>

    <section class="home-section">
      <h2 class="home-section-title">{{ $t('courses.savedSearches.sectionTitle') }}</h2>
      <div class="saved-grid custom-scrollbar">
        <div
          v-for="entry in mergedSavedSearches"
          :key="entry.mode + ':' + entry.keyword"
          class="saved-card"
          @click="openSavedSearch(entry.keyword, entry.mode)"
        >
          <span class="saved-icon">
            <svg v-if="entry.mode === 'live'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
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
            class="course-card"
            @click="openCourse('live', course)"
          >
            <div class="course-status" :class="getCourseStatusClass(course.status)">
              {{ getCourseStatusText(course.status, t) }}
            </div>
            <div class="course-info">
              <h3 class="course-title">{{ course.title }}</h3>
              <p class="course-instructor">{{ course.instructor }}</p>
              <p class="course-location" v-if="course.subtitle">{{ course.subtitle }}</p>
              <p class="course-time">{{ course.time }}</p>
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
            class="course-card"
            @click="openCourse('recorded', course)"
          >
            <div class="course-id">#{{ course.id }}</div>
            <div class="course-info">
              <h3 class="course-title">{{ course.title }}</h3>
              <p class="course-instructor">{{ course.instructor }}</p>
              <p class="course-location" v-if="course.classrooms">
                {{ course.classrooms.map(c => c.name).join(', ') }}
              </p>
              <p class="course-time">{{ course.time }}</p>
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
          @keyup.enter="confirmAddSearch"
          @keyup.esc="closeAddModal"
          ref="modalInputRef"
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
          <button class="btn btn--lg modal-action-btn" @click="closeAddModal">{{ $t('courses.savedSearches.cancel') }}</button>
          <button class="btn btn--primary btn--lg modal-action-btn" @click="confirmAddSearch" :disabled="!newKeyword.trim()">{{ $t('courses.savedSearches.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGreeting } from '@features/platform/useGreeting'
import { useAuth } from '@features/platform/useAuth'
import { useHomePage } from '@features/course/useHomePage'
import { useSearchPage } from '@features/course/useSearchPage'
import { openCourse } from '@features/course/courseSelection'
import { getCourseStatusClass, getCourseStatusText } from '@features/course/useCourseList'
import { mergedSavedSearches, addSavedSearch, removeSavedSearch } from '@features/course/savedSearches'

const { t } = useI18n()
const { greetingText, loadGreeting } = useGreeting()
const { isLoggedIn } = useAuth()
const { openSavedSearch } = useSearchPage()
const {
  liveStreams,
  recordings,
  isLoadingLive,
  isLoadingRecorded,
  liveError,
  recordedError,
  loadPersonalRows,
  clearPersonalRows
} = useHomePage()

// Add Saved Search modal
const showAddModal = ref(false)
const newKeyword = ref('')
const newSearchMode = ref<'live' | 'recorded'>('recorded')
const modalInputRef = ref<HTMLInputElement | null>(null)

const openAddModal = () => {
  newKeyword.value = ''
  newSearchMode.value = 'recorded'
  showAddModal.value = true
  nextTick(() => modalInputRef.value?.focus())
}
const closeAddModal = () => {
  showAddModal.value = false
}
const confirmAddSearch = () => {
  if (newKeyword.value.trim()) {
    addSavedSearch(newSearchMode.value, newKeyword.value)
  }
  closeAddModal()
}

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    loadPersonalRows()
  } else {
    clearPersonalRows()
  }
})

onMounted(() => {
  loadGreeting()
  if (isLoggedIn.value) {
    loadPersonalRows()
  }
})
</script>

<style scoped>
.home-page {
  height: 100%;
  overflow-y: auto;
  padding: 36px 32px 32px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.home-hero {
  margin-bottom: 36px;
}

.home-greeting {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--text-primary);
}

.home-tagline {
  margin: 10px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.home-section {
  margin-bottom: 36px;
}

/* Apple Music style: hairline divider between consecutive sections */
.home-section + .home-section {
  border-top: 1px solid var(--border-color);
  padding-top: 28px;
}

.home-section-title {
  margin: 0 0 14px;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--text-primary);
}

/* Saved courses: max two rows, then horizontal scroll (Apple Music style) */
.saved-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, auto);
  grid-auto-columns: 210px;
  gap: 12px;
  overflow-x: auto;
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

/* Personal rows: single-row horizontal scroll */
.course-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.course-card {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 210px;
  height: 120px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
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
  margin: 0 0 3px 0;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-time {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-loading {
  display: flex;
  align-items: center;
  padding: 16px 0;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.row-error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.row-empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.home-signin-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
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
  border-radius: 14px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-title {
  margin: 0 0 2px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.modal-input {
  padding: 10px 12px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  font-size: 14px;
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

/* Full-width segmented Live/Recorded control */
.mode-segments {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: var(--bg-elevated);
}

.mode-segment {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-segment:hover {
  color: var(--text-primary);
}

.mode-segment.active {
  background: var(--accent);
  color: var(--text-on-accent);
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.modal-action-btn {
  flex: 1;
}
</style>
