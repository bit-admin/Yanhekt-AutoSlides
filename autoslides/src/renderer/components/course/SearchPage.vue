<template>
  <div class="search-page">
    <PageErrorNotice v-if="mode !== 'yanhe2' && errorMessage && isLoggedIn" :error="errorMessage" />
    <PageBanner
      v-if="mode === 'yanhe2' && yanhe2SignedIn && yanhe2Problem"
      tone="danger"
      :recheck-label="$t('yanhe2Calendar.retry')"
      :busy="yanhe2Loading"
      @recheck="refreshYanhe2"
    >
      {{ $t(yanhe2Problem === 'network' ? 'yanhe2Calendar.errorNetwork' : 'searchPage.yanhe2ErrorFailed') }}
    </PageBanner>
    <div class="search-header">
      <SemesterSelect
        v-if="mode === 'recorded'"
        :semesters="availableSemesters"
        :model-value="selectedSemesterIds"
        @update:model-value="setSemesters"
      />
      <!-- Yanhe 2.0 filters by one term, so this one is single-choice. -->
      <SemesterSelect
        v-else-if="mode === 'yanhe2' && yanhe2SignedIn && yanhe2TermOptions.length > 0"
        single
        :semesters="yanhe2TermOptions"
        :model-value="yanhe2TermId === null ? [] : [yanhe2TermId]"
        @update:model-value="setYanhe2Term($event[0] ?? null)"
      />
      <div class="mode-switch">
        <button
          :class="['mode-pill', { active: mode === 'live' }]"
          @click="setMode('live')"
        >
          {{ $t('navigation.live') }}
        </button>
        <button
          :class="['mode-pill', { active: mode === 'recorded' }]"
          @click="setMode('recorded')"
        >
          {{ $t('navigation.recorded') }}
        </button>
        <button
          :class="['mode-pill', { active: mode === 'yanhe2' }]"
          @click="setMode('yanhe2')"
        >
          {{ $t('navigation.yanhe2') }}
        </button>
      </div>
    </div>

    <!-- Yanhe 2.0: the aita catalogue. A card opens that course's sessions on
         the Curriculum page. -->
    <div v-if="mode === 'yanhe2'" class="content">
      <SignedOutPanel v-if="!yanhe2ActiveBadge" :title="$t('searchPage.signInToSearch')" />

      <!-- Signed in to AutoSlides, but no live Yanhe 2.0 session for this account. -->
      <div v-else-if="!yanhe2SignedIn" class="connect">
        <template v-if="yanhe2MenuPhase !== 'idle'">
          <div class="spinner"></div>
          <p class="connect-hint">{{ $t('yanhe2Calendar.connecting') }}</p>
        </template>
        <template v-else>
          <span class="connect-title">{{ $t('searchPage.yanhe2ConnectTitle') }}</span>
          <p class="connect-hint">{{ $t('searchPage.yanhe2ConnectHint') }}</p>
          <button type="button" class="btn btn--primary" @click="requestYanhe2SsoSignIn">
            {{ $t('yanhe2Calendar.connectButton') }}
          </button>
        </template>
      </div>

      <div v-else-if="yanhe2Loading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <EmptySetState
        v-else-if="!yanhe2Problem && yanhe2Loaded && yanhe2Results.length === 0"
        :title="$t('courses.noResults')"
      />

      <div v-else-if="!yanhe2Problem" class="courses-grid custom-scrollbar">
        <div
          v-for="course in yanhe2Results"
          :key="course.courseId"
          class="course-card"
          @click="openYanhe2Course(course)"
        >
          <div class="course-id">#{{ course.courseId }}</div>
          <div class="course-info">
            <h3 class="course-title" :class="courseTitleSizeClass(course.title)">{{ course.title }}</h3>
            <p class="course-instructor">{{ course.teacher }}</p>
            <p class="course-time">{{ academicTermLabel(course.schoolYear, course.semester, course.term) }}</p>
            <p class="course-section" v-if="course.college">{{ course.college }}</p>
          </div>
        </div>
      </div>

      <div v-if="yanhe2SignedIn && !yanhe2Loading && yanhe2Results.length > 0" class="pagination">
        <button
          :disabled="yanhe2Page === 1"
          @click="goToYanhe2Page(yanhe2Page - 1)"
          class="btn page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <span class="page-info">{{ yanhe2Page }} / {{ yanhe2PageCount }}</span>
        <button
          :disabled="yanhe2Page === yanhe2PageCount"
          @click="goToYanhe2Page(yanhe2Page + 1)"
          class="btn page-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-else class="content">
      <SignedOutPanel v-if="!isLoggedIn" :title="$t('searchPage.signInToSearch')" />

      <div v-else-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('courses.loading') }}</p>
      </div>

      <EmptySetState v-else-if="!errorMessage && hasSearched && results.length === 0" :title="$t('courses.noResults')" />

      <div v-else-if="!errorMessage" class="courses-grid custom-scrollbar">
        <div
          v-for="course in results"
          :key="course.id"
          class="course-card"
          @click="selectResult(course)"
        >
          <div v-if="mode === 'live'" class="course-status" :class="getCourseStatusClass(course.status)">
            {{ getCourseStatusText(course.status, t) }}
          </div>
          <div v-if="mode === 'recorded'" class="course-id">
            #{{ course.id }}
          </div>
          <div class="course-info">
            <h3 class="course-title" :class="courseTitleSizeClass(courseDisplayTitle(course))">{{ courseDisplayTitle(course) }}</h3>
            <p class="course-instructor">{{ course.instructor }}</p>
            <p class="course-location" v-if="mode === 'live' && course.subtitle">{{ course.subtitle }}</p>
            <p class="course-location" v-if="mode === 'recorded' && course.classrooms">
              {{ course.classrooms.map(c => c.name).join(', ') }}
            </p>
            <p class="course-time">{{ academicTermLabel(course.school_year, course.semester, course.time) }}</p>
            <p class="course-section" v-if="mode === 'live' && course.session?.section_group_title">{{ course.session.section_group_title }}</p>
            <p class="course-section" v-if="mode === 'recorded' && course.college_name">{{ course.college_name }}</p>
            <p class="course-participants" v-if="course.participant_count !== undefined">
              {{ course.participant_count }} {{ $t('courses.info.participants') }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="isLoggedIn && !isLoading && results.length > 0" class="pagination">
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Yanhe2Course } from '@common/yanhe2Curriculum'
import { navigationStore } from '@features/course/navigationStore'
import { useSearchPage } from '@features/course/useSearchPage'
import { getCourseStatusClass, getCourseStatusText } from '@features/course/useCourseList'
import { courseDisplayTitle, academicTermLabel, courseTitleSizeClass } from '@shared/i18n/displayNames'
import type { SemesterOption } from '@shared/services/apiClient'
import { useAuth } from '@features/platform/useAuth'
import {
  requestYanhe2SsoSignIn,
  yanhe2ActiveBadge,
  yanhe2MenuPhase,
  yanhe2SignedIn,
} from '@features/platform/yanhe2AccountUi'
import { requestYanhe2CourseOpen } from '@features/yanhe2/useYanhe2Curriculum'
import { useYanhe2Search } from '@features/yanhe2/useYanhe2Search'
import SemesterSelect from './SemesterSelect.vue'
import EmptySetState from '../shell/EmptySetState.vue'
import PageBanner from '../shell/PageBanner.vue'
import PageErrorNotice from '../shell/PageErrorNotice.vue'
import SignedOutPanel from '../shell/SignedOutPanel.vue'

