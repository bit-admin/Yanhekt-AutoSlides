<template>
  <div class="watch-notes-panel">
    <ExternalNotePanel v-if="activeEntry" :entry="activeEntry" />
    <div v-else class="wn-empty">{{ $t('cloudNotes.watchNotes.hint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { activeEntry } from '@features/cloudNotes/watchNotesStore'
import ExternalNotePanel from './ExternalNotePanel.vue'
</script>

<style scoped>
.watch-notes-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
}

.wn-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
