<template>
  <div class="yanhe2-calendar">
    <PageBanner
      v-if="yanhe2SignedIn && problem"
      tone="danger"
      :recheck-label="$t('yanhe2Calendar.retry')"
      :busy="loading"
      @recheck="refresh"
    >
      {{ problem === 'network' ? $t('yanhe2Calendar.errorNetwork') : $t('yanhe2Calendar.errorFailed') }}
    </PageBanner>
    <!-- Same tinted band as the Search page: date on the left, filter and view switch on the right. -->
    <div class="calendar-header">
      <template v-if="yanhe2SignedIn">
        <div class="date-nav">
          <button type="button" class="btn nav-btn" :title="$t(previousLabel)" :aria-label="$t(previousLabel)" @click="step(-1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
          <Yanhe2DatePicker
            v-if="view === 'all'"
            :model-value="date"
            :today="today"
            :label="dayLabel(date)"
            @update:model-value="setDate"
          />
          <Yanhe2DatePicker
            v-else
            week
            :model-value="weekStart"
            :today="today"
            :label="`${shortDate(weekStart)} – ${shortDate(weekEnd)}`"
            @update:model-value="setWeek"
          />
          <button type="button" class="btn nav-btn" :title="$t(nextLabel)" :aria-label="$t(nextLabel)" @click="step(1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9,18 15,12 9,6"/></svg>
          </button>
          <button v-if="view === 'all'" type="button" class="btn today-btn" :disabled="isToday" @click="goToday">{{ $t('yanhe2Calendar.today') }}</button>
          <button v-else type="button" class="btn today-btn" :disabled="isThisWeek" @click="goThisWeek">{{ $t('yanhe2Calendar.thisWeek') }}</button>
        </div>
        <input
          v-if="view === 'all'"
          v-model="keyword"
          type="search"
          class="filter-input"
          :placeholder="$t('yanhe2Calendar.filterPlaceholder')"
          @keyup.enter="submitKeyword"
        />
      </template>
      <div class="mode-switch">
        <button
          v-for="option in VIEWS"
          :key="option"
          type="button"
          :class="['mode-pill', { active: view === option }]"
          @click="view = option"
        >
          {{ $t(option === 'all' ? 'yanhe2Calendar.allCourses' : 'yanhe2Calendar.myCourses') }}
        </button>
      </div>
    </div>

    <div class="content">
      <SignedOutPanel v-if="!yanhe2ActiveBadge" :title="$t('yanhe2Calendar.signInMain')" />

      <!-- Signed in to AutoSlides, but no live Yanhe 2.0 session for this account. -->
      <div v-else-if="!yanhe2SignedIn" class="connect">
        <template v-if="yanhe2MenuPhase !== 'idle'">
          <div class="spinner"></div>
          <p class="connect-hint">{{ $t('yanhe2Calendar.connecting') }}</p>
        </template>
        <template v-else>
          <span class="connect-title">{{ $t('yanhe2Calendar.connectTitle') }}</span>
          <p class="connect-hint">{{ $t('yanhe2Calendar.connectHint') }}</p>
          <button type="button" class="btn btn--primary" @click="requestYanhe2SsoSignIn">
            {{ $t('yanhe2Calendar.connectButton') }}
          </button>
        </template>
      </div>

      <template v-else>
        <!-- All Courses: the school day, grouped by period -->
        <template v-if="view === 'all'">
          <div v-if="dayLoading && periods.length === 0" class="loading-state">
            <div class="spinner"></div>
            <p>{{ $t('yanhe2Calendar.loading') }}</p>
          </div>
          <EmptySetState
            v-else-if="!dayProblem && dayIsEmpty"
            :title="$t('yanhe2Calendar.noClasses')"
            :hint="appliedKeyword
              ? $t('yanhe2Calendar.noMatchesHint', { keyword: appliedKeyword })
              : $t('yanhe2Calendar.noClassesHint')"
          />
          <div v-else class="sections custom-scrollbar">
            <section v-for="period in periods" :key="period.id" class="section">
              <button
                type="button"
                class="section-head section-head--toggle"
                :aria-expanded="expanded.has(period.id)"
                @click="togglePeriod(period)"
              >
                <svg :class="['chevron', { open: expanded.has(period.id) }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9,18 15,12 9,6"/></svg>
                <span class="section-name">{{ periodLabel(period.name) }}</span>
                <span v-if="period.beginTime && period.endTime" class="section-time">{{ period.beginTime }} – {{ period.endTime }}</span>
                <span v-if="period.loaded" class="section-count">{{ $t('yanhe2Calendar.sessionCount', { n: period.sessions.length }) }}</span>
              </button>
              <template v-if="expanded.has(period.id)">
                <div v-if="loadingPeriods.has(period.id) && period.sessions.length === 0" class="section-note">
                  <div class="spinner spinner--sm"></div>
                </div>
                <p v-else-if="period.sessions.length === 0" class="section-note">{{ $t('yanhe2Calendar.periodEmpty') }}</p>
                <div v-else class="session-grid">
                  <Yanhe2SessionCard v-for="s in period.sessions" :key="s.subId" :session="s" />
                </div>
              </template>
            </section>
          </div>
        </template>

        <!-- My Courses: this account's own week, Monday to Sunday -->
        <template v-else>
          <div v-if="weekLoading && days.length === 0" class="loading-state">
            <div class="spinner"></div>
            <p>{{ $t('yanhe2Calendar.loading') }}</p>
          </div>
          <Yanhe2WeekTimetable v-else :days="days" :today="today" />
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Yanhe 2.0 → Calendar. A browsing page like Live / Recorded: it lists what is
// on, and a row opens nothing yet. All Courses is the whole school's day (aita's
// /course page); My Courses is the signed-in account's own week as a timetable.
import { computed } from 'vue'
import { periodNumber } from '@common/yanhe2Calendar'
import { useI18n } from 'vue-i18n'
import { navigationStore } from '@features/course/navigationStore'
import {
  requestYanhe2SsoSignIn,
  yanhe2ActiveBadge,
  yanhe2MenuPhase,
  yanhe2SignedIn,
} from '@features/platform/yanhe2AccountUi'
import { useYanhe2Calendar, type Yanhe2CalendarView } from '@features/yanhe2/useYanhe2Calendar'
import EmptySetState from '../shell/EmptySetState.vue'
import PageBanner from '../shell/PageBanner.vue'
import SignedOutPanel from '../shell/SignedOutPanel.vue'
import Yanhe2DatePicker from './Yanhe2DatePicker.vue'
import Yanhe2SessionCard from './Yanhe2SessionCard.vue'
import Yanhe2WeekTimetable from './Yanhe2WeekTimetable.vue'

