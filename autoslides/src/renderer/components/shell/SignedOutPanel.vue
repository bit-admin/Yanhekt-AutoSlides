<template>
  <div class="signed-out-panel">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.3"
      />
    </svg>
    <span class="signed-out-title">{{ title }}</span>
    <p v-if="hint" class="signed-out-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  hint?: string
}>()
</script>

<style scoped>
.signed-out-panel {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
}

.signed-out-title {
  font-size: 14px;
}

.signed-out-hint {
  margin: 0;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
}
</style>
