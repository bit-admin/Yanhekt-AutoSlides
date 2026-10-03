<template>
  <div class="timetable-scroll custom-scrollbar">
    <div
      class="timetable"
      role="table"
      :aria-label="$t('yanhe2Calendar.timetable')"
      :style="{ gridTemplateColumns: `32px repeat(${columns.length}, minmax(0, 1fr))` }"
    >
      <div class="corner"></div>
      <div v-for="column in columns" :key="column.key" class="period-head" role="columnheader">
        <span class="period-name">{{ column.label }}</span>
        <span v-if="column.begin" class="period-time">{{ column.begin }} – {{ column.end }}</span>
      </div>

      <template v-for="(day, index) in days" :key="day.day">
        <div :class="['day-head', { today: day.day === today }]" role="rowheader">
          <span class="day-name">{{ weekdayOf(day.day) }}</span>
          <span class="day-number">{{ Number(day.day.slice(8)) }}</span>
        </div>
        <div
          v-for="column in columns"
          :key="column.key"
          :class="['cell', { today: day.day === today }]"
          role="cell"
        >
          <Yanhe2SessionCard v-for="s in column.cells[index]" :key="s.subId" :session="s" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// My Courses as a week timetable: a row per day, a column per BIT period, and
// the same card as All Courses in each cell. The grid always fills the page;
// rows share the height and only grow past it when a day's cards need more.
// A session sits in the period it overlaps most; one that fits none (a lunch
// or late-evening slot) gets an extra Other Times column, shown only when needed.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  YANHE2_TIMETABLE,
  timetablePeriodOf,
  type Yanhe2CalendarSession,
  type Yanhe2ScheduleDay,
} from '@common/yanhe2Calendar'
import Yanhe2SessionCard from './Yanhe2SessionCard.vue'

const props = defineProps<{
  /** The week's days in order, free days included. */
  days: Yanhe2ScheduleDay[]
  /** `YYYY-MM-DD`; that row is marked. */
  today: string
}>()

const { t, locale } = useI18n()

interface Column {
  key: string
  label: string
  begin: string
  end: string
  /** One list per day, in `days` order. */
  cells: Yanhe2CalendarSession[][]
}

const columns = computed<Column[]>(() => {
  const byPeriod = new Map<number | null, Yanhe2CalendarSession[][]>()
  const cellsOf = (period: number | null) => {
    let cells = byPeriod.get(period)
    if (!cells) {
      cells = props.days.map(() => [])
      byPeriod.set(period, cells)
    }
    return cells
  }
  props.days.forEach((day, index) => {
    for (const session of day.sessions) {
      cellsOf(timetablePeriodOf(session.startAt, session.endAt))[index].push(session)
    }
  })

  const out: Column[] = YANHE2_TIMETABLE.map((slot) => ({
    key: String(slot.period),
    label: t('yanhe2Calendar.period', { n: slot.period }),
    begin: slot.begin,
    end: slot.end,
    cells: cellsOf(slot.period),
  }))
  const other = byPeriod.get(null)
  if (other) out.push({ key: 'other', label: t('yanhe2Calendar.otherPeriod'), begin: '', end: '', cells: other })
  return out
})

// Dates are plain `YYYY-MM-DD`; format them as UTC so the viewer's zone cannot shift the day.
const weekdayOf = (day: string) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
</script>

<style scoped>
/* Same gutter as the course grids: the scrollbar sits beside the table, not on its edge. */
.timetable-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 8px;
}

/* Hairlines come from the 1px gaps showing the grid's own background. Seven
   day rows share whatever height is left under the period header. */
.timetable {
  display: grid;
  grid-template-rows: auto repeat(7, minmax(min-content, 1fr));
  gap: 1px;
  box-sizing: border-box;
  min-width: 560px;
  min-height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--border-color);
  overflow: hidden;
}

.corner,
.period-head,
.day-head {
  background-color: var(--bg-elevated);
}

.period-head {
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px 8px;
  padding: 7px 6px;
}

.period-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.period-time {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 0;
  font-size: 10px;
  color: var(--text-secondary);
}

.day-number {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.day-head.today {
  background-color: var(--bg-selected);
  color: var(--text-primary);
  font-weight: 600;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 4px;
  background-color: var(--bg-surface);
}

.cell.today {
  background-color: var(--bg-page);
}

/* A card fills its slot; two classes in one slot split it. */
.cell :deep(.course-card) {
  flex: 1;
}
</style>
