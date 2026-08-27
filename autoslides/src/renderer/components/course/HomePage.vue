<template>
  <div class="home-page custom-scrollbar" :class="{ 'home-page--welcome': !isLoggedIn }">
    <!-- Campus-network warning banner -->
    <div v-if="campusCheckStatus === 'warning' || rechecking" class="home-banner">
      <span class="home-banner-msg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span>{{ $t('home.campusWarning.message') }}
          <button type="button" class="home-banner-link" @click="switchToExternal">{{ $t('home.campusWarning.switchExternal') }}</button>
          {{ $t('home.campusWarning.or') }}
          <button type="button" class="home-banner-link" @click="openIntranetSettings">{{ $t('home.campusWarning.openSettings') }}</button>.
        </span>
      </span>
      <span class="home-banner-actions">
        <button
          type="button"
          class="home-banner-icon-btn"
          :class="{ 'is-spinning': rechecking }"
          :disabled="rechecking"
          :title="$t('home.campusWarning.recheck')"
          :aria-label="$t('home.campusWarning.recheck')"
          @click="recheckCampusConnection"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </span>
    </div>
    <div v-if="!isLoggedIn" class="home-welcome">
      <h1 class="home-greeting">{{ greetingText }}</h1>
      <p class="home-tagline">{{ $t('courses.welcome.subtitle') }}</p>
      <HomeWelcomeDemo />
      <h2 class="home-feature-title">
        <span>{{ $t('home.featureTitleIn') }}</span>
        <span class="home-feature-out">{{ $t('home.featureTitleOut') }}</span>
      </h2>
      <p class="home-feature-lead">{{ $t('home.featureLead') }}</p>
      <button type="button" class="home-yanhekt-cta" @click="openSsoModal">
        <span>{{ $t('home.signInTo') }}</span>
        <svg class="home-yanhekt-wordmark" viewBox="54 5 95 31" aria-hidden="true">
          <g fill="currentColor">
            <polygon points="98.737 7.639 98.737 6.126 98.125 6.126 94.937 6.126 84.664 6.126 84.664 7.639 94.937 7.639 94.937 21.54 92.425 21.54 93.101 23.053 94.937 23.053 97.449 23.053 98.125 23.053 98.125 7.639" />
            <polygon points="65.986 20.216 69.174 20.216 73.006 20.216 73.618 18.703 69.174 18.703 69.174 14.101 73.006 14.101 73.618 12.557 69.174 12.557 69.174 7.639 73.006 7.639 73.618 6.126 69.174 6.126 65.986 6.126 60.93 6.126 60.93 7.639 65.986 7.639 65.986 18.703 64.118 18.703 64.118 10.413 60.93 10.413 60.93 18.703 60.93 20.216 64.118 20.216" />
            <polygon points="79.061 6.126 80.156 9.972 83.311 9.972 82.249 6.126" />
            <polygon points="108.14 9.31 107.335 6.126 104.147 6.126 104.952 9.31" />
            <polygon points="79.061 10.854 80.156 14.732 83.311 14.732 82.249 10.854" />
            <polygon points="79.061 23.053 82.249 23.053 83.311 15.866 80.156 15.866" />
            <polygon points="108.14 10.287 108.076 10.287 108.076 10.224 104.115 10.224 104.115 11.768 104.952 11.768 104.952 23.053 106.337 23.053 108.14 23.053 109.203 23.053 109.783 21.54 108.14 21.54" />
            <polygon points="94.035 20.216 94.035 9.499 92.844 9.499 90.847 9.499 88.464 9.499 85.276 9.499 85.276 11.043 85.276 20.216 87.176 20.216 90.01 20.216 90.622 18.703 88.464 18.703 88.464 11.043 90.847 11.043 90.847 20.216" />
            <polygon points="147.332 16.686 147.332 11.107 146.044 11.107 144.144 11.107 133.162 11.107 129.974 11.107 129.974 12.651 129.974 16.686 131.874 16.686 131.874 16.717 143.339 16.717 143.95 15.173 133.162 15.173 133.162 12.651 144.144 12.651 144.144 16.686" />
            <path d="M118.509777,6.12608696 L115.321642,6.12608696 L113.292828,6.12608696 L110.104693,6.12608696 L110.104693,7.45 L110.104693,9.71956522 L110.104693,11.0434783 L110.104693,14.2902174 L112.004693,14.2902174 L113.292828,14.2902174 L115.321642,14.2902174 L115.321642,15.1413043 L110.104693,15.1413043 L110.104693,16.4652174 L115.321642,16.4652174 L115.321642,23.0847826 L118.509777,23.0847826 L118.509777,16.4652174 L123.726726,16.4652174 L123.726726,15.1413043 L118.509777,15.1413043 L118.509777,14.2902174 L119.701303,14.2902174 L120.313167,12.9663043 L118.541981,12.9663043 L118.541981,11.0434783 L120.570794,11.0434783 L120.570794,14.2902174 L123.75893,14.2902174 L123.75893,7.45 L123.75893,6.12608696 L120.570794,6.12608696 L118.509777,6.12608696 Z M113.292828,7.45 L115.321642,7.45 L115.321642,9.71956522 L113.292828,9.71956522 L113.292828,7.45 Z M115.321642,12.9347826 L113.292828,12.9347826 L113.292828,11.0119565 L115.321642,11.0119565 L115.321642,12.9347826 Z M120.538591,9.68804348 L118.509777,9.68804348 L118.509777,7.41847826 L120.538591,7.41847826 L120.538591,9.68804348 Z" />
            <polygon points="140.247 20.059 147.944 20.059 147.944 18.735 140.247 18.735 140.247 17.442 137.059 17.442 137.059 18.735 129.523 18.735 129.523 20.059 137.059 20.059 137.059 21.761 129.169 21.761 129.169 23.085 148.137 23.085 148.137 21.761 140.247 21.761" />
            <polygon points="145.786 7.923 146.43 6.126 143.242 6.126 142.598 7.923 140.247 7.923 140.247 6.126 137.059 6.126 137.059 7.923 134.708 7.923 134.064 6.126 130.876 6.126 131.52 7.923 128.815 7.923 128.815 9.247 128.815 10.697 132.003 10.697 132.003 9.247 145.303 9.247 145.303 10.697 148.491 10.697 148.491 9.247 148.491 7.923" />
            <polygon points="57.195 23.085 57.388 21.918 58.644 23.053 73.006 23.053 73.618 21.54 57.452 21.54 58.772 14.101 57.291 14.101 59.191 6.126 58.386 6.126 56.003 6.126 54.103 6.126 54.103 7.639 55.649 7.639 54.103 14.101 55.617 14.101 54.006 23.085" />
            <polygon points="114.098 17.064 110.91 17.064 110.105 23.085 113.293 23.085" />
            <polygon points="119.701 17.064 120.539 23.085 123.695 23.085 122.889 17.064" />
            <polygon points="58.096 31.375 56.357 29.358 54.457 29.358 57.13 32.321 57.13 34.779 59.062 34.779 59.062 32.321 61.767 29.358 59.835 29.358" />
            <polygon points="89.011 33.55 85.308 29.358 83.537 29.358 83.537 34.779 84.922 34.779 84.922 30.808 88.464 34.779 90.396 34.779 90.396 29.358 89.011 29.358" />
            <polygon points="99.928 29.358 98.157 29.358 98.157 34.779 99.928 34.779 99.928 32.352 102.279 32.352 102.601 31.659 99.928 31.659" />
            <polygon points="114.613 32.478 118.188 32.478 118.413 31.785 114.613 31.785 114.613 30.051 118.22 30.051 118.478 29.358 112.874 29.358 112.874 34.779 118.478 34.779 118.703 34.086 114.613 34.086" />
            <polygon points="141.6 30.02 143.757 30.02 143.757 34.779 145.625 34.779 145.625 30.02 147.364 30.02 147.654 29.326 141.6 29.326" />
            <polygon points="71.428 29.358 69.013 34.779 70.591 34.779 72.459 30.587 74.295 34.779 75.872 34.779 73.489 29.358" />
            <polygon points="132.872 29.484 131.295 29.484 128.847 31.785 128.847 29.326 127.301 29.326 127.301 34.779 128.847 34.779 128.847 31.974 131.617 34.779 133.227 34.779 130.328 31.848" />
          </g>
        </svg>
      </button>
    </div>

    <template v-else>
    <div class="home-hero">
      <h1 class="home-greeting">{{ greetingText }}</h1>
      <p class="home-tagline">{{ $t('courses.welcome.subtitle') }}</p>
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
        <div
          v-if="addingSearch"
          class="saved-card saved-card--editing"
          :class="[`saved-card--${newSearchMode}`, { 'has-error': !!searchError }]"
        >
          <input
            ref="addSearchInput"
            v-model="newKeyword"
            type="text"
            class="saved-inline-input"
            :placeholder="$t('courses.savedSearches.placeholder')"
            :aria-label="$t('courses.savedSearches.modalTitle')"
            :aria-invalid="!!searchError"
            @keydown.enter.prevent="confirmAddSearch"
            @keydown.esc.prevent="closeAddSearch"
            @input="onSearchKeywordInput"
            @blur="onSearchBlur"
          />
          <button
            type="button"
            class="saved-mode-toggle"
            :aria-label="$t('courses.savedSearches.modeLabel')"
            @mousedown.prevent
            @click="newSearchMode = newSearchMode === 'recorded' ? 'live' : 'recorded'"
          >{{ $t(newSearchMode === 'live' ? 'navigation.live' : 'navigation.recorded') }}</button>
        </div>
        <div v-else class="saved-card saved-card--add" @click="openAddSearch">
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
            v-intersect="() => loadThumbnail('live', course)"
            @click="openCourse('live', course)"
          >
            <div class="preview-thumb">
              <img v-if="thumbnails[course.id]" :src="thumbnails[course.id]" class="preview-img" alt="" />
              <img
                v-else-if="!coverFailed.has(course.id)"
                :src="resolveCourseCover(course.imageUrl)"
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
              <p class="preview-subtitle">{{ liveSubtitle(course) }}</p>
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
            v-intersect="() => loadThumbnail('recorded', course)"
            @click="openCourse('recorded', course)"
          >
            <div class="preview-thumb">
              <img v-if="thumbnails[course.id]" :src="thumbnails[course.id]" class="preview-img" alt="" />
              <img
                v-else-if="!coverFailed.has(course.id)"
                :src="resolveCourseCover(course.imageUrl)"
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
              <p class="preview-subtitle">{{ recordedSubtitle(course) }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="addingSearch && searchError"
        class="saved-inline-error"
        role="alert"
        :style="searchErrorStyle"
      >{{ searchError }}</div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGreeting } from '@features/platform/useGreeting'