const VIEWS: Yanhe2CalendarView[] = ['all', 'mine']

const { t, locale } = useI18n()

const {
  view,
  today,
  date,
  keyword,
  appliedKeyword,
  periods,
  expanded,
  loadingPeriods,
  dayLoading,
  dayProblem,
  sessionCount,
  isToday,
  weekStart,
  weekEnd,
  days,
  weekLoading,
  weekProblem,
  isThisWeek,
  refresh,
  setDate,
  stepDay,
  goToday,
  stepWeek,
  setWeek,
  goThisWeek,
  togglePeriod,
  submitKeyword,
} = useYanhe2Calendar({
  badge: yanhe2ActiveBadge,
  signedIn: yanhe2SignedIn,
  active: computed(() => navigationStore.activeNav.value === 'yanhe2-calendar'),
})

const problem = computed(() => (view.value === 'all' ? dayProblem.value : weekProblem.value))
const loading = computed(() => (view.value === 'all' ? dayLoading.value : weekLoading.value))

// "Nothing on this day" only once every period has answered.
const dayIsEmpty = computed(
  () => !dayLoading.value && sessionCount.value === 0 && periods.value.every((p) => p.loaded),
)

const step = (delta: number) => (view.value === 'all' ? stepDay(delta) : stepWeek(delta))
const previousLabel = computed(() => (view.value === 'all' ? 'yanhe2Calendar.previousDay' : 'yanhe2Calendar.previousWeek'))
const nextLabel = computed(() => (view.value === 'all' ? 'yanhe2Calendar.nextDay' : 'yanhe2Calendar.nextWeek'))

// `第一节` is the server's own name for a period. Word it per locale when it is
// that shape, and show it as sent when it is anything else. `其它时段` is the
// catch-all for sessions outside the timetable; it has no times of its own.
const periodLabel = (name: string) => {
  if (/^其[它他]时段$/.test(name.trim())) return t('yanhe2Calendar.otherPeriod')
  const n = periodNumber(name)
  return n === null ? name : t('yanhe2Calendar.period', { n })
}

// Dates are plain `YYYY-MM-DD`; format them as UTC so the viewer's zone cannot shift the day.
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`))
const shortDate = (day: string) =>
  new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`))
</script>

<style scoped>
.yanhe2-calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.calendar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Square chevron buttons at control height; padding:0 so .btn's own padding does not crush the icon. */
.nav-btn {
  width: var(--control-height);
  height: var(--control-height);
  min-height: 0;
  padding: 0;
  border-radius: 8px;
}

.today-btn {
  height: var(--control-height);
  min-height: 0;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
}

.filter-input {
  box-sizing: border-box;
  flex: 1;
  min-width: 120px;
  max-width: 240px;
  height: var(--control-height);
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.filter-input:hover,
.filter-input:focus {
  border-color: var(--accent);
}

.filter-input::placeholder {
  color: var(--text-muted);
}

/* Same segmented control as the Search page's Live | Recorded switch. */
.mode-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
  height: var(--control-height);
  margin-left: auto;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.filter-input + .mode-switch {
  margin-left: 0;
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
  white-space: nowrap;
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
  animation: yanhe2-calendar-spin 0.8s linear infinite;
}

.spinner--sm {
  width: 16px;
  height: 16px;
}

@keyframes yanhe2-calendar-spin {
  to { transform: rotate(360deg); }
}

.sections {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
}

.section + .section {
  margin-top: 4px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  text-align: left;
}

.section-head--toggle {
  cursor: pointer;
  transition: background 0.15s;
}

.section-head--toggle:hover {
  background-color: var(--bg-hover);
}

.chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s;
}

.chevron.open {
  transform: rotate(90deg);
}

.section-name {
  font-size: 13px;
  font-weight: 600;
}

.section-time {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.section-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.section-note {
  display: flex;
  margin: 0;
  padding: 4px 8px 12px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Four cards a row, stepping down with the window, like the Live / Recorded grids. */
.session-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 4px 0 16px;
}

@media (max-width: 1200px) {
  .session-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .session-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .session-grid {
    grid-template-columns: 1fr;
  }
}
</style>