const { t } = useI18n()
const { isLoggedIn } = useAuth()

const {
  keyword,
  mode,
  availableSemesters,
  selectedSemesterIds,
  results,
  currentPage,
  totalPages,
  isLoading,
  errorMessage,
  hasSearched,
  goToPage,
  setMode,
  setSemesters,
  selectResult
} = useSearchPage()

// Yanhe 2.0: the same sidebar keyword, searched on aita while that source is
// the one showing.
const {
  terms: yanhe2Terms,
  termId: yanhe2TermId,
  results: yanhe2Results,
  page: yanhe2Page,
  pageCount: yanhe2PageCount,
  loading: yanhe2Loading,
  problem: yanhe2Problem,
  loaded: yanhe2Loaded,
  refresh: refreshYanhe2,
  setTerm: setYanhe2Term,
  goToPage: goToYanhe2Page,
} = useYanhe2Search({
  keyword,
  badge: yanhe2ActiveBadge,
  signedIn: yanhe2SignedIn,
  active: computed(() => navigationStore.activeNav.value === 'search' && mode.value === 'yanhe2'),
})

// aita's terms in the semester menu's own shape, so they are grouped by school
// year and worded like the Yanhekt ones.
const yanhe2TermOptions = computed<SemesterOption[]>(() =>
  yanhe2Terms.value.map((term) => ({
    id: term.id,
    label: term.name,
    labelEn: term.name,
    schoolYear: term.schoolYear,
    semester: term.semester,
  })),
)

// A result opens where a Yanhe 2.0 course lives: its sessions on Curriculum.
const openYanhe2Course = (course: Yanhe2Course) => {
  requestYanhe2CourseOpen(course)
  navigationStore.navigate('yanhe2-curriculum')
}
</script>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Apple Music style title band: right-aligned controls on a full-width tinted
   bar (same band as CoursePage, with the semester selector + mode switch
   instead of a title). */
.search-header {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 36px;
}

/* macOS-style segmented control: gray grouped track, the active segment is a
   white outlined pill (Apple Music "Apple Music | Your Library" switcher). */
.mode-switch {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--control-height);
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 100%;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 24px 16px;
}

/* Same panel as the Yanhe 2.0 pages show without a Yanhe 2.0 session. */
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
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* A page is always 16 items: 4 columns × 4 rows stretched to fill the
   available height; rows shrink to 140px minimum before scrolling kicks in. */
.courses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, minmax(140px, 1fr));
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  min-height: 0;
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
  border-color: var(--border-strong);
  box-shadow: 0 1px 3px var(--shadow-sm);
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
  /* Fixed px line box, not a ratio: the size steps below must not change the
     height of a line, or `min-height` stops matching the clamp (see below). */
  line-height: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* Always reserve two lines so the info block starts at the same height on
     every card, whether the name wraps or not. This must equal exactly two line
     boxes: `line-clamp` does not remove the later lines, it only draws the
     ellipsis and lets `overflow: hidden` clip them, so any extra height here
     bleeds a sliver of line 3 into view. */
  min-height: 30px;
}

/* English course names run far longer than the Chinese ones these cards were
   sized for. Step the size down rather than truncate inside the two lines. */
.course-title.is-long {
  font-size: 11px;
}

.course-title.is-longer {
  font-size: 10px;
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
  flex-shrink: 0;
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
