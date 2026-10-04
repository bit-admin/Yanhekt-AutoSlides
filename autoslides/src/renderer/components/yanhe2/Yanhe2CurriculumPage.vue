<template>
  <div class="yanhe2-curriculum">
    <PageBanner
      v-if="yanhe2SignedIn && problem"
      tone="danger"
      :recheck-label="$t('yanhe2Calendar.retry')"
      :busy="loading"
      @recheck="refresh"
    >
      {{ problemText }}
    </PageBanner>

    <!-- Same title bands as Recorded: a centered title over the course grid,
         Back + the course title over its sessions. -->
    <div v-if="selected" class="header header--course">
      <div class="header-main">
        <button type="button" class="btn back-btn" @click="backToCourses">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2 :title="selected.title">{{ selected.title }}</h2>
        <button type="button" class="btn expand-btn" :aria-expanded="showDetails" @click="showDetails = !showDetails">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ rotated: showDetails }" aria-hidden="true">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="course-details">
        <div v-if="selected.teacher" class="course-detail-item">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ selected.teacher }}</span>
        </div>
        <div v-if="termLabel(selected)" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.academicTerm') }}</span>
          <span class="detail-value">{{ termLabel(selected) }}</span>
        </div>
        <div v-if="classrooms.length > 0" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ classrooms.join(', ') }}</span>
        </div>
        <div v-if="selected.college" class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ selected.college }}</span>
        </div>
      </div>
    </div>
    <div v-else class="header">
      <h2 class="page-title">{{ $t('yanhe2Curriculum.title') }}</h2>
    </div>

    <div class="content">
      <SignedOutPanel v-if="!yanhe2ActiveBadge" :title="$t('yanhe2Curriculum.signInMain')" />

      <!-- Signed in to AutoSlides, but no live Yanhe 2.0 session for this account. -->
      <div v-else-if="!yanhe2SignedIn" class="connect">
        <template v-if="yanhe2MenuPhase !== 'idle'">
          <div class="spinner"></div>
          <p class="connect-hint">{{ $t('yanhe2Calendar.connecting') }}</p>
        </template>
        <template v-else>
          <span class="connect-title">{{ $t('yanhe2Curriculum.connectTitle') }}</span>
          <p class="connect-hint">{{ $t('yanhe2Curriculum.connectHint') }}</p>
          <button type="button" class="btn btn--primary" @click="requestYanhe2SsoSignIn">
            {{ $t('yanhe2Calendar.connectButton') }}
          </button>
        </template>
      </div>

      <!-- One course's sessions -->
      <template v-else-if="selected">
        <div v-if="sessionsLoading && sessions.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('yanhe2Curriculum.loadingSessions') }}</p>
        </div>
        <!-- A course with no sessions attached is a normal answer, not an error. -->
        <EmptySetState
          v-else-if="sessionsLoaded && sessions.length === 0"
          :title="$t('yanhe2Curriculum.noSessions')"
          :hint="$t('yanhe2Curriculum.noSessionsHint')"
        />
        <div v-else class="sessions-list custom-scrollbar">
          <component
            :is="isYanhe2Playable(s.status) ? 'button' : 'div'"
            v-for="s in sessions"
            :key="s.subId"
            :type="isYanhe2Playable(s.status) ? 'button' : undefined"
            :class="['session-item', { playable: isYanhe2Playable(s.status) }]"
            @click="openYanhe2Session(s)"
          >
            <span class="session-icon">
              <!-- Same generic-video glyph the Recorded sessions list uses. -->
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/>
              </svg>
            </span>
            <span class="session-info">
              <span class="session-title">{{ sessionTitle(s) }}</span>
              <span class="session-meta">
                <span v-if="clockLine(s)" class="session-time">{{ clockLine(s) }}</span>
                <span v-if="s.room">{{ s.room }}</span>
                <span v-if="s.teacher" class="session-teacher">{{ s.teacher }}</span>
              </span>
            </span>
            <span v-if="s.status !== 'unknown'" :class="['session-status', `status-${s.status}`]">
              {{ $t(`yanhe2Calendar.status.${s.status}`) }}
            </span>
          </component>
        </div>
      </template>

      <!-- Enrolled courses -->
      <template v-else>
        <div v-if="coursesLoading && courses.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('yanhe2Curriculum.loading') }}</p>
        </div>
        <EmptySetState
          v-else-if="coursesLoaded && courses.length === 0"
          :title="$t('yanhe2Curriculum.noCourses')"
          :hint="$t('yanhe2Curriculum.noCoursesHint')"
        />
        <template v-else>
          <!-- The Recorded course grid: 16 cards a page, 4 × 4. -->
          <div class="courses-grid custom-scrollbar">
            <div
              v-for="course in pageCourses"
              :key="course.courseId"
              class="course-card"
              role="button"
              tabindex="0"
              @click="openCourse(course)"
              @keydown.enter="openCourse(course)"
            >
              <div class="course-id">#{{ course.courseId }}</div>
              <div class="course-info">
                <h3 class="course-title" :title="course.title">{{ course.title }}</h3>
                <p class="course-instructor">{{ course.teacher }}</p>
                <p class="course-time">{{ termLabel(course) }}</p>
                <p v-if="course.college" class="course-section">{{ course.college }}</p>
              </div>
            </div>
          </div>
          <div v-if="courses.length > 0" class="pagination">
            <button type="button" class="btn page-btn" :disabled="page === 1" @click="page--">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <span class="page-info">{{ page }} / {{ pageCount }}</span>
            <button type="button" class="btn page-btn" :disabled="page === pageCount" @click="page++">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Yanhe 2.0 → Curriculum. The account's enrolled courses (aita's 我的课程), then
