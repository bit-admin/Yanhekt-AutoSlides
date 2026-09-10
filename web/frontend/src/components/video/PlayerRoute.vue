<template>
  <PlaybackPage
    v-if="state === 'ready'"
    :course="course"
    :session="session"
    :mode="mode"
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
import { getSubscribedCourse, upgradeSubscribedCourse } from '../../composables/subscribedCourses'
import { getCourseInfo, getLiveById, type LiveStream, type SessionData } from '../../lib/api'
import { transformLiveStreamToCourse, type Course } from '../../composables/useCourseList'
import { lookupCourseById, needsListHydration } from '../../composables/lookupCourseById'
import { courseDisplayTitle } from '../../i18n/displayNames'
import { getCurrentLocale } from '../../i18n'
import {
  liveCourseTitleEn,
  rememberLiveCourseTitleEn,
  wantsEnglishTitle,
} from '../../composables/liveCourseTitles'

// Route component for /player/live/:courseId and
// /player/recorded/:courseId/:sessionId. Owns playback hydration: in-app
// navigation hands the loaded Course/Session over via courseTransfer (warm,
// zero fetches); a cold load (deep link, refresh) rebuilds them from the API.
// The instance is keyed by fullPath in MainContent, so params never change
// within its lifetime.

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

/**
 * Merge list-only fields onto a course without overwriting a live broadcast
 * `id` (list rows use the real course id). Used after `lookupCourseById`.
 */
const attachListFields = (base: Course, list: Course): Course => ({
  ...base,
  title: base.title || list.title,
  titleEn: base.titleEn || list.titleEn,
  instructor: base.instructor || list.instructor,
  time: base.time || list.time,
  professors: base.professors && base.professors.length > 0 ? base.professors : list.professors,
  college_name: base.college_name || list.college_name,
  school_year: base.school_year || list.school_year,
  semester: base.semester || list.semester,
  classrooms: base.classrooms && base.classrooms.length > 0 ? base.classrooms : list.classrooms,
  participant_count: base.participant_count ?? list.participant_count,
})

/** Soft list lookup for classrooms when the in-hand course is list-incomplete. */
const fillListFields = async (
  token: string,
  realCourseId: string | undefined,
  upgradeSubscribe: boolean,
): Promise<void> => {
  if (!course.value || !realCourseId || !needsListHydration(course.value)) return
  const list = await lookupCourseById(token, realCourseId)
  if (!list || !course.value) return
  course.value = attachListFields(course.value, list)
  if (upgradeSubscribe) {
    upgradeSubscribedCourse({
      ...list,
      title: course.value.title || list.title,
      titleEn: course.value.titleEn || list.titleEn,
      instructor: course.value.instructor || list.instructor,
      professors: course.value.professors?.length ? course.value.professors : list.professors,
      college_name: course.value.college_name || list.college_name,
      school_year: course.value.school_year || list.school_year,
      semester: course.value.semester || list.semester,
      time: course.value.time || list.time,
    })
  }
}