import { useAuth } from '@features/platform/useAuth'
import { useHomePage } from '@features/course/useHomePage'
import { useHomeThumbnails } from '@features/course/useHomeThumbnails'
import { useSearchPage } from '@features/course/useSearchPage'
import { openCourse } from '@features/course/courseSelection'
import { getCourseStatusClass, getCourseStatusText, type Course } from '@features/course/useCourseList'
import { mergedSavedSearches, addSavedSearch, removeSavedSearch, savedSearchesLive, savedSearchesRecorded } from '@features/course/savedSearches'
import { pinnedRecordedCourses, removePinnedCourse, openPinnedCourse } from '@features/course/pinnedCourses'
import { useCampusNetworkCheck } from '@features/platform/useCampusNetworkCheck'
import { settingsLauncher } from '@features/settings/settingsLauncher'
import { configStore } from '@shared/services/configStore'
import HomeWelcomeDemo from './HomeWelcomeDemo.vue'

const { t } = useI18n()
const { greetingText, loadGreeting, resetGreeting } = useGreeting()
const { isLoggedIn, userId, openSsoModal } = useAuth()
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
const { thumbnails, loadThumbnail, clearThumbnails } = useHomeThumbnails()

// Campus-network connectivity warning (only meaningful in internal mode).
const { campusCheckStatus, runCampusCheck } = useCampusNetworkCheck()
// Keeps the banner visible (with a spinning icon) through a manual recheck —
// runCampusCheck briefly flips status to 'checking', which would otherwise
// hide the v-if="=== 'warning'" banner mid-check.
const rechecking = ref(false)
const recheckCampusConnection = async () => {
  rechecking.value = true
  try {
    await runCampusCheck()
  } finally {
    rechecking.value = false
  }
}

