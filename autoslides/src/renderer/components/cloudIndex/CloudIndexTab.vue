<template>
  <div class="cloud-index-tab">
    <webview
      v-show="mode === 'browse'"
      ref="webviewRef"
      src="https://share.ruc.edu.kg/"
      partition="persist:cloudindex"
      class="cloud-index-webview"
    ></webview>

    <div v-if="mode !== 'browse'" class="ci-detail">
      <button class="btn btn--ghost ci-back" @click="backToBrowse">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        <span>{{ $t('cloudIndex.back') }}</span>
      </button>

      <div v-if="mode === 'loading'" class="ci-status">{{ $t('cloudIndex.loading') }}</div>
      <div v-else-if="mode === 'error'" class="ci-status ci-status--error">{{ $t('cloudIndex.loadError') }}</div>

      <template v-else-if="mode === 'detail' && detail">
        <div class="ci-header-row ci-header-row--title">
          <h1 class="ci-title">{{ parsedTitle.course }}</h1>
          <p class="ci-meta">{{ $t('cloudIndex.slideCount', { n: detail.urls.length }) }}</p>
        </div>
        <div class="ci-header-row ci-header-row--session">
          <p class="ci-session">{{ parsedTitle.session }}</p>
          <div class="ci-actions">
            <button class="btn btn--primary" :disabled="imp.importing.value" @click="onImport">
              {{ $t('cloudIndex.importToNotes') }}
            </button>
            <button class="btn" :disabled="exp.exporting.value" @click="onExport">
              {{ $t('cloudNotes.exportButton') }}
            </button>
          </div>
        </div>

        <!-- Import status row -->
        <div v-if="importRow" class="ci-row">
          <span class="ci-row-name">{{ importRow.displayName }}</span>
          <span :class="['ci-row-status', `s-${importRow.status}`]">{{ importStatusText(importRow) }}</span>
          <div v-if="importRow.status === 'conflict'" class="ci-row-actions">
            <button class="btn btn--sm btn--ghost" @click="onOpenConflictNote(importRow.conflictNoteIds?.[0])">{{ $t('cloudNotes.importOpenNote') }}</button>
            <button class="btn btn--sm" @click="imp.resolveConflict(importRow, 'create')">{{ $t('cloudNotes.importCreateAnyway') }}</button>
            <button class="btn btn--sm btn--danger-outline" @click="imp.resolveConflict(importRow, 'replace')">{{ $t('cloudNotes.importReplace') }}</button>
            <button class="btn btn--sm btn--ghost" @click="imp.skipConflict(importRow)">{{ $t('cloudNotes.importSkip') }}</button>
          </div>
          <button class="ci-row-dismiss" :aria-label="$t('cloudIndex.dismiss')" @click="imp.skipConflict(importRow)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Export status row -->
        <div v-if="exp.item.value" class="ci-row">
          <span class="ci-row-name">{{ exp.item.value.title }}</span>
          <span :class="['ci-row-status', `s-${exp.item.value.status}`]">{{ exportStatusText(exp.item.value) }}</span>
          <div v-if="exp.item.value.status === 'conflict'" class="ci-row-actions">
            <button class="btn btn--sm" @click="exp.openFolder()">{{ $t('cloudNotes.exportOpenFolder') }}</button>
            <button class="btn btn--sm" @click="exp.resolveConflict('create')">{{ $t('cloudNotes.exportCreateNew') }}</button>
            <button class="btn btn--sm btn--danger-outline" @click="exp.resolveConflict('replace')">{{ $t('cloudNotes.exportReplace') }}</button>
            <button class="btn btn--sm btn--ghost" @click="exp.skipConflict()">{{ $t('cloudNotes.exportSkip') }}</button>
          </div>
          <button class="ci-row-dismiss" :aria-label="$t('cloudIndex.dismiss')" @click="exp.skipConflict()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="ci-grid">
          <img
            v-for="(url, i) in detail.urls"
            :key="i"
            :src="url"
            :alt="`Slide ${i + 1}`"
            loading="lazy"
            @click="zoomUrl = url"
          />
        </div>
      </template>
    </div>

    <div v-if="zoomUrl" class="ci-lightbox" @click="zoomUrl = null">
      <img class="ci-lightbox-img" :src="zoomUrl" alt="" @click.stop />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ShareImportResult } from '@common/notesTypes'
import { EDITORJS_DOC_VERSION } from '@common/notesTypes'
import { NOTE_COPYRIGHT } from '@common/notesContent'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { useNoteImport, type ImportItem } from '@features/cloudNotes/useNoteImport'
import { noteOpenRequestStore } from '@features/cloudNotes/noteOpenRequest'
import { useShareIndexExport, type ShareExportItem } from '@features/cloudIndex/useShareIndexExport'
import { navigationStore } from '@features/course/navigationStore'

const { t } = useI18n()
const cn = useCloudNotes()

const imp = useNoteImport(cn, {
  meta: (count, date) => t('cloudNotes.noteMeta', { count, date }),
  warning: NOTE_COPYRIGHT,
  slideCaption: (n) => t('cloudNotes.noteSlideCaption', { n }),
})
const exp = useShareIndexExport()

type Mode = 'browse' | 'loading' | 'detail' | 'error'
const mode = ref<Mode>('browse')
const detail = ref<ShareImportResult | null>(null)
const sourceUrl = ref('')
const zoomUrl = ref<string | null>(null)

