<template>
  <!-- Export notes to slides modal: select managed notes, then per-row
       progress with conflict resolution. Fully self-contained — the parent's
       footer opens it via the exposed openFromFooter() and keeps reading the
       queue counters straight off `exp` (parent-constructed). -->
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="cn-import-box">
      <h3 class="cn-modal-title">{{ $t('cloudNotes.exportTitle') }}</h3>

      <!-- Phase: select notes -->
      <template v-if="exportPhase === 'select'">
        <div class="cn-import-list custom-scrollbar">
          <div v-if="cn.loading.value" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
          <div v-else-if="exportNotes.length === 0" class="cn-empty">{{ $t('cloudNotes.exportNoNotes') }}</div>
          <button
            v-for="n in exportNotes"
            :key="n.id"
            class="cn-import-folder"
            :class="{ selected: exportSelected.includes(n.id) }"
            @click="toggleExportNote(n.id)"
          >
            <input type="checkbox" class="cn-import-check" :checked="exportSelected.includes(n.id)" tabindex="-1" />
            <svg class="cn-import-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
            </svg>
            <span class="cn-import-folder-name">{{ n.displayName }}</span>
          </button>
        </div>
        <div class="cn-modal-actions">
          <button class="btn cn-modal-btn" @click="close">{{ $t('cloudNotes.cancel') }}</button>
          <button class="btn btn--primary cn-modal-btn" :disabled="exportSelected.length === 0" @click="onStartExport">
            {{ $t('cloudNotes.exportStart', { n: exportSelected.length }) }}
          </button>
        </div>
      </template>

      <!-- Phase: progress -->
      <template v-else>
        <div class="cn-import-overall">{{ $t('cloudNotes.exportOverall', { done: exp.overall.value.done, total: exp.overall.value.total }) }}</div>
        <div class="cn-import-list custom-scrollbar">
          <div v-for="item in exp.queue.value" :key="item.noteId" class="cn-imp-row">
            <div class="cn-imp-row-top">
              <span class="cn-imp-name" :title="item.displayName">{{ item.displayName }}</span>
              <span class="cn-imp-status" :class="`s-${item.status}`">{{ exportStatusText(item) }}</span>
            </div>
            <div class="cn-imp-bar">
              <div class="cn-imp-fill" :class="`s-${item.status}`" :style="{ width: exportBarWidth(item) + '%' }"></div>
            </div>
            <div v-if="item.status === 'conflict'" class="cn-imp-actions">
              <button class="btn btn--sm btn--ghost" :disabled="exp.exporting.value" @click="exp.openFolder(item)">{{ $t('cloudNotes.exportOpenFolder') }}</button>
              <button class="btn btn--sm" :disabled="exp.exporting.value" @click="exp.resolveConflict(item, 'create')">{{ $t('cloudNotes.exportCreateNew') }}</button>
              <button class="btn btn--sm cn-imp-replace" :disabled="exp.exporting.value" @click="exp.resolveConflict(item, 'replace')">{{ $t('cloudNotes.exportReplace') }}</button>
              <button class="btn btn--sm btn--ghost" :disabled="exp.exporting.value" @click="exp.skipConflict(item)">{{ $t('cloudNotes.exportSkip') }}</button>
            </div>
          </div>
        </div>
        <p v-if="exp.queue.value.some(i => i.status === 'conflict')" class="cn-import-hint">{{ $t('cloudNotes.exportConflictHint') }}</p>
        <div class="cn-modal-actions">
          <template v-if="exp.exporting.value">
            <button class="btn cn-modal-btn" @click="exp.cancel()">{{ $t('cloudNotes.exportCancel') }}</button>
            <button class="btn btn--primary cn-modal-btn" @click="close">{{ $t('cloudNotes.exportClose') }}</button>
          </template>
          <button v-else class="btn btn--primary cn-modal-btn" @click="doneExport">{{ $t('cloudNotes.exportDone') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isManagedNoteTitle, managedNoteDisplayName } from '@common/notesTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import type { useNoteExport, ExportItem } from '@features/cloudNotes/useNoteExport'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  exp: ReturnType<typeof useNoteExport>
}>()

const { t } = useI18n()

const show = ref(false)
const exportPhase = ref<'select' | 'progress'>('select')
const exportSelected = ref<number[]>([])

// Managed notes recognised for export (the README has no managed prefix, so it
// is naturally excluded).
const exportNotes = computed(() =>
  props.cn.allNotes.value
    .filter((n) => isManagedNoteTitle(n.title))
    .map((n) => ({ id: n.id, displayName: managedNoteDisplayName(n.title) })),
)

/** Footer entry point: resume an active/unread run, else fresh select. */
async function openFromFooter(): Promise<void> {
  show.value = true
  if (props.exp.queue.value.length > 0) {
    exportPhase.value = 'progress'
  } else {
    exportPhase.value = 'select'
    exportSelected.value = []
    await props.cn.loadAll()
  }
}

function close(): void {
  // Only hide — the queue (running or finished) survives until "Done".
  show.value = false
}

function doneExport(): void {
  props.exp.reset()
  exportSelected.value = []
  exportPhase.value = 'select'
  show.value = false
}

function toggleExportNote(id: number): void {
  const i = exportSelected.value.indexOf(id)
  if (i === -1) exportSelected.value.push(id)
  else exportSelected.value.splice(i, 1)
}

function onStartExport(): void {
  if (exportSelected.value.length === 0) return
  exportPhase.value = 'progress'
  void props.exp.startExport([...exportSelected.value])
}

function exportStatusText(item: ExportItem): string {
  switch (item.status) {
    case 'fetching': return t('cloudNotes.exportFetching')
    case 'downloading': return t('cloudNotes.exportDownloading', { done: item.downloaded, total: item.total })
    case 'done': return t('cloudNotes.exportDone')
    case 'conflict': return t('cloudNotes.exportConflict')
    case 'error': return item.error || t('cloudNotes.exportError')
    default: return t('cloudNotes.exportPending')
  }
}

function exportBarWidth(item: ExportItem): number {
  if (item.status === 'done') return 100
  if (item.status === 'downloading' && item.total > 0) return Math.round((item.downloaded / item.total) * 100)
  return 0
}

defineExpose({ openFromFooter })
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

.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* Progress phase */
.cn-import-overall {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.cn-imp-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
}

.cn-imp-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cn-imp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.cn-imp-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.cn-imp-status.s-done { color: var(--success); }
.cn-imp-status.s-error { color: var(--danger); }
.cn-imp-status.s-conflict { color: var(--warning); }
.cn-imp-status.s-downloading { color: var(--accent); }

.cn-imp-bar {
  height: 4px;
  background-color: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.cn-imp-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  background-color: var(--accent);
  transition: width 0.3s ease;
}

.cn-imp-fill.s-done { background-color: var(--success); }
.cn-imp-fill.s-error,
.cn-imp-fill.s-conflict { background-color: transparent; }

.cn-imp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

/* Destructive "Replace" — matches the Download panel's "Cancel All" outline. */
.cn-imp-replace {
  color: var(--danger-pink);
  border-color: var(--danger-pink);
}

.cn-imp-replace:hover:not(:disabled) {
  background-color: var(--danger-bg);
  border-color: var(--danger-hover);
}

.cn-import-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
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
</style>
