<template>
  <div class="home-page custom-scrollbar">
    <div class="home-hero">
      <h1 class="home-greeting">{{ greetingText }}</h1>
      <p class="home-tagline">AutoSlides</p>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { authStore } from '../../stores/authStore'
import { navigationStore } from '../../stores/navigationStore'

const FALLBACK_COVER = 'https://coss.yanhekt.cn/images/front_cover.png'
const ROW_SIZE = 12

const { t, locale } = useI18n()
const { isLoggedIn, userNickname, userId } = authStore
const { activeNav } = navigationStore

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
