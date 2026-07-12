<template>
  <div class="folder-grid">
    <div
      v-for="folder in folders"
      :key="folder.name"
      class="folder-card"
      @click="$emit('open', folder)"
    >
      <!-- Thumbnail Cover Image Container (16:9 Aspect Ratio) -->
      <div class="folder-cover-container">
        <img
          v-if="folderCovers[folder.name]"
          :src="folderCovers[folder.name]"
          class="folder-cover-img"
          alt="Folder cover"
          loading="lazy"
        />
        <div v-else class="folder-cover-fallback">
          <svg class="folder-fallback-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="15" y2="9"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
        </div>

        <!-- Extracted Slide Count badge overlay -->
        <span class="folder-count-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="15" y2="9"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
          </svg>
          <span>{{ folder.activeCount }} {{ $t('navigation.slidesReview') }}</span>
        </span>

        <!-- Hover open overlay -->
        <div class="folder-hover-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>{{ $t('trash.preview') }}</span>
        </div>
      </div>

      <!-- Card text info body -->
      <div class="folder-body">
        <h3 class="folder-title-name" :title="getFolderDisplayName(folder.name).course">
          {{ getFolderDisplayName(folder.name).course }}
        </h3>
        
        <div class="folder-subtitle-details" v-if="getFolderDisplayName(folder.name).details">
          {{ getFolderDisplayName(folder.name).details }}
        </div>

        <!-- Footer / badges & removed count (omitted when empty so the card
             stays compact) -->
        <div
          v-if="isWatchExtraction(folder.metadata) || folder.metadata?.review?.edited || folder.removedCount > 0"
          class="folder-footer-meta"
        >
          <div class="folder-badges">
            <span v-if="isWatchExtraction(folder.metadata)" class="badge badge--watch">
              {{ $t('trash.watchMode') }}
            </span>
            <span v-if="folder.metadata?.review?.edited" class="badge badge--edited">
              {{ $t('trash.edited') }}
            </span>
          </div>
          <span v-if="folder.removedCount > 0" class="folder-removed-count">
            {{ folder.removedCount }} {{ $t('trash.removed') }}
          </span>
        </div>

        <!-- Hover delete-folder button; absolutely anchored so it never
             stretches the card -->
        <button
          class="folder-remove-btn"
          :title="$t('trash.deleteFolder')"
          :aria-label="$t('trash.deleteFolder')"
          @click.stop="$emit('remove', folder)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Folder grid for the Slides page: YouTube-style cards with 16:9 cover
// thumbnails, parsed title/session subtitle, badges, and a hover
// delete-folder button. Clicking a card opens the folder's review view.
import { isWatchExtraction } from '../../lib/slideMetadataTypes'
import { parseFolderDisplayName } from '../../lib/toolFolders'
import type { ResultsFolder } from '../../composables/resultsTypes'

defineProps<{
  folders: ResultsFolder[]
  folderCovers: Record<string, string>
}>()

defineEmits<{
  open: [folder: ResultsFolder]
  remove: [folder: ResultsFolder]
}>()

const getFolderDisplayName = parseFolderDisplayName
</script>

<style scoped>
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0.5rem 0 2rem;
}

.folder-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  overflow: hidden;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  cursor: pointer;
  box-shadow: 0 1px 3px var(--shadow-sm);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}

.folder-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px var(--shadow-md);
  border-color: var(--border-strong);
}

/* 16:9 Thumbnail Cover */
.folder-cover-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #1a1a1a;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
}

.folder-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.folder-card:hover .folder-cover-img {
  transform: scale(1.04);
}

.folder-cover-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--bg-hover) 0%, var(--border-color) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.folder-fallback-icon {
  opacity: 0.6;
  color: var(--accent-deep);
}

/* Slides count badge */
.folder-count-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background-color: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Hover overlay indicator */
.folder-hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  transition: opacity 0.25s ease;
  z-index: 3;
}

.folder-card:hover .folder-hover-overlay {
  opacity: 1;
}

/* Card Body text info */
.folder-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  flex-grow: 1;
}

.folder-title-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-subtitle-details {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-footer-meta {
  margin-top: auto;
  padding-top: 0.625rem;
  padding-right: 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folder-badges {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.badge--watch {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-deep);
  border: 1px solid color-mix(in srgb, var(--accent) 15%, transparent);
}

.badge--edited {
  background-color: color-mix(in srgb, var(--warning) 8%, transparent);
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 20%, transparent);
}

.folder-removed-count {
  font-size: 0.75rem;
  color: var(--danger);
  font-weight: 600;
}

/* Hover delete-folder button (bottom-right of the card body) */
.folder-remove-btn {
  position: absolute;
  right: 0.625rem;
  bottom: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.15s ease, color 0.15s ease;
}

.folder-card:hover .folder-remove-btn {
  opacity: 1;
}

.folder-remove-btn:hover {
  background-color: var(--danger-bg, var(--bg-hover));
  color: var(--danger);
}
</style>
