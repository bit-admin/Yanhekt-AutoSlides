<template>
  <!-- macOS-style password menu: a key heading and one row per remembered
       account. Rows pick on mousedown and the panel prevents it, so focus stays
       in the field (or the <webview>) that opened the menu. Hosts position the
       root through their own class. -->
  <div
    class="saved-login-menu"
    role="listbox"
    :aria-label="$t('auth.passwords')"
    @mousedown.prevent
  >
    <div class="saved-login-heading">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="8" cy="15" r="4"/>
        <path d="M11.5 12.5 20 4"/>
        <path d="M17 4l3 3"/>
        <path d="M15 8l2 2"/>
      </svg>
      <span>{{ $t('auth.passwords') }}</span>
    </div>
    <button
      v-for="(row, index) in rows"
      :key="row.badge"
      type="button"
      role="option"
      tabindex="-1"
      :aria-selected="index === highlight"
      :class="['saved-login-row', { active: index === highlight }]"
      @mouseenter="emit('hover', index)"
      @mousedown.left.prevent="emit('pick', row)"
    >
      <span class="saved-login-user">{{ row.username }}</span>
      <span v-if="row.badge !== row.username" class="saved-login-badge">{{ row.badge }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SavedLoginRow } from '@features/platform/useSavedLoginMenu'

defineProps<{
  rows: SavedLoginRow[]
  highlight: number
}>()

const emit = defineEmits<{
  (e: 'pick', row: SavedLoginRow): void
  (e: 'hover', index: number): void
}>()
</script>

<style scoped>
.saved-login-menu {
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background-color: var(--bg-modal);
  box-shadow: 0 8px 24px var(--shadow-lg);
}

.saved-login-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.saved-login-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.saved-login-row.active {
  background-color: var(--bg-selected);
}

.saved-login-user,
.saved-login-badge {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-login-badge {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
