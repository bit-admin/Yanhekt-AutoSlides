<template>
  <!-- Slides → Clone Slides from Link: rebuild a slides folder from a share link. -->
  <div class="modal-overlay" @click.self="onOverlay">
    <div class="dialog-box clone-box" @click.stop>
      <h3 class="dialog-title">{{ $t('lectures.cloneModalTitle') }}</h3>
      <p class="dialog-help">{{ $t('lectures.cloneModalHint') }}</p>

      <template v-if="!shareExp.item.value">
        <input
          ref="inputEl"
          v-model="link"
          type="text"
          class="input-field clone-input"
          :placeholder="$t('lectures.clonePastePlaceholder')"
          :disabled="resolving"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="onClone"
        />
        <p v-if="error" class="clone-error">{{ error }}</p>
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
        <div class="clone-row">
          <div class="clone-row-top">
            <span class="clone-name" :title="shareExp.item.value.title">{{ shareExp.item.value.title }}</span>
            <span class="clone-status" :class="`s-${shareExp.item.value.status}`">{{ statusText(shareExp.item.value) }}</span>
          </div>
          <div class="clone-bar">
            <div
              class="clone-fill"
              :class="`s-${shareExp.item.value.status}`"
              :style="{ width: barWidth(shareExp.item.value) + '%' }"
            ></div>
          </div>
          <div v-if="shareExp.item.value.status === 'conflict'" class="clone-conflict-actions">
            <button class="btn btn--sm btn--ghost" :disabled="shareExp.exporting.value" @click="shareExp.openFolder()">
              {{ $t('cloudNotes.exportOpenFolder') }}
            </button>
            <button class="btn btn--sm" :disabled="shareExp.exporting.value" @click="shareExp.resolveConflict('create')">
              {{ $t('cloudNotes.exportCreateNew') }}
            </button>
            <button class="btn btn--sm clone-replace" :disabled="shareExp.exporting.value" @click="shareExp.resolveConflict('replace')">
              {{ $t('cloudNotes.exportReplace') }}
            </button>
            <button class="btn btn--sm btn--ghost" :disabled="shareExp.exporting.value" @click="finish(false)">
              {{ $t('cloudNotes.exportSkip') }}
            </button>
          </div>
        </div>
        <p v-if="shareExp.item.value.status === 'conflict'" class="clone-hint">
          {{ $t('cloudNotes.exportConflictHint') }}
        </p>
        <p v-if="shareExp.item.value.missing > 0" class="clone-hint" role="status">
          {{ $t(shareExp.item.value.timeline ? 'lectures.cloneMissingSlidesAndTimeline' : 'lectures.cloneMissingSlides', { count: shareExp.item.value.missing }) }}
        </p>
        <p v-if="failureText" class="clone-error" role="alert">{{ failureText }}</p>
        <div class="dialog-actions">
          <button
            v-if="canRetry"
            type="button"
            class="btn dialog-btn"
            @click="shareExp.retry()"
          >
            {{ $t('lectures.cloneRetry') }}
          </button>
          <button
            v-if="shareExp.exporting.value"
            type="button"
            class="btn dialog-btn"
            @click="shareExp.cancel()"
          >
            {{ $t('cloudNotes.exportCancel') }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn--primary dialog-btn"
            @click="finish(shareExp.item.value.status === 'done')"
          >
            {{ $t('cloudNotes.exportDone') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseShareLink } from '@common/shareLink'
import { useShareLinkExport, type ShareExportItem } from '@features/cloudNotes/useShareLinkExport'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cloned', outcome: { missing: number; timelineOmitted: boolean }): void
}>()

const { t } = useI18n()
const shareExp = useShareLinkExport()
const link = ref('')
const error = ref('')
const resolving = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void nextTick(() => inputEl.value?.focus())
})

const failureText = computed(() => {
  const row = shareExp.item.value
  if (row?.status !== 'error') return ''
  switch (row.failure) {
    case 'cancelled': return t('lectures.cloneCancelledUnchanged')
    case 'old-kept': return t('lectures.cloneOldKept')
    case 'stage-kept': return t('lectures.cloneStageKept', { path: row.stagedDir ?? '' })
    default: return t('lectures.cloneFailedUnchanged')
  }
})
const canRetry = computed(() => {
  const row = shareExp.item.value
  return !shareExp.exporting.value && row?.status === 'error' && !!row.mode && row.failure !== 'stage-kept'
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

function errorForResolve(code: string | undefined): string {
  if (code === 'invalid-share-link') return t('lectures.cloneInvalid')
  return t('lectures.cloneFailed')
}

async function onClone(): Promise<void> {
  if (resolving.value || shareExp.exporting.value) return
  const raw = link.value.trim()
  if (!raw) return
  if (!parseShareLink(raw)) {
    error.value = t('lectures.cloneInvalid')
    return
  }
  error.value = ''
  resolving.value = true
  try {
    // Any link: one with a timeline also writes timeline.json, one without
    // gives a slides-only folder.
    const res = await window.electronAPI.cloudNotes.resolveShareLink(raw)
    if (!res.ok) {
      error.value = errorForResolve(res.error)
      return
    }
    if (res.data.urls.length === 0) {
      error.value = t('lectures.cloneEmpty')
      return
    }
    await shareExp.startExport(res.data)
  } finally {
    resolving.value = false
  }
}

function busy(): boolean {
  return resolving.value || shareExp.exporting.value
}

function onOverlay(): void {
  if (busy()) return
  if (shareExp.item.value?.status === 'conflict') return
  finish(shareExp.item.value?.status === 'done')
}

function finish(cloned: boolean): void {
  if (busy()) return
  const row = shareExp.item.value
  shareExp.skipConflict()
  shareExp.reset()
  if (cloned && row) emit('cloned', { missing: row.missing, timelineOmitted: row.missing > 0 && !!row.timeline })
  else emit('close')
}
</script>

<style scoped>
.clone-box {
  width: 460px;
  max-width: 92vw;
}

.clone-input {
  width: 100%;
}

.clone-error {
  margin: -6px 0 0;
  overflow-wrap: anywhere;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.4;
}

.clone-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
}

.clone-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.clone-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.clone-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.clone-status.s-done { color: var(--success); }
.clone-status.s-error { color: var(--danger); }
.clone-status.s-conflict { color: var(--warning); }
.clone-status.s-downloading { color: var(--accent); }

.clone-bar {
  height: 4px;
  background-color: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.clone-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  background-color: var(--accent);
  transition: width 0.3s ease;
}

.clone-fill.s-done { background-color: var(--success); }
.clone-fill.s-error,
.clone-fill.s-conflict { background-color: transparent; }

.clone-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.clone-replace {
  color: var(--danger);
  border-color: var(--danger);
}

.clone-replace:hover:not(:disabled) {
  background-color: var(--danger-bg);
  border-color: var(--danger-hover);
}

.clone-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
