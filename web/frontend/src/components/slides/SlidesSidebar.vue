<template>
  <aside class="ss-sidebar">
    <div class="ss-head">
      <span class="ss-section-label">{{ $t('slides.albums') }}</span>
      <span v-if="folders.length > 0" class="ss-count">{{ folders.length }}</span>
    </div>

    <div class="ss-scroll custom-scrollbar">
      <div v-if="folders.length === 0" class="ss-empty">
        {{ $t('slides.emptyLibrary') }}
      </div>

      <button
        v-for="folder in folders"
        :key="folder.name"
        type="button"
        class="ss-row"
        :class="{ active: folder.name === activeFolderName }"
        :title="rowTitle(folder)"
        @click="$emit('select', folder)"
      >
        <div class="ss-row-text">
          <span class="ss-row-primary">{{ displayName(folder.name).course || folder.name }}</span>
          <span v-if="displayName(folder.name).details" class="ss-row-secondary">
            {{ displayName(folder.name).details }}
          </span>
        </div>

        <div class="ss-row-meta">
          <span
            v-if="isWatchExtraction(folder.metadata)"
            class="ss-dot ss-dot--watch"
            :title="$t('trash.watchMode')"
          />
          <span
            v-if="folder.metadata?.review?.edited"
            class="ss-dot ss-dot--edited"
            :title="$t('trash.edited')"
          />
          <span class="ss-row-count">{{ folder.activeCount }}</span>
          <button
            type="button"
            class="ss-row-delete"
            :title="$t('trash.deleteFolder')"
            :aria-label="$t('trash.deleteFolder')"
            @click.stop="$emit('remove', folder)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </button>
    </div>

    <div v-if="trashCount > 0" class="ss-foot">
      <button type="button" class="ss-clear-trash" @click="$emit('clear-trash')">
        {{ $t('trash.clearTrash') }}
        <span class="ss-trash-n">{{ trashCount }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
// Name-first album list (iCloud Photos sidebar style) — no cover previews.
import { isWatchExtraction } from '../../lib/slideMetadataTypes'
import { parseFolderDisplayName } from '../../lib/toolFolders'
import type { ResultsFolder } from '../../composables/resultsTypes'

defineProps<{
  folders: ResultsFolder[]
  activeFolderName: string | null
  trashCount: number
}>()

defineEmits<{
  select: [folder: ResultsFolder]
  remove: [folder: ResultsFolder]
  'clear-trash': []
}>()

const displayName = parseFolderDisplayName

function rowTitle(folder: ResultsFolder): string {
  const d = displayName(folder.name)
  return d.details ? `${d.course} · ${d.details}` : d.course || folder.name
}
</script>

<style scoped>
.ss-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: var(--st-sidebar-width, 240px);
  background: var(--st-sidebar-bg, #f5f5f7);
  border-right: 1px solid var(--st-border, rgba(0, 0, 0, 0.08));
  color: var(--st-text, #1d1d1f);
}

.ss-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.9rem 1rem 0.55rem;
  flex-shrink: 0;
}

.ss-section-label {
  font-size: 0.6875rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--st-text-muted, #86868b);
}

.ss-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--st-text-muted, #86868b);
}

.ss-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.15rem 0.5rem 0.75rem;
}

.ss-empty {
  padding: 1rem 0.65rem;
  font-size: 0.8125rem;
  color: var(--st-text-secondary, #6e6e73);
  line-height: 1.4;
}

.ss-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.5rem 0.55rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: inherit;
  transition: background-color 0.12s ease;
}

.ss-row:hover {
  background: var(--st-hover, rgba(0, 0, 0, 0.04));
}

.ss-row.active {
  background: var(--st-sidebar-active, rgba(0, 0, 0, 0.06));
}

.ss-row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.ss-row-primary {
  font-size: 0.875rem;
  font-weight: 550;
  color: var(--st-text, #1d1d1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-row.active .ss-row-primary {
  font-weight: 650;
}

.ss-row-secondary {
  font-size: 0.75rem;
  color: var(--st-text-secondary, #6e6e73);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-row-meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.ss-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ss-dot--watch {
  background: var(--st-accent, #0071e3);
}

.ss-dot--edited {
  background: #ff9f0a;
}

.ss-row-count {
  font-size: 0.75rem;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
  color: var(--st-text-muted, #86868b);
  min-width: 1.1rem;
  text-align: right;
}

.ss-row-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--st-text-muted, #86868b);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.ss-row:hover .ss-row-delete,
.ss-row:focus-within .ss-row-delete {
  opacity: 1;
}

.ss-row-delete:hover {
  background: color-mix(in srgb, var(--st-danger, #ff3b30) 12%, transparent);
  color: var(--st-danger, #ff3b30);
}

@media (hover: none) {
  .ss-row-delete {
    opacity: 0.75;
  }
}

.ss-foot {
  flex-shrink: 0;
  padding: 0.5rem 0.65rem 0.75rem;
  border-top: 1px solid var(--st-border, rgba(0, 0, 0, 0.08));
}

.ss-clear-trash {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--st-danger, #ff3b30);
  font-size: 0.8125rem;
  font-weight: 550;
  padding: 0.45rem 0.55rem;
  border-radius: 0.45rem;
  cursor: pointer;
}

.ss-clear-trash:hover {
  background: color-mix(in srgb, var(--st-danger, #ff3b30) 10%, transparent);
}

.ss-trash-n {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
</style>
