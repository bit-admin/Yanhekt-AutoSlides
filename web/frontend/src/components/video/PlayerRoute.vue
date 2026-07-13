<template>
  <PlaybackPage
    v-if="state === 'ready'"
    :course="course"
    :session="session"
    :mode="mode"
    @back="handleBack"
  />

  <div v-else class="player-route-state">
    <template v-if="state === 'verifying' || state === 'loading'">
      <div class="spinner"></div>
      <p>{{ $t('playback.loadingVideoStreams') }}</p>
    </template>

    <template v-else-if="state === 'signed-out'">
      <p>{{ $t('playback.signInToWatch') }}</p>
    </template>

    <template v-else-if="state === 'not-found'">
      <p>{{ mode === 'live' ? $t('playback.streamNotFound') : $t('playback.sessionNotFound') }}</p>
      <button class="btn btn--primary" @click="goToBrowse">
        {{ mode === 'live' ? $t('playback.goToLive') : $t('playback.goToCourse') }}
      </button>
    </template>

    <template v-else>
      <p>{{ errorMessage || $t('playback.loadFailed') }}</p>
      <button class="btn" @click="hydrate">{{ $t('playback.retry') }}</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import PlaybackPage from './PlaybackPage.vue'
import { router } from '../../router'
import { authStore } from '../../stores/authStore'
import { playbackStore } from '../../stores/playbackStore'
import { takeCourse, takeSession } from '../../stores/courseTransfer'
import { getSubscribedCourse } from '../../composables/subscribedCourses'
import { getCourseInfo, getLiveList, getPersonalLiveList, type SessionData } from '../../lib/api'
import { transformLiveStreamToCourse, type Course } from '../../composables/useCourseList'

// Route component for /player/live/:courseId and
// /player/recorded/:courseId/:sessionId. Owns playback hydration: in-app
// navigation hands the loaded Course/Session over via courseTransfer (warm,
// zero fetches); a cold load (deep link, refresh) rebuilds them from the API.
// The instance is keyed by fullPath in MainContent, so params never change
// within its lifetime.

// How many public live-list pages the cold-load scan reads before giving up
// (there is no fetch-live-by-id endpoint; the personal list is scanned fully).
const LIVE_SCAN_PAGE_SIZE = 50
const LIVE_SCAN_MAX_PAGES = 5

type PlayerState = 'verifying' | 'signed-out' | 'loading' | 'ready' | 'not-found' | 'error'

const route = useRoute()
const mode: 'live' | 'recorded' = route.name === 'player-live' ? 'live' : 'recorded'
const courseId = String(route.params.courseId ?? '')
const sessionId = mode === 'recorded' ? String(route.params.sessionId ?? '') : null

// Starts at 'verifying', never 'loading': the immediate watch below skips
// 'loading' as re-entrancy protection, so it must not be the initial value.
const state = ref<PlayerState>('verifying')
const course = ref<Course | null>(null)
const session = ref<SessionData | null>(null)
const errorMessage = ref('')

const hydrateRecorded = async (token: string): Promise<void> => {
  const info = await getCourseInfo(courseId, token)
  // Mirror useSessionPage's normalization: semester arrives as a number here
  // (vs a string from the course list) and the display term derives from
  // school_year + semester.
  const semesterStr = info.semester != null ? String(info.semester) : undefined
  const fetched: Course = {
    id: courseId,
    title: info.title || '',
    instructor: info.professor || '',
    time: info.school_year
      ? `${info.school_year} ${Number(info.semester) === 1 ? 'Fall' : 'Spring'}`
      : '',
    professors: info.professors,
    college_name: info.college_name,
    school_year: info.school_year,
    semester: semesterStr,
  }
  // A stashed course may be a bare stub (empty title) — handed-over values
  // win, fetched ones fill the gaps (same merge rule as useSessionPage).
  const base = course.value
  course.value = base
    ? {
        ...base,
        title: base.title || fetched.title,
        instructor: base.instructor || fetched.instructor,
        time: base.time || fetched.time,
        professors: base.professors && base.professors.length > 0 ? base.professors : fetched.professors,
        college_name: base.college_name || fetched.college_name,
        school_year: base.school_year || fetched.school_year,
        semester: base.semester || fetched.semester,
      }
    : fetched
  if (!session.value) {
    const found = info.videos.find((v) => v.session_id === sessionId) ?? null
    if (!found) {
      state.value = 'not-found'
      return
    }
    session.value = found
  }
}

