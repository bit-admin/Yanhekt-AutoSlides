<template>
  <!-- Import slides to notes modal — folder-select phase only. The progress
       phase renders through the shared ImportProgressModal in the parent
       (the parent owns showImportModal/importPhase, which gate both). -->
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="cn-import-box">
      <h3 class="cn-modal-title">{{ $t('cloudNotes.importTitle') }}</h3>

      <!-- Pick local slide folders -->
      <div class="cn-import-list custom-scrollbar">
        <div v-if="loadingFolders" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
        <div v-else-if="importFolders.length === 0 && watchFolders.length === 0" class="cn-empty">{{ $t('cloudNotes.importNoFolders') }}</div>
        <button
          v-for="f in importFolders"
          :key="f.name"
          class="cn-import-folder"
          :class="{ selected: importSelected.includes(f.name) }"
          @click="toggleImportFolder(f.name)"
        >
          <input type="checkbox" class="cn-import-check" :checked="importSelected.includes(f.name)" tabindex="-1" />
          <svg class="cn-import-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="cn-import-folder-name">{{ fmtFolder(f.name) }}</span>
          <span class="cn-import-folder-count">{{ $t('cloudNotes.importImagesCount', { n: f.imageCount }) }}</span>
        </button>

        <!-- Watch-mode folders: shown for context but not importable. -->
        <template v-if="watchFolders.length > 0">
          <div class="cn-import-section">{{ $t('cloudNotes.importWatchSectionTitle') }}</div>
          <p class="cn-import-section-hint">{{ $t('cloudNotes.importWatchHint') }}</p>
          <div
            v-for="f in watchFolders"
            :key="f.name"
            class="cn-import-folder cn-import-folder--disabled"
          >
            <svg class="cn-import-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="cn-import-folder-name">{{ fmtFolder(f.name) }}</span>
            <span class="cn-import-folder-count">{{ $t('cloudNotes.importImagesCount', { n: f.imageCount }) }}</span>
          </div>
        </template>
      </div>
      <div class="cn-modal-actions">
        <button class="btn cn-modal-btn" @click="emit('close')">{{ $t('cloudNotes.cancel') }}</button>
        <button class="btn btn--primary cn-modal-btn" :disabled="importSelected.length === 0" @click="onStartImport">
          {{ $t('cloudNotes.importStart', { n: importSelected.length }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { isWatchExtraction } from '@common/slideMetadataTypes'

interface ImportFolder { name: string; path: string; imageCount: number }

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start', names: string[]): void
}>()

// Importable folders (selectable) vs. watch-mode folders captured while watching
// playback — the latter can't be imported (completeness unverifiable) and render
// in a separate, non-selectable "can't import" section.
const importFolders = ref<ImportFolder[]>([])
const watchFolders = ref<ImportFolder[]>([])
const importSelected = ref<string[]>([])
const loadingFolders = ref(false)

const fmtFolder = formatToolFolderName

async function loadImportFolders(): Promise<void> {
  loadingFolders.value = true
  try {
    const all = (await window.electronAPI.pdfmaker.getFolders()) as ImportFolder[]
    const metas = await Promise.all(
      all.map((f) => window.electronAPI.slideMetadata.get(f.path).catch(() => null))
    )
    const importable: ImportFolder[] = []
    const watched: ImportFolder[] = []
    all.forEach((f, i) => (isWatchExtraction(metas[i]) ? watched : importable).push(f))
    importFolders.value = importable
    watchFolders.value = watched
    importSelected.value = []
  } finally {
    loadingFolders.value = false
  }
}

// The parent only sets `open` when the picker phase should show, so a rising
// edge is exactly the former openImportModal fresh-select path.
watch(() => props.open, (open) => {
  if (open) void loadImportFolders()
})

function toggleImportFolder(name: string): void {
  const i = importSelected.value.indexOf(name)
  if (i === -1) importSelected.value.push(name)
  else importSelected.value.splice(i, 1)
}

function onStartImport(): void {
  if (importSelected.value.length === 0) return
  emit('start', [...importSelected.value])
}
</script>

<style scoped>
/* This modal's copy of the shared modal classes (ImportProgressModal precedent). */
.cn-import-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cn-modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.cn-import-list {
  flex: 1 1 auto;
  min-height: 120px;
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 12px;
}

/* Folder picker rows */
.cn-import-folder {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
  transition: background-color 0.15s, border-color 0.15s;
}

.cn-import-folder:hover {
  background-color: var(--bg-hover);
}

.cn-import-folder.selected {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
}

.cn-import-folder--disabled {
  cursor: default;
  opacity: 0.6;
  background-color: var(--bg-subtle);
}

.cn-import-folder--disabled:hover {
  background-color: var(--bg-subtle);
}

/* "Can't import" section header + hint for watch-mode folders. */
.cn-import-section {
  margin-top: 12px;
  padding: 4px 2px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.cn-import-section-hint {
  margin: 0 2px 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}

.cn-import-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  pointer-events: none;
}

.cn-import-folder-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.cn-import-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cn-import-folder-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.cn-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.cn-modal-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}

/* "OR" divider between folder import and paste-a-link import.
   (Likely dead since paste-import was removed — kept verbatim per the
   share-link redesign note; do not delete in this refactor.) */
.cn-share-or {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -6px 0;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cn-share-or::before,
.cn-share-or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.cn-paste-row {
  display: flex;
  gap: 8px;
}
.cn-paste-input {
  flex: 1;
}
.cn-paste-btn {
  flex: 0 0 auto;
}
</style>