const webviewRef = ref<Electron.WebviewTag | null>(null)
let unsubscribe: (() => void) | null = null

/**
 * Split a share payload's display title into a course title and a
 * human-readable session line — mirrors the public viewer's `parseTitle`
 * (share/src/lib/title.ts) so the native detail view matches its header.
 * Folder-naming convention: "<course>_第N周_星期X_第N大节" or "<course> - Lecture N".
 */
function parseShareTitle(raw: string): { course: string; session: string } {
  const zh = raw.match(/^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/)
  if (zh) return { course: zh[1], session: `第${zh[2]}周 · 星期${zh[3]} · 第${zh[4]}大节` }
  const en = raw.match(/^(.+) - Lecture (\d+)$/)
  if (en) return { course: en[1], session: `Lecture ${en[2]}` }
  return { course: raw.replace(/_/g, ' '), session: '' }
}

const parsedTitle = computed(() => parseShareTitle(detail.value?.title ?? ''))

async function resolve(url: string): Promise<void> {
  imp.reset()
  exp.reset()
  sourceUrl.value = url
  mode.value = 'loading'
  const res = await window.electronAPI.cloudNotes.resolveShareLink(url)
  if (!res.ok || res.data.urls.length === 0) {
    mode.value = 'error'
    return
  }
  detail.value = res.data
  mode.value = 'detail'
}

function backToBrowse(): void {
  mode.value = 'browse'
}

function buildReadmeContent(): string {
  const stamp = t('cloudNotes.readmeUpdatedAt', { time: new Date().toLocaleString() })
  const blocks = [
    { type: 'header', data: { text: t('cloudNotes.readmeHeading'), level: 2 } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody1') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody2') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody3') } },
    { type: 'paragraph', data: { text: stamp } },
  ]
  return JSON.stringify({ time: Date.now(), blocks, version: EDITORJS_DOC_VERSION })
}

async function onImport(): Promise<void> {
  if (!sourceUrl.value) return
  if (!cn.hasManagedStorage.value) {
    await cn.initCloudStorage(buildReadmeContent())
  }
  await imp.importShareLink(sourceUrl.value, t('cloudNotes.importResolving'))
}

async function onExport(): Promise<void> {
  if (!detail.value) return
  await exp.startExport(detail.value)
}

/** Switch to the Cloud Notes Workspace page and open the conflicting note there. */
function onOpenConflictNote(noteId: number | undefined): void {
  if (noteId == null) return
  noteOpenRequestStore.requestOpenNote(noteId)
  navigationStore.navigate('cloud-notes')
}

const importRow = computed<ImportItem | undefined>(() => imp.queue.value[imp.queue.value.length - 1])

function importStatusText(item: ImportItem): string {
  switch (item.status) {
    case 'resolving': return t('cloudNotes.importResolving')
    case 'building': return t('cloudNotes.importBuilding')
    case 'conflict': return t('cloudNotes.importConflict')
    case 'error': return t('cloudNotes.importError')
    case 'done': return item.missing ? t('cloudNotes.importDoneMissing', { n: item.missing }) : t('cloudNotes.importDone')
    default: return ''
  }
}

function exportStatusText(item: ShareExportItem): string {
  switch (item.status) {
    case 'downloading': return t('cloudNotes.exportDownloading', { done: item.downloaded, total: item.total })
    case 'conflict': return t('cloudNotes.exportConflict')
    case 'error': return t('cloudNotes.exportError')
    case 'done': return t('cloudNotes.exportDone')
    default: return ''
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && zoomUrl.value) zoomUrl.value = null
}

onMounted(async () => {
  await cn.init()
  unsubscribe = window.electronAPI.cloudIndex.onShareLinkIntercepted((url) => {
    void resolve(url)
  })
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  unsubscribe?.()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.cloud-index-tab {
  position: relative;
  height: 100%;
  width: 100%;
}

.cloud-index-webview {
  width: 100%;
  height: 100%;
  border: none;
}

.ci-detail {
  height: 100%;
  overflow-y: auto;
  padding: 24px 120px 48px;
}

.ci-back {
  margin-bottom: 16px;
}

.ci-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.ci-status {
  color: var(--text-secondary);
  padding: 32px 0;
}

.ci-status--error {
  color: var(--danger);
}

.ci-title {
  margin: 0;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  word-break: break-word;
}

.ci-header-row--session {
  margin: 4px 0 20px;
}

.ci-session {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 500;
}

.ci-meta {
  flex: none;
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  white-space: nowrap;
}

.ci-actions {
  flex: none;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ci-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
  font-size: 13px;
}

.ci-row-name {
  font-weight: 600;
  color: var(--text-primary);
}

.ci-row-status {
  color: var(--text-secondary);
}

.ci-row-status.s-error {
  color: var(--danger);
}

.ci-row-status.s-conflict {
  color: var(--warning);
}

.ci-row-status.s-done {
  color: var(--success);
}

.ci-row-actions {
  display: flex;
  gap: 8px;
}

.ci-row-dismiss {
  flex: none;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.ci-row-dismiss:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ci-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.ci-grid img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  display: block;
  cursor: zoom-in;
  background: var(--bg-surface);
}

.ci-lightbox {
  /* Confined to this tab's own bounds (not the whole app window) — the
     sidebar/title bar stay visible behind it. */
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-super-modal);
  cursor: zoom-out;
  padding: 64px;
}

.ci-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  cursor: default;
}
</style>
