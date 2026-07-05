<template>
  <div v-if="open" class="modal-overlay" @click.self="$emit('close')">
    <div class="cn-import-box">
      <h3 class="cn-modal-title">{{ title }}</h3>

      <div class="cn-import-overall">{{ $t('cloudNotes.importOverall', { done: imp.overall.value.done, total: imp.overall.value.total }) }}</div>
      <div class="cn-import-list custom-scrollbar">
        <div v-for="item in imp.queue.value" :key="item.folderName" class="cn-imp-row">
          <div class="cn-imp-row-top">
            <span class="cn-imp-name" :title="item.displayName">{{ item.displayName }}</span>
            <span class="cn-imp-status" :class="`s-${item.status}`">{{ statusText(item) }}</span>
          </div>
          <div class="cn-imp-bar">
            <div class="cn-imp-fill" :class="`s-${item.status}`" :style="{ width: barWidth(item) + '%' }"></div>
          </div>
          <div v-if="item.status === 'conflict'" class="cn-imp-actions">
            <button class="btn btn--sm btn--ghost" :disabled="imp.importing.value" @click="$emit('open-note', item.conflictNoteIds?.[0])">{{ $t('cloudNotes.importOpenNote') }}</button>
            <button class="btn btn--sm" :disabled="imp.importing.value" @click="imp.resolveConflict(item, 'create')">{{ $t('cloudNotes.importCreateAnyway') }}</button>
            <button class="btn btn--sm cn-imp-replace" :disabled="imp.importing.value" @click="imp.resolveConflict(item, 'replace')">{{ $t('cloudNotes.importReplace') }}</button>
            <button class="btn btn--sm btn--ghost" :disabled="imp.importing.value" @click="imp.skipConflict(item)">{{ $t('cloudNotes.importSkip') }}</button>
          </div>
        </div>
      </div>
      <p v-if="imp.queue.value.some(i => i.status === 'conflict')" class="cn-import-hint">{{ $t('cloudNotes.importConflictHint') }}</p>
      <div class="cn-modal-actions">
        <template v-if="imp.importing.value">
          <button class="btn cn-modal-btn" @click="imp.cancel()">{{ $t('cloudNotes.importCancel') }}</button>
          <button class="btn btn--primary cn-modal-btn" @click="$emit('close')">{{ $t('cloudNotes.importClose') }}</button>
        </template>
        <button v-else class="btn btn--primary cn-modal-btn" @click="$emit('done')">{{ $t('cloudNotes.importDone') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { useNoteImport, ImportItem } from '@features/cloudNotes/useNoteImport'

defineProps<{
  /** Whether the modal is shown. */
  open: boolean
  /** Modal heading. */
  title: string
  /** The shared import queue driving the progress rows. */
  imp: ReturnType<typeof useNoteImport>
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
  (e: 'open-note', id?: number): void
}>()

const { t } = useI18n()

function statusText(item: ImportItem): string {
  switch (item.status) {
    case 'resolving': return t('cloudNotes.importResolving')
    case 'uploading': return t('cloudNotes.importUploading', { done: item.uploaded, total: item.total })
    case 'building': return t('cloudNotes.importBuilding')
    case 'publishing': return t('cloudNotes.importPublishing')
    case 'done': return item.indexUrl ? t('cloudNotes.importPublished') : t('cloudNotes.importDone')
    case 'conflict': return t('cloudNotes.importConflict')
    case 'error': return errorText(item.error)
    default: return t('cloudNotes.importPending')
  }
}

/** Map known machine error codes to friendly text; fall through to raw/server message. */
function errorText(error?: string): string {
  switch (error) {
    case 'empty':
    case 'no-images': return t('cloudNotes.importEmpty')
    case 'not-signed-in': return t('cloudNotes.importNotSignedIn')
    case 'not-indexable': return t('cloudNotes.importNotIndexable')
    case 'publish-failed': return t('cloudNotes.shareIndexError')
    default: return error || t('cloudNotes.importError')
  }
}

function barWidth(item: ImportItem): number {
  if (item.status === 'done' || item.status === 'building' || item.status === 'publishing') return 100
  if (item.status === 'uploading' && item.total > 0) return Math.round((item.uploaded / item.total) * 100)
  return 0
}
</script>

<style scoped>
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

.cn-import-overall {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
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
.cn-imp-status.s-uploading,
.cn-imp-status.s-publishing,
.cn-imp-status.s-resolving,
.cn-imp-status.s-building { color: var(--accent); }

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