const switchToExternal = async () => {
  await window.electronAPI.config.setConnectionMode('external')
  // configStore updates via the config:onUpdate broadcast; the connectionMode
  // watcher below then re-runs the check and clears the warning.
}

const openIntranetSettings = () => {
  settingsLauncher.openSettingsTab('network')
}

// Before the monitor-icon fallback, show the API course cover (image_url / img),
// falling back only to Yanhekt's default front_cover.png.
const DEFAULT_COURSE_COVER = 'https://coss.yanhekt.cn/images/front_cover.png'
const coverFailed = reactive(new Set<string>())
const resolveCourseCover = (imageUrl?: string | null): string => {
  const trimmed = imageUrl?.trim()
  return trimmed ? trimmed : DEFAULT_COURSE_COVER
}
const markCoverFailed = (id: string): void => { coverFailed.add(id) }

// One compact meta line under each preview (instructor · semester).
// Recorded `time` is already "YYYY-YYYY Fall/Spring" from transformCourseDataToCourse;
// live streams have no semester fields, so they show instructor only.
const liveSubtitle = (course: Course): string =>
  course.instructor || ''
const recordedSubtitle = (course: Course): string =>
  [course.instructor, course.time].filter(Boolean).join(' · ')

// Lazily generate a card's preview the first time it scrolls near the viewport.
const intersectObservers = new WeakMap<Element, IntersectionObserver>()
const vIntersect = {
  mounted(el: Element, binding: { value: () => void }) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          binding.value()
          observer.unobserve(el)
        }
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    intersectObservers.set(el, observer)
  },
  unmounted(el: Element) {
    intersectObservers.get(el)?.disconnect()
    intersectObservers.delete(el)
  }
}

