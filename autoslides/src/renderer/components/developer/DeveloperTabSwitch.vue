<template>
  <div class="mode-switch" role="tablist" :aria-label="$t('navigation.developer')">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="mode-pill"
      :class="{ active: modelValue === tab.id }"
      :aria-selected="modelValue === tab.id"
      :tabindex="modelValue === tab.id ? 0 : -1"
      @click="emit('update:modelValue', tab.id)"
      @keydown="onKeydown($event, tab.id)"
    >
      {{ $t(tab.label) }}
    </button>
  </div>
</template>

<script lang="ts">
export type DevTab = 'image' | 'api' | 'sso'
</script>

<script setup lang="ts">
defineProps<{ modelValue: DevTab }>()
const emit = defineEmits<{ 'update:modelValue': [tab: DevTab] }>()

const tabs: Array<{ id: DevTab; label: string }> = [
  { id: 'image', label: 'developer.tabs.imageLab' },
  { id: 'api', label: 'developer.tabs.api' },
  { id: 'sso', label: 'developer.tabs.sso' },
]

const onKeydown = (event: KeyboardEvent, id: DevTab) => {
  const at = tabs.findIndex((tab) => tab.id === id)
  const next = event.key === 'ArrowRight' ? (at + 1) % tabs.length
    : event.key === 'ArrowLeft' ? (at + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : -1
  if (next < 0) return
  event.preventDefault()
  emit('update:modelValue', tabs[next].id)
}
</script>

<style scoped>
/* Same macOS segmented control as Search Live|Recorded. */
.mode-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
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
</style>