// one course's sessions in the same page, then the Yanhe 2.0 playback tab.
// Browse only: none of the Recorded sessions page's pin / index / task /
// download actions exist here.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, beijingDate, lessonRange, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2Course } from '@common/yanhe2Curriculum'
import { isYanhe2Playable } from '@common/yanhe2Playback'
import { navigationStore } from '@features/course/navigationStore'
import {
  requestYanhe2SsoSignIn,
  yanhe2ActiveBadge,
  yanhe2MenuPhase,
  yanhe2SignedIn,
} from '@features/platform/yanhe2AccountUi'
import { useYanhe2Curriculum } from '@features/yanhe2/useYanhe2Curriculum'
import { academicTermLabel } from '@shared/i18n/displayNames'
import EmptySetState from '../shell/EmptySetState.vue'
import PageBanner from '../shell/PageBanner.vue'
import SignedOutPanel from '../shell/SignedOutPanel.vue'
import { openYanhe2Session } from './openYanhe2Session'

const { t, locale } = useI18n()

const {
  courses,
  coursesLoading,
  coursesProblem,
  coursesLoaded,
  selected,
  sessions,
  sessionsLoading,
  sessionsProblem,
  sessionsLoaded,
  refresh,
  openCourse,
  backToCourses,
} = useYanhe2Curriculum({
  badge: yanhe2ActiveBadge,
  signedIn: yanhe2SignedIn,
  active: computed(() => navigationStore.activeNav.value === 'yanhe2-curriculum'),
})

