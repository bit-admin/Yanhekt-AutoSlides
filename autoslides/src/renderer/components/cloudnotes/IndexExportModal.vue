<template>
  <!-- Index export progress modal (single item, mirrors the notes export
       modal's progress phase). The parent owns the open flag and the
       start/done orchestration (they touch idx.viewer). -->
  <div v-if="open && idxExp.item.value" class="modal-overlay" @click.self="emit('close')">
    <div class="cn-import-box">
      <h3 class="cn-modal-title">{{ $t('cloudNotes.exportTitle') }}</h3>
      <div class="cn-import-list custom-scrollbar">
        <div class="cn-imp-row">
          <div class="cn-imp-row-top">
            <span class="cn-imp-name" :title="idxExp.item.value.title">{{ idxExp.item.value.title }}</span>
            <span class="cn-imp-status" :class="`s-${idxExp.item.value.status}`">{{ idxExportStatusText(idxExp.item.value) }}</span>
          </div>
          <div class="cn-imp-bar">
            <div class="cn-imp-fill" :class="`s-${idxExp.item.value.status}`" :style="{ width: idxExportBarWidth(idxExp.item.value) + '%' }"></div>
          </div>
          <div v-if="idxExp.item.value.status === 'conflict'" class="cn-imp-actions">
            <button class="btn btn--sm btn--ghost" :disabled="idxExp.exporting.value" @click="idxExp.openFolder()">{{ $t('cloudNotes.exportOpenFolder') }}</button>
            <button class="btn btn--sm" :disabled="idxExp.exporting.value" @click="idxExp.resolveConflict('create')">{{ $t('cloudNotes.exportCreateNew') }}</button>
            <button class="btn btn--sm cn-imp-replace" :disabled="idxExp.exporting.value" @click="idxExp.resolveConflict('replace')">{{ $t('cloudNotes.exportReplace') }}</button>
            <button class="btn btn--sm btn--ghost" :disabled="idxExp.exporting.value" @click="emit('done')">{{ $t('cloudNotes.exportSkip') }}</button>
          </div>
        </div>
      </div>
      <p v-if="idxExp.item.value.status === 'conflict'" class="cn-import-hint">{{ $t('cloudNotes.exportConflictHint') }}</p>
      <div class="cn-modal-actions">
        <template v-if="idxExp.exporting.value">
          <button class="btn cn-modal-btn" @click="idxExp.cancel()">{{ $t('cloudNotes.exportCancel') }}</button>
          <button class="btn btn--primary cn-modal-btn" @click="emit('close')">{{ $t('cloudNotes.exportClose') }}</button>
        </template>
        <button v-else class="btn btn--primary cn-modal-btn" @click="emit('done')">{{ $t('cloudNotes.exportDone') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { useShareIndexExport, ShareExportItem } from '@features/cloudNotes/useShareIndexExport'

defineProps<{
  open: boolean
  idxExp: ReturnType<typeof useShareIndexExport>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
}>()

const { t } = useI18n()

function idxExportStatusText(item: ShareExportItem): string {
  switch (item.status) {
    case 'downloading': return t('cloudNotes.exportDownloading', { done: item.downloaded, total: item.total })
    case 'conflict': return t('cloudNotes.exportConflict')
    case 'error': return t('cloudNotes.exportError')
    case 'done': return t('cloudNotes.exportDone')
    default: return t('cloudNotes.exportPending')
  }
}

function idxExportBarWidth(item: ShareExportItem): number {
  if (item.status === 'done') return 100
  if (item.status === 'downloading' && item.total > 0) return Math.round((item.downloaded / item.total) * 100)
  return 0
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
