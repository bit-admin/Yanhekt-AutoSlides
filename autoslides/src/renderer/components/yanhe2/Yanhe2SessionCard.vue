<template>
  <div class="course-card">
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
  </div>
</template>

<script setup lang="ts">
// One session on the Yanhe 2.0 Calendar, drawn like a Live / Recorded course
// card. Not clickable yet: the row keeps `courseId` / `subId` / `courseCode`
// for when a session can be opened.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, lessonRange, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'

const props = defineProps<{ session: Yanhe2CalendarSession }>()

const { t } = useI18n()

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
/* Same card as CoursePage / SearchPage, minus the pointer and hover: nothing opens yet. */
.course-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  overflow: hidden;
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