// Main hands over the whole enrolled list, so paging is local: the same 16 a
// page as the Recorded grid.
const PAGE_SIZE = 16
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(courses.value.length / PAGE_SIZE)))
const pageCourses = computed(() => courses.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
// A refresh that comes back shorter must not leave the grid on a page that is gone.
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

const problem = computed(() => (selected.value ? sessionsProblem.value : coursesProblem.value))
const loading = computed(() => (selected.value ? sessionsLoading.value : coursesLoading.value))
const problemText = computed(() => {
  if (problem.value === 'network') return t('yanhe2Calendar.errorNetwork')
  return selected.value ? t('yanhe2Curriculum.errorDetailFailed') : t('yanhe2Curriculum.errorFailed')
})

// `2026-2027` + `1` → the same worded term the Recorded cards show; aita's own
// `2026-2027-1` when the row carried no term fields.
const termLabel = (course: Yanhe2Course) => academicTermLabel(course.schoolYear, course.semester, course.term)

// The Recorded sessions page's details panel, closed until asked for, and
// closed again for the next course.
const showDetails = ref(false)
watch(() => selected.value?.courseId, () => {
  showDetails.value = false
})

// The course row names no room; its sessions do.
const classrooms = computed(() => [...new Set(sessions.value.map((s) => s.room).filter(Boolean))])

// The row's title is its date and lessons: every row of the list is the same course.
const sessionTitle = (s: Yanhe2CalendarSession) => {
  const range = lessonRange(s.subTitle)
  const lessons = !range
    ? ''
    : range.from === range.to
      ? t('yanhe2Calendar.lesson', { n: range.from })
      : t('yanhe2Calendar.lessons', { from: range.from, to: range.to })
  if (!s.startAt) return s.subTitle || s.title
  // The session's Beijing day, formatted as UTC so the viewer's zone cannot shift it.
  const day = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${beijingDate(s.startAt * 1000)}T00:00:00Z`))
  return [day, lessons].filter(Boolean).join(' · ')
}

const clockLine = (s: Yanhe2CalendarSession) => {
  const start = beijingClock(s.startAt)
  const end = beijingClock(s.endAt)
  return start && end ? `${start} – ${end}` : start
}
</script>

<style scoped>
.yanhe2-curriculum {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Same tinted title band as the Recorded course grid. */
.header {
  flex-shrink: 0;
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
}

/* …and the Recorded sessions page's: Back, the course, and its details panel. */
.header--course {
  padding: 0;
  margin-bottom: 24px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
}

.back-btn {
  flex-shrink: 0;
}

.header-main h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Square 32×32 icon button — padding:0 so .btn's own padding does not crush the chevron. */
.expand-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.course-details {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.course-detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 24px 16px;
}

.connect {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.connect-title {
  font-size: 14px;
  font-weight: 600;
}

.connect-hint {
  margin: 0 0 4px;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-muted);
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
  animation: yanhe2-curriculum-spin 0.8s linear infinite;
}

@keyframes yanhe2-curriculum-spin {
  to { transform: rotate(360deg); }
}

/* The Recorded grid: a page is 16 cards, 4 columns × 4 rows stretched to fill
   the height. Rows share extra space (1fr) but never shrink below the card's
   own content (min-content); a short window scrolls instead of clipping. */
.courses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, minmax(min-content, 1fr));
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  min-height: 0;
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

/* Same card as CoursePage. */
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
  border-color: var(--border-strong);
  box-shadow: 0 1px 3px var(--shadow-sm);
}

.course-card:focus-visible,
.session-item.playable:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
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

/* Two fixed 15px line boxes: see CoursePage for why `min-height` must match the clamp exactly. */
.course-title {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 30px;
}

.course-instructor,
.course-time,
.course-section {
  margin: 0 0 4px 0;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-instructor {
  color: var(--text-secondary);
  font-weight: 500;
}

.course-section {
  font-size: 9px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* Square 32×32 icon button — padding:0 so .btn's own padding does not crush the chevron. */
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

/* Same rows as the Recorded sessions list, minus its action buttons. */
.sessions-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px;
  padding-right: 10px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  font: inherit;
  color: inherit;
  text-align: left;
}

/* Only a session with something to play gets the pointer and hover. */
.session-item.playable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.session-item.playable:hover {
  border-color: var(--border-strong);
  box-shadow: 0 1px 3px var(--shadow-sm);
}

.session-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.session-item:not(.playable) .session-icon,
.session-item:not(.playable) .session-title {
  color: var(--text-muted);
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.session-title {
  margin-bottom: 2px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  display: flex;
  gap: 12px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
}

.session-meta span {
  white-space: nowrap;
}

.session-time {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.session-teacher {
  color: var(--text-muted);
}

.session-status {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
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
</style>