const addingSearch = ref(false)
const newKeyword = ref('')
const newSearchMode = ref<'live' | 'recorded'>('recorded')
const addSearchInput = ref<HTMLInputElement | null>(null)
const searchError = ref('')
const searchErrorStyle = ref<Record<string, string>>({})
let suppressSearchBlur = false

function syncSearchErrorPos(): void {
  const el = addSearchInput.value
  if (!el) return
  const r = el.getBoundingClientRect()
  searchErrorStyle.value = {
    top: `${Math.round(r.bottom + 4)}px`,
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(Math.max(r.width, 180))}px`,
  }
}

function searchKeywordMessage(raw: string): string {
  const kw = raw.trim()
  if (!kw) return t('courses.savedSearches.empty')
  const current = newSearchMode.value === 'live' ? savedSearchesLive.value : savedSearchesRecorded.value
  if (current.includes(kw)) return t('courses.savedSearches.duplicate')
  return ''
}

const openAddSearch = () => {
  newKeyword.value = ''
  newSearchMode.value = 'recorded'
  searchError.value = ''
  addingSearch.value = true
  nextTick(() => {
    addSearchInput.value?.focus()
    syncSearchErrorPos()
  })
}
const closeAddSearch = () => {
  suppressSearchBlur = true
  addingSearch.value = false
  newKeyword.value = ''
  searchError.value = ''
  nextTick(() => { suppressSearchBlur = false })
}
const onSearchKeywordInput = () => {
  if (!searchError.value) return
  searchError.value = searchKeywordMessage(newKeyword.value)
  nextTick(syncSearchErrorPos)
}
const confirmAddSearch = () => {
  const err = searchKeywordMessage(newKeyword.value)
  if (err) {
    searchError.value = err
    nextTick(() => {
      syncSearchErrorPos()
      addSearchInput.value?.focus()
    })
    return
  }
  addSavedSearch(newSearchMode.value, newKeyword.value)
  closeAddSearch()
}
const onSearchBlur = () => {
  if (suppressSearchBlur) return
  if (!newKeyword.value.trim()) {
    closeAddSearch()
    return
  }
  const err = searchKeywordMessage(newKeyword.value)
  if (err) {
    searchError.value = err
    nextTick(syncSearchErrorPos)
    return
  }
  confirmAddSearch()
}

watch(newSearchMode, () => {
  if (!searchError.value) return
  searchError.value = searchKeywordMessage(newKeyword.value)
  nextTick(syncSearchErrorPos)
})
watch(addingSearch, (open) => {
  if (open) window.addEventListener('resize', syncSearchErrorPos)
  else window.removeEventListener('resize', syncSearchErrorPos)
})
onUnmounted(() => {
  window.removeEventListener('resize', syncSearchErrorPos)
})

// Watch userId too: switching accounts stays logged-in (isLoggedIn unchanged),
// so a plain isLoggedIn watch would leave the previous account's rows/greeting.
watch([isLoggedIn, userId], ([loggedIn]) => {
  if (loggedIn) {
    // Clear the previous account's cached rows + module-level thumbnail cache,
    // re-roll the (name-bearing) greeting, then load the new account's rows.
    clearPersonalRows()
    clearThumbnails()
    resetGreeting()
    loadGreeting()
    loadPersonalRows()
  } else {
    clearPersonalRows()
    clearThumbnails()
  }
})

// Re-probe whenever the connection mode flips (e.g. user switches to external
// from the warning, or enables internal mode in settings).
watch(() => configStore.connectionMode, () => {
  runCampusCheck()
})

onMounted(() => {
  loadGreeting()
  if (isLoggedIn.value) {
    loadPersonalRows()
  }
  // Fire-and-forget; never blocks the page.
  runCampusCheck()
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

.home-page--welcome {
  display: flex;
  flex-direction: column;
}

.home-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px 16px 36px;
  min-height: 0;
}

.home-feature-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35em;
  margin: 22px 0 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.35px;
  line-height: 1.25;
  color: var(--text-primary);
}

.home-feature-out {
  color: var(--accent);
}

.home-feature-lead {
  margin: 8px 0 0;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.home-yanhekt-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 22px;
  box-sizing: border-box;
  min-height: 36px;
  padding: 6px 16px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.home-yanhekt-cta:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.home-yanhekt-wordmark {
  display: block;
  width: 76px;
  height: 25px;
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

.home-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
  margin: -24px -32px 20px;
  padding: 7px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  background-color: var(--warning-bg);
  border-bottom: 1px solid var(--border-color);
}

.home-banner-msg {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.home-banner-msg svg {
  color: var(--warning);
  flex-shrink: 0;
}

.home-banner-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  color: var(--link-color);
  cursor: pointer;
  white-space: nowrap;
}

.home-banner-link:hover {
  text-decoration: underline;
}

.home-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.home-banner-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.home-banner-icon-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.home-banner-icon-btn.is-spinning svg {
  animation: home-banner-spin 0.8s linear infinite;
}

@keyframes home-banner-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.home-section {
  margin-bottom: 20px;
}

/* Apple Music style: hairline divider between consecutive sections */
.home-section + .home-section {
  border-top: 1px solid var(--border-color);
  padding-top: 18px;
}

.home-section-title {
  margin: 0 0 12px;
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
  grid-auto-columns: 260px;
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

.saved-card--editing,
.saved-card--editing:hover {
  overflow: visible;
  cursor: default;
  gap: 8px;
  padding: 8px 10px;
  border-color: var(--accent);
  box-shadow: none;
}

.saved-card--editing.has-error,
.saved-card--editing.has-error:hover {
  border-color: var(--danger);
}

.saved-inline-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  box-shadow: none;
}

.saved-mode-toggle {
  flex-shrink: 0;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.saved-inline-error {
  position: fixed;
  z-index: var(--z-overlay);
  box-sizing: border-box;
  padding: 6px 8px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 4px;
  color: var(--danger);
  font-size: 11px;
  line-height: 1.35;
  box-shadow: 0 4px 12px var(--shadow-md);
  pointer-events: none;
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

/* Infuse-style preview card: 16:9 thumbnail on top, text below */
.preview-card {
  flex-shrink: 0;
  width: 248px;
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

</style>