const hydrateRecorded = async (token: string): Promise<void> => {
  // Sessions from getCourseInfo; classrooms from list search when missing.
  const infoPromise = getCourseInfo(courseId, token)
  const listPromise = needsListHydration(course.value)
    ? lookupCourseById(token, courseId)
    : Promise.resolve(null)
  const [info, listCourse] = await Promise.all([infoPromise, listPromise])

  // Mirror useSessionPage's normalization: semester arrives as a number here
  // (vs a string from the course list) and the display term derives from
  // school_year + semester.
  const semesterStr = info.semester != null ? String(info.semester) : undefined
  const fetched: Course = {
    id: courseId,
    title: info.title || '',
    titleEn: info.title_en,
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
  let merged: Course = base
    ? {
        ...base,
        title: base.title || fetched.title,
        titleEn: base.titleEn || fetched.titleEn,
        instructor: base.instructor || fetched.instructor,
        time: base.time || fetched.time,
        professors: base.professors && base.professors.length > 0 ? base.professors : fetched.professors,
        college_name: base.college_name || fetched.college_name,
        school_year: base.school_year || fetched.school_year,
        semester: base.semester || fetched.semester,
      }
    : fetched
  if (listCourse) {
    merged = attachListFields(merged, listCourse)
    upgradeSubscribedCourse({
      ...listCourse,
      title: merged.title || listCourse.title,
      titleEn: merged.titleEn || listCourse.titleEn,
      instructor: merged.instructor || listCourse.instructor,
      professors: merged.professors?.length ? merged.professors : listCourse.professors,
      college_name: merged.college_name || listCourse.college_name,
      school_year: merged.school_year || listCourse.school_year,
      semester: merged.semester || listCourse.semester,
      time: merged.time || listCourse.time,
    })
  }
  course.value = merged
  if (!session.value) {
    const found = info.videos.find((v) => v.session_id === sessionId) ?? null
    if (!found) {
      state.value = 'not-found'
      return
    }
    session.value = found
  }
}

/**
 * Fill `titleEn` on a live course that arrived from a list row. No-op unless the
 * UI is English, the course is live, and its English name is still unknown.
 */
const fillLiveTitleEn = async (): Promise<void> => {
  if (mode !== 'live' || !wantsEnglishTitle()) return
  const realCourseId = course.value?.courseId
  const token = authStore.token.value
  if (!realCourseId || !token || course.value?.titleEn) return
  const titleEn = await liveCourseTitleEn(realCourseId, token)
  // The tab may have moved on while the lookup was in flight.
  if (titleEn && course.value && course.value.courseId === realCourseId) {
    course.value = { ...course.value, titleEn }
  }
}

const hydrateLive = async (token: string): Promise<void> => {
  // `courseId` is the route param, which for live is really the BROADCAST id.
  // getLiveById resolves it directly; this used to page the personal list and
  // then the public list looking for a matching row, up to ten requests.
  let detail: LiveStream
  try {
    detail = await getLiveById(courseId, token)
  } catch (error: unknown) {
    // 直播不存在 (12131011) is the expected answer for a stale or bad link, and
    // is a 'not-found', not an error worth a Retry button. Anything else — a
    // network failure, an upstream outage — keeps the retryable error state.
    if (error instanceof Error && /12131011|直播不存在/.test(error.message)) {
      state.value = 'not-found'
      return
    }
    throw error
  }

  course.value = transformLiveStreamToCourse(detail)
  // Free English title: unlike a live-list row, the by-id payload nests the full
  // course, name_en included. Seed the cache so a later warm open of the same
  // course skips its lookup too.
  const detailTitleEn = detail.course?.name_en
  if (course.value.courseId) rememberLiveCourseTitleEn(course.value.courseId, detailTitleEn)
  if (wantsEnglishTitle()) {
    course.value = { ...course.value, titleEn: detailTitleEn }
  }
  // Real course id rides on courseId (broadcast stays in `id`). List lookup
  // fills classrooms for adaptive SSIM / metadata, plus participant_count,
  // which the live-detail payload does not carry.
  await fillListFields(token, course.value.courseId, false)
  // Fallback for a course the list lookup cannot see (keyword search on the id
  // can miss). Live detail nests its own classrooms, so adaptive SSIM still
  // gets a room name even then.
  if (course.value && needsListHydration(course.value) && detail.course?.classrooms?.length) {
    course.value = { ...course.value, classrooms: detail.course.classrooms }
  }
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
  // (preferred cache for classrooms on cold load). List lookup still runs when
  // the in-hand course is list-incomplete. A course without a title is an
  // unhydrated stub — don't trust it, fall through to the API merge below.
  if (!course.value) {
    course.value =
      takeCourse(courseId) ?? (mode === 'recorded' ? getSubscribedCourse(courseId) : null)
  }
  if (mode === 'recorded' && !session.value && sessionId) {
    session.value = takeSession(courseId, sessionId) ?? null
  }

  const token = authStore.token.value
  if (!token) {
    // Warm local state is enough to play; list hydrate needs a token, so skip it.
    if (course.value?.title && (mode === 'live' || session.value)) {
      state.value = 'ready'
      return
    }
    state.value = 'signed-out'
    return
  }

  // Title + session (or live course) already in hand: only fill missing classrooms.
  if (course.value?.title && (mode === 'live' || session.value)) {
    // A live card handed over from the grid has no English name — list rows
    // never carry one. Cached per course, so this is one request per course
    // ever, and none outside an English UI. Deliberately not awaited: playback
    // must not wait on a cosmetic title.
    void fillLiveTitleEn()
    if (needsListHydration(course.value)) {
      state.value = 'loading'
      errorMessage.value = ''
      try {
        const realId = mode === 'live' ? course.value.courseId : courseId
        await fillListFields(token, realId, mode === 'recorded')
        state.value = 'ready'
      } catch (error: unknown) {
        console.error('Failed to hydrate playback route:', error)
        // Classrooms are best-effort — still enter ready so playback works.
        state.value = 'ready'
      }
      return
    }
    state.value = 'ready'
    return
  }

  state.value = 'loading'
  errorMessage.value = ''
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

// Switching the UI to English mid-playback still has to resolve the title —
// hydrate() already ran, and nothing else refetches a live tab.
watch(getCurrentLocale, () => {
  void fillLiveTitleEn()
})

// The hydrated course names the tab (browse routes use meta.titleKey instead).
watch([state, course], () => {
  if (state.value === 'ready' && course.value?.title) {
    document.title = `${courseDisplayTitle(course.value)} - AutoSlides`
  }
})

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
