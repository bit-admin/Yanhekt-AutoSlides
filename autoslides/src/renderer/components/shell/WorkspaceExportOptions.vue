<template>
  <div ref="root" class="export-menu" @keydown.esc="onEscape" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="export-menu-toggle"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      @click="open = !open"
    >
      <slot name="icon" />
      <span>{{ label }}</span>
      <svg class="export-menu-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </button>

    <div v-if="open" :id="panelId" class="export-menu-panel">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'

const props = defineProps<{
  label: string
  disabled: boolean
}>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panelId = useId()
const open = ref(false)

watch(() => props.disabled, disabled => {
  if (disabled) open.value = false
})

watch(open, (opened, _previous, onCleanup) => {
  if (!opened) return
  const onClick = (event: MouseEvent) => {
    const menu = root.value
    if (menu && !event.composedPath().includes(menu)) open.value = false
  }
  document.addEventListener('click', onClick, true)
  onCleanup(() => document.removeEventListener('click', onClick, true))
})

function onEscape(event: KeyboardEvent): void {
  if (!open.value) return
  event.stopPropagation()
  event.preventDefault()
  open.value = false
  trigger.value?.focus()
}

function onFocusOut(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) {
    open.value = false
  }
}
</script>

<style scoped>
.export-menu {
  position: relative;
  flex-shrink: 0;
}

.export-menu-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: var(--control-height);
  padding: 6px 10px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.export-menu-toggle:hover:not(:disabled) {
  background-color: var(--bg-hover);
}

.export-menu-toggle:disabled {
  cursor: not-allowed;
}

.export-menu-chevron {
  transition: transform 0.2s;
}

.export-menu-toggle[aria-expanded="true"] .export-menu-chevron {
  transform: rotate(180deg);
}

.export-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  inset-inline-end: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 260px;
  /* Scrolls rather than clips when little of the pane is left below it. */
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-card);
  box-shadow: 0 8px 24px var(--shadow-md);
}

@media (prefers-reduced-motion: reduce) {
  .export-menu-chevron {
    transition: none;
  }
}
</style>
