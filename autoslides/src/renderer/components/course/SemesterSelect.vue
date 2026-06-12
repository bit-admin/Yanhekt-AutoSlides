<template>
  <div class="semester-select" ref="rootRef">
    <button class="semester-trigger" :class="{ open: isOpen }" @click="isOpen = !isOpen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          :key="option.id"
          class="semester-option"
          :class="{ active: option.id === modelValue }"
          @click="choose(option.id)"
        >
          <span class="semester-option-label">{{ option.label }}</span>
          <svg v-if="option.id === modelValue" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
import type { SemesterOption } from '@shared/services/apiClient'

const props = defineProps<{
  semesters: SemesterOption[]
  modelValue: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: number): void
}>()

const { t, locale } = useI18n()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

// Fall of school year N is "{N} Fall"; spring of the same school year falls
// in calendar year N+1. Unparseable semesters (schoolYear 0) fall back to the
// raw API label (Chinese original for zh, English transliteration otherwise).
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
  options: { id: number; label: string }[]
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
        .map(o => ({ id: o.id, label: semesterLabel(o) }))
    }))
})

const selectedLabel = computed(() => {
  const selected = props.semesters.find(s => s.id === props.modelValue)
  return selected ? semesterLabel(selected) : t('searchPage.semesterPlaceholder')
})

const choose = (id: number) => {
  isOpen.value = false
  if (id !== props.modelValue) {
    emit('update:modelValue', id)
  }
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
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
  max-width: 220px;
}

.semester-trigger:hover,
.semester-trigger.open {
  border-color: var(--accent);
}

.semester-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.semester-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s;
}

.semester-chevron.open {
  transform: rotate(180deg);
}

.semester-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 230px;
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px var(--shadow-lg);
  z-index: var(--z-dropdown);
}

.semester-group + .semester-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.semester-group-label {
  padding: 8px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.semester-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.semester-option:hover {
  background: var(--bg-hover);
}

.semester-option.active {
  color: var(--accent);
  font-weight: 600;
}

.semester-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
