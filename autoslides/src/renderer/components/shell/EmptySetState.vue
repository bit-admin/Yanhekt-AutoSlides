<template>
  <div class="empty-set-state">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <circle cx="12" cy="12" r="7" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </g>
    </svg>
    <div class="empty-set-copy">
      <span class="empty-set-title">{{ title }}</span>
      <p v-if="hint" class="empty-set-hint">{{ hint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  hint?: string
}>()
</script>

<style scoped>
.empty-set-state {
  flex: 1;
  align-self: stretch;
  width: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}

.empty-set-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-set-title {
  font-size: 14px;
}

.empty-set-hint {
  margin: 0;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.45;
}
</style>