const hydrateLive = async (token: string): Promise<void> => {
  // Raw list entries carry numeric ids at runtime — compare as strings.
  const matches = (id?: string | number) => id != null && id !== "" && String(id) === courseId
  // Personal list first (small, most likely hit), then the public list up to
  // a hard page cap — best-effort by design.
  for (let page = 1; page <= LIVE_SCAN_MAX_PAGES; page++) {
    const response = await getPersonalLiveList(token, page, LIVE_SCAN_PAGE_SIZE)
    const hit = response.data.find((s) => matches(s.id) || matches(s.live_id))
    if (hit) {
      course.value = transformLiveStreamToCourse(hit)
      return
    }
    if (page >= response.last_page) break
  }
  for (let page = 1; page <= LIVE_SCAN_MAX_PAGES; page++) {
    const response = await getLiveList(token, page, LIVE_SCAN_PAGE_SIZE)
    const hit = response.data.find((s) => matches(s.id) || matches(s.live_id))
    if (hit) {
      course.value = transformLiveStreamToCourse(hit)
      return
    }
    if (page >= response.last_page) break
  }
  state.value = 'not-found'
}

const hydrate = async (): Promise<void> => {
  if (authStore.isVerifyingToken.value) {
    state.value = 'verifying'
    return
  }
  if (!authStore.isLoggedIn.value) {
    state.value = 'signed-out'
    return
  }

  // Warm handoff from in-app navigation, then the subscribe-time snapshot
  // (the only source of classrooms — which feed the adaptive SSIM threshold —
  // and participant_count on a cold load). A course without a title is an
  // unhydrated stub — don't trust it, fall through to the API merge below.
  if (!course.value) {
    course.value =
      takeCourse(courseId) ?? (mode === 'recorded' ? getSubscribedCourse(courseId) : null)
  }
  if (mode === 'recorded' && !session.value && sessionId) {
    session.value = takeSession(courseId, sessionId) ?? null
  }
  if (course.value?.title && (mode === 'live' || session.value)) {
    state.value = 'ready'
    return
  }

  state.value = 'loading'
  errorMessage.value = ''
  const token = authStore.token.value
  if (!token) {
    state.value = 'signed-out'
    return
  }
  try {
    if (mode === 'recorded') {
      await hydrateRecorded(token)
    } else {
      await hydrateLive(token)
    }
    if (course.value && (mode === 'live' || session.value)) {
      state.value = 'ready'
    }
  } catch (error: unknown) {
    console.error('Failed to hydrate playback route:', error)
    errorMessage.value = error instanceof Error ? error.message : ''
    state.value = 'error'
  }
}

// Re-run when token verification settles or the user signs in on this page.
watch(
  [authStore.isVerifyingToken, authStore.isLoggedIn],
  () => {
    if (state.value === 'ready' || state.value === 'loading') return
    void hydrate()
  },
  { immediate: true },
)

// The hydrated course names the tab (browse routes use meta.titleKey instead).
watch([state, course], () => {
  if (state.value === 'ready' && course.value?.title) {
    document.title = `${course.value.title} - AutoSlides`
  }
})

const handleBack = () => {
  // In-app history exists → behave like a browser back. Cold deep link →
  // back would leave the site, so fall to the natural parent view.
  if (window.history.state?.back) {
    router.back()
  } else if (mode === 'recorded') {
    void router.push({ name: 'recorded-course', params: { courseId } })
  } else {
    void router.push({ name: 'live' })
  }
}

const goToBrowse = () => {
  if (mode === 'live') {
    void router.push({ name: 'live' })
  } else {
    void router.push({ name: 'recorded-course', params: { courseId } })
  }
}

// Cinema mode never outlives the player (closePlayback used to reset it).
onUnmounted(() => {
  playbackStore.cinema.value = false
})
</script>

<style scoped>
.player-route-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
