<template>
  <div class="folder-grid">
    <div
      v-for="folder in folders"
      :key="folder.name"
      class="folder-card"
      :class="{ selected: selectMode && selectedNames.includes(folder.name) }"
      @click="onCardClick(folder)"
    >
      <div v-if="selectMode" class="folder-checkbox">
        <input type="checkbox" :checked="selectedNames.includes(folder.name)" tabindex="-1" />
      </div>
      <div class="folder-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="folder-body">
        <span class="folder-name" :title="folder.name">{{ formatToolFolderName(folder.name) }}</span>
        <div class="folder-meta">
          <span class="folder-count">{{ folder.activeCount }} {{ $t('trash.active') }}</span>
          <span v-if="folder.removedCount > 0" class="folder-count removed">{{ folder.removedCount }} {{ $t('trash.removed') }}</span>
        </div>
        <div class="folder-badges">
          <span v-if="isWatchExtraction(folder.metadata)" class="badge badge--watch">{{ $t('trash.watchMode') }}</span>
          <span v-if="folder.metadata?.review?.edited" class="badge badge--edited">{{ $t('trash.edited') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Folder grid for the Slides page (web analogue of the desktop
// FolderListView): plain click opens a folder; in select mode clicks toggle
// selection for export / clear-folder actions.
import { formatToolFolderName } from '../../lib/toolFolders'
import { isWatchExtraction } from '../../lib/slideMetadataTypes'
import type { ResultsFolder } from '../../composables/resultsTypes'

const props = defineProps<{
  folders: ResultsFolder[]
  selectMode: boolean
  selectedNames: string[]
}>()

const emit = defineEmits<{
  open: [folder: ResultsFolder]
  'update:selectedNames': [names: string[]]
}>()

const onCardClick = (folder: ResultsFolder) => {
  if (!props.selectMode) {
    emit('open', folder)
    return
  }
  const names = props.selectedNames.includes(folder.name)
    ? props.selectedNames.filter((name) => name !== folder.name)
    : [...props.selectedNames, folder.name]
  emit('update:selectedNames', names)
}
</script>

<style scoped>
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.875rem;
}

.folder-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.folder-card:hover {
  background-color: var(--bg-hover);
}

.folder-card.selected {
  border-color: var(--accent);
}

.folder-checkbox {
  position: absolute;
  top: 0.5rem;
  right: 0.625rem;
}

.folder-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.folder-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.folder-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-meta {
  display: flex;
  gap: 0.625rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.folder-count.removed {
  color: var(--danger);
}

.folder-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.folder-badges:empty {
  display: none;
}

.badge {
  padding: 0.0625rem 0.4375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  line-height: 1.5;
}

.badge--watch {
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.badge--edited {
  background-color: var(--accent);
  color: #ffffff;
}
</style>
