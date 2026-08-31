<template>
  <div class="modal-overlay" @click.self="onOverlay">
    <div class="dialog-box lec-clone-box" @click.stop>
      <h3 class="dialog-title">{{ $t('lectures.cloneModalTitle') }}</h3>
      <p class="dialog-help">{{ $t('lectures.cloneModalHint') }}</p>

      <template v-if="!idxExp.item.value">
        <input
          ref="inputEl"
          v-model="link"
          type="text"
          class="input-field lec-clone-input"
          :placeholder="$t('lectures.clonePastePlaceholder')"
          :disabled="resolving"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="onClone"
        />
        <p v-if="error" class="lec-clone-error">{{ error }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" :disabled="resolving" @click="emit('close')">
            {{ $t('trash.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn--primary dialog-btn"
            :disabled="resolving || !link.trim()"
            @click="onClone"
          >
            {{ resolving ? $t('lectures.cloneResolving') : $t('lectures.cloneAction') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="lec-clone-row">
          <div class="lec-clone-row-top">
            <span class="lec-clone-name" :title="idxExp.item.value.title">{{ idxExp.item.value.title }}</span>
            <span class="lec-clone-status" :class="`s-${idxExp.item.value.status}`">{{ statusText(idxExp.item.value) }}</span>
          </div>
          <div class="lec-clone-bar">
            <div
              class="lec-clone-fill"
              :class="`s-${idxExp.item.value.status}`"
              :style="{ width: barWidth(idxExp.item.value) + '%' }"
            ></div>
          </div>
          <div v-if="idxExp.item.value.status === 'conflict'" class="lec-clone-conflict-actions">
            <button class="btn btn--sm btn--ghost" :disabled="idxExp.exporting.value" @click="idxExp.openFolder()">
              {{ $t('cloudNotes.exportOpenFolder') }}
            </button>
            <button class="btn btn--sm" :disabled="idxExp.exporting.value" @click="idxExp.resolveConflict('create')">
              {{ $t('cloudNotes.exportCreateNew') }}
            </button>
            <button class="btn btn--sm lec-clone-replace" :disabled="idxExp.exporting.value" @click="idxExp.resolveConflict('replace')">
              {{ $t('cloudNotes.exportReplace') }}
            </button>
            <button class="btn btn--sm btn--ghost" :disabled="idxExp.exporting.value" @click="finish(false)">
              {{ $t('cloudNotes.exportSkip') }}
            </button>
          </div>
        </div>
        <p v-if="idxExp.item.value.status === 'conflict'" class="lec-clone-hint">
          {{ $t('cloudNotes.exportConflictHint') }}
        </p>
        <div class="dialog-actions">
          <button
            v-if="idxExp.exporting.value"
            type="button"
            class="btn dialog-btn"
            @click="idxExp.cancel()"
          >
            {{ $t('cloudNotes.exportCancel') }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn--primary dialog-btn"
            @click="finish(idxExp.item.value.status === 'done')"
          >
            {{ $t('cloudNotes.exportDone') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { precheckShareLinkTimeline } from '@common/shareLink'
import { useShareIndexExport, type ShareExportItem } from '@features/cloudNotes/useShareIndexExport'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cloned'): void
}>()

const { t } = useI18n()
const idxExp = useShareIndexExport()
const link = ref('')
const error = ref('')
const resolving = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void nextTick(() => inputEl.value?.focus())
})

function statusText(item: ShareExportItem): string {
  switch (item.status) {
    case 'downloading': return t('cloudNotes.exportDownloading', { done: item.downloaded, total: item.total })
    case 'conflict': return t('cloudNotes.exportConflict')
    case 'error': return t('cloudNotes.exportError')
    case 'done': return t('cloudNotes.exportDone')
    default: return t('cloudNotes.exportPending')
  }
}

function barWidth(item: ShareExportItem): number {
  if (item.status === 'done') return 100
  if (item.status === 'downloading' && item.total > 0) return Math.round((item.downloaded / item.total) * 100)
  return 0
}

function errorForPrecheck(status: ReturnType<typeof precheckShareLinkTimeline>): string {
  if (status === 'empty') return ''
  if (status === 'invalid') return t('lectures.cloneInvalid')
  if (status === 'no-timeline') return t('lectures.cloneNoTimeline')
  return ''
}

function errorForResolve(code: string | undefined): string {
  if (code === 'share-link-no-timeline') return t('lectures.cloneNoTimeline')
  if (code === 'invalid-share-link') return t('lectures.cloneInvalid')
  return t('lectures.cloneFailed')
}

async function onClone(): Promise<void> {
  if (resolving.value || idxExp.exporting.value) return
  const raw = link.value.trim()
  const pre = precheckShareLinkTimeline(raw)
  if (pre !== 'ok') {
    error.value = errorForPrecheck(pre)
    return
  }
  error.value = ''
  resolving.value = true
  try {
    const res = await window.electronAPI.cloudNotes.resolveShareLink(raw, { requireTimeline: true })
    if (!res.ok) {
      error.value = errorForResolve(res.error)
      return
    }
    // Defense in depth: short v2 links fail in main, but a resolved v3 with a
    // reconstruct failure must still not write a timeline-less slides folder.
    if (!res.data.timeline) {
      error.value = t('lectures.cloneNoTimeline')
      return
    }
    if (res.data.urls.length === 0) {
      error.value = t('lectures.cloneEmpty')
      return
    }
    await idxExp.startExport(res.data)
  } finally {
    resolving.value = false
  }
}

function busy(): boolean {
  return resolving.value || idxExp.exporting.value
}

function onOverlay(): void {
  if (busy()) return
  if (idxExp.item.value?.status === 'conflict') return
  finish(idxExp.item.value?.status === 'done')
}

function finish(cloned: boolean): void {
  if (busy()) return
  idxExp.skipConflict()
  idxExp.reset()
  if (cloned) emit('cloned')
  else emit('close')
}
</script>

<style scoped>
.lec-clone-box {
  width: 460px;
  max-width: 92vw;
}

.lec-clone-input {
  width: 100%;
}

.lec-clone-error {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.4;
}

.lec-clone-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
}

.lec-clone-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lec-clone-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.lec-clone-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.lec-clone-status.s-done { color: var(--success); }
.lec-clone-status.s-error { color: var(--danger); }
.lec-clone-status.s-conflict { color: var(--warning); }
.lec-clone-status.s-downloading { color: var(--accent); }

.lec-clone-bar {
  height: 4px;
  background-color: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.lec-clone-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  background-color: var(--accent);
  transition: width 0.3s ease;
}

.lec-clone-fill.s-done { background-color: var(--success); }
.lec-clone-fill.s-error,
.lec-clone-fill.s-conflict { background-color: transparent; }

.lec-clone-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.lec-clone-replace {
  color: var(--danger);
  border-color: var(--danger);
}

.lec-clone-replace:hover:not(:disabled) {
  background-color: var(--danger-bg);
  border-color: var(--danger-hover);
}

.lec-clone-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
