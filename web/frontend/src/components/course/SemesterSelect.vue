<template>
  <div class="semester-select" ref="rootRef">
    <button class="semester-trigger" :class="{ open: isOpen }" @click="isOpen = !isOpen">
      <svg class="semester-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="semester-trigger-label">{{ selectedLabel }}</span>
      <svg class="semester-chevron" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6,9 12,15 18,9"/>
      </svg>
    </button>

    <div v-if="isOpen" class="semester-menu custom-scrollbar">
      <div v-for="group in groupedSemesters" :key="group.key" class="semester-group">
        <div v-if="group.label" class="semester-group-label">{{ group.label }}</div>
        <button
          v-for="option in group.options"
          :key="option.key"
          class="semester-option"
          :class="{ active: option.key === modelValue }"
          @click="choose(option.key)"
        >
          <span class="semester-option-label">{{ option.label }}</span>
          <svg v-if="option.key === modelValue" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SemesterOption } from '../../lib/api'

// One term at a time (the Index searches exactly one); no "all terms" choice.
const props = defineProps<{
  semesters: SemesterOption[]
  modelValue: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', key: string): void
}>()

const { t, locale } = useI18n()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const semesterLabel = (s: SemesterOption): string => {
  if (s.schoolYear === 0) {
    return locale.value.startsWith('zh') ? s.label : s.labelEn
  }
  return s.semester === 1
    ? t('searchPage.semesterFall', { year: s.schoolYear })
    : t('searchPage.semesterSpring', { year: s.schoolYear + 1 })
}

interface SemesterGroup {
  key: string
  label: string
  options: { key: string; label: string }[]
}

const groupedSemesters = computed<SemesterGroup[]>(() => {
  const byYear = new Map<number, SemesterOption[]>()
  for (const s of props.semesters) {
    const list = byYear.get(s.schoolYear)
    if (list) {
      list.push(s)
    } else {
      byYear.set(s.schoolYear, [s])
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, options]) => ({
      key: String(year),
      label: year === 0 ? '' : t('searchPage.academicYear', { start: year, end: year + 1 }),
      options: options
          .slice()
          .sort((a, b) => b.semester - a.semester)
          .map(o => ({ key: o.key, label: semesterLabel(o) }))
    }))
})

const selectedLabel = computed(() => {
  const selected = props.semesters.find(s => s.key === props.modelValue)
  return selected ? semesterLabel(selected) : t('searchPage.semesterPlaceholder')
})

const choose = (key: string) => {
  isOpen.value = false
  if (key !== props.modelValue) emit('update:modelValue', key)
}

const onDocumentMouseDown = (event: MouseEvent) => {
  if (isOpen.value && rootRef.value && !rootRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))
</script>

<style scoped>
.semester-select {
  position: relative;
}

.semester-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s, border-color 0.2s;
  max-width: 13.75rem;
}

.semester-trigger:hover,
.semester-trigger.open {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.semester-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.semester-chevron {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 0.15s;
}

.semester-chevron.open {
  transform: rotate(180deg);
}

.semester-menu {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  min-width: 14.375rem;
  max-height: 21.25rem;
  overflow-y: auto;
  padding: 0.375rem;
  background: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px var(--shadow-lg);
  z-index: var(--z-dropdown);
}

.semester-group + .semester-group {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-color);
}

.semester-group-label {
  padding: 0.5rem 0.625rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.semester-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  width: 100%;
  padding: 0.4375rem 0.625rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.semester-option:hover {
  background: var(--bg-hover);
}

.semester-option.active {
  color: var(--accent-deep);
  font-weight: 600;
}

.semester-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
