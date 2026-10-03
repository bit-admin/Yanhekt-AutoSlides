<template>
  <div ref="rootRef" class="date-picker">
    <button
      type="button"
      class="date-trigger"
      :class="{ open: isOpen }"
      :aria-label="$t('yanhe2Calendar.pickDate')"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="date-trigger-label">{{ label }}</span>
      <svg class="date-chevron" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6,9 12,15 18,9"/>
      </svg>
    </button>

    <div v-if="isOpen" class="date-menu">
      <div class="month-head">
        <button type="button" class="btn btn--icon" :title="$t('yanhe2Calendar.previousMonth')" :aria-label="$t('yanhe2Calendar.previousMonth')" @click="stepMonth(-1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <span class="month-title">{{ monthTitle }}</span>
        <button type="button" class="btn btn--icon" :title="$t('yanhe2Calendar.nextMonth')" :aria-label="$t('yanhe2Calendar.nextMonth')" @click="stepMonth(1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>
      <div class="month-grid">
        <span v-for="name in weekdayNames" :key="name" class="weekday">{{ name }}</span>
        <button
          v-for="cell in cells"
          :key="cell.date"
          type="button"
          :class="['day', {
            outside: !cell.inMonth,
            today: cell.date === today,
            selected: !week && cell.date === modelValue,
            'in-week': week && cell.inWeek,
          }]"
          :aria-pressed="week ? cell.inWeek : cell.date === modelValue"
          @click="choose(cell.date)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Month-grid date picker for the Yanhe 2.0 Calendar, in the same shape as the
// Search page's semester dropdown (the native date input brings Chromium's own
// popup, which follows none of our tokens). Picking a day, the grid's rows start on
// Sunday. With `week`, the model is the Monday that starts the school week, so
// the rows start on Monday too and the chosen week is one whole row.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { shiftDate, weekStartOf } from '@common/yanhe2Calendar'

const props = defineProps<{
  /** `YYYY-MM-DD`. */
  modelValue: string
  /** `YYYY-MM-DD`, ringed in the grid. */
  today: string
  /** Text on the trigger. */
  label: string
  week?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', date: string): void
}>()

const { locale } = useI18n()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
/** First day of the month on show, `YYYY-MM-01`. */
const month = ref(`${props.modelValue.slice(0, 7)}-01`)

const utc = (date: string) => new Date(`${date}T00:00:00Z`)

function toggle(): void {
  if (!isOpen.value) month.value = `${props.modelValue.slice(0, 7)}-01`
  isOpen.value = !isOpen.value
}

function stepMonth(delta: number): void {
  const d = utc(month.value)
  d.setUTCMonth(d.getUTCMonth() + delta)
  month.value = d.toISOString().slice(0, 10)
}

function choose(date: string): void {
  emit('update:modelValue', props.week ? weekStartOf(date) : date)
  isOpen.value = false
}

const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(month.value)),
)

// 2023-12-31 was a Sunday.
const firstWeekday = computed(() => (props.week ? 1 : 0))

const weekdayNames = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => format.format(utc(shiftDate('2023-12-31', i + firstWeekday.value))))
})

// Always six rows, so the popup does not change height from month to month.
const cells = computed(() => {
  const first = shiftDate(month.value, -((utc(month.value).getUTCDay() - firstWeekday.value + 7) % 7))
  const weekEnd = shiftDate(props.modelValue, 6)
  return Array.from({ length: 42 }, (_, i) => {
    const date = shiftDate(first, i)
    return {
      date,
      day: Number(date.slice(8)),
      inMonth: date.slice(0, 7) === month.value.slice(0, 7),
      inWeek: date >= props.modelValue && date <= weekEnd,
    }
  })
})

const onDocumentMouseDown = (event: MouseEvent) => {
  if (isOpen.value && rootRef.value && !rootRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))
</script>

<style scoped>
.date-picker {
  position: relative;
}

.date-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: var(--control-height);
  padding: 0 12px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.date-trigger:hover,
.date-trigger.open {
  border-color: var(--accent);
}

.date-trigger-label {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.date-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s;
}

.date-chevron.open {
  transform: rotate(180deg);
}

.date-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  padding: 10px;
  background: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px var(--shadow-lg);
  z-index: var(--z-dropdown);
}

.month-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.month-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 30px);
  gap: 2px;
}

.weekday {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.day {
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.15s;
}

.day:hover {
  background: var(--bg-hover);
}

.day.outside {
  color: var(--text-muted);
}

.day.today {
  border-color: var(--border-strong);
  font-weight: 600;
}

.day.in-week {
  background: var(--bg-selected);
}

.day.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
}
</style>
