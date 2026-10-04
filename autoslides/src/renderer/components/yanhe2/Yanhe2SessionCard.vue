<template>
  <component
    :is="playable ? 'button' : 'div'"
    :type="playable ? 'button' : undefined"
    :class="['course-card', { playable }]"
    @click="open"
  >
    <div v-if="session.status !== 'unknown'" :class="['course-status', `status-${session.status}`]">
      {{ $t(`yanhe2Calendar.status.${session.status}`) }}
    </div>
    <div class="course-info">
      <h3 class="course-title" :title="session.title">{{ session.title }}</h3>
      <p class="course-instructor">{{ session.teacher }}</p>
      <p class="course-location">{{ session.room }}</p>
      <p class="course-time">{{ timeLine }}</p>
      <p v-if="session.college" class="course-section">{{ session.college }}</p>
    </div>
  </component>
</template>

<script setup lang="ts">
// One session on the Yanhe 2.0 Calendar, drawn like a Live / Recorded course
// card. A live or recorded session opens a playback tab; an upcoming,
// processing or ended one has nothing to play and stays a plain card.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, lessonRange, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import { isYanhe2Playable } from '@common/yanhe2Playback'
import { notifyManualTabLimit } from '@features/course/courseSelection'
import { openPlaybackTab, yanhe2TabKey } from '@features/course/tabStore'
import { yanhe2ActiveBadge } from '@features/platform/yanhe2AccountUi'

const props = defineProps<{ session: Yanhe2CalendarSession }>()

const { t } = useI18n()

const playable = computed(() => isYanhe2Playable(props.session.status))

const open = () => {
  const account = yanhe2ActiveBadge.value
  if (!playable.value || !account) return
  // A plain copy: the row is reactive, and the tab outlives the calendar's next refresh.
  const session: Yanhe2CalendarSession = { ...props.session }
  const key = yanhe2TabKey(session.subId)
  const result = openPlaybackTab({
    mode: session.status === 'live' ? 'live' : 'recorded',
    course: { id: key, title: session.title, instructor: session.teacher, time: '' },
    streamId: key,
    sessionId: key,
    title: session.title,
    origin: 'manual',
    yanhe2: { account, session },
  })
  if (!result.ok) notifyManualTabLimit()
}

// `2026-09-28第1-2节` → "Lessons 1–2": the page already says which day it is.
const lessons = computed(() => {
  const range = lessonRange(props.session.subTitle)
  if (!range) return ''
  return range.from === range.to
    ? t('yanhe2Calendar.lesson', { n: range.from })
    : t('yanhe2Calendar.lessons', { from: range.from, to: range.to })
})

const timeLine = computed(() => {
  const start = beijingClock(props.session.startAt)
  const end = beijingClock(props.session.endAt)
  const clock = start && end ? `${start} – ${end}` : start
  return [clock, lessons.value].filter(Boolean).join(' · ')
})
</script>

<style scoped>
/* Same card as CoursePage / SearchPage. Only a session with something to play gets the pointer and hover. */
.course-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  overflow: hidden;
  /* A playable card is a <button>: take the page's type and width, not the control's. */
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
}

.course-card.playable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.course-card.playable:hover {
  border-color: var(--border-strong);
  box-shadow: 0 1px 3px var(--shadow-sm);
}

.course-card.playable:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
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
.course-location,
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

.course-time {
  font-variant-numeric: tabular-nums;
}

.course-section {
  margin-bottom: 0;
  font-size: 9px;
}
</style>
