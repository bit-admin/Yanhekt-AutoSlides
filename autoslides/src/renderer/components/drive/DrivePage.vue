<template>
  <div class="drive-page">
    <PageErrorNotice v-if="page.loadError.value" :error="page.loadError.value" :retry="page.load" />
    <!-- Public-images notice, as on the old Drive page. Closing it lasts until the app restarts. -->
    <div v-if="bannerVisible" class="drive-banner" role="note">
      <span class="drive-banner-msg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span>{{ $t('drive.bannerNotice') }}
          <a class="drive-banner-a" :href="WHY_URL" @click.prevent="openExternal(WHY_URL)">{{ $t('drive.bannerWhy') }} ↗</a>
        </span>
      </span>
      <button class="drive-banner-close" :title="$t('drive.bannerDismiss')" :aria-label="$t('drive.bannerDismiss')" @click="bannerVisible = false">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="drive-toolbar">
      <div class="drive-switch" role="tablist" :aria-label="$t('navigation.cloudNotes')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="drive-pill"
          :class="{ active: activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ $t(tab.label) }}
        </button>
      </div>

      <div v-if="activeTab === 'folders'" class="drive-filters" role="radiogroup" :aria-label="$t('drive.filterLabel')">
        <button
          v-for="option in filters"
          :key="option.id"
          type="button"
          role="radio"
          class="drive-filter"
          :class="{ active: page.filter.value === option.id }"
          :aria-checked="page.filter.value === option.id"
          @click="page.filter.value = option.id"
        >
          {{ $t(option.label) }} <span class="drive-filter-count">{{ page.counts.value[option.id] }}</span>
        </button>
      </div>

      <button
        v-if="activeTab !== 'viewer'"
        type="button"
        class="btn drive-refresh"
        :disabled="page.loading.value"
        @click="page.load()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: page.loading.value }" aria-hidden="true">
          <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
        </svg>
        {{ $t('trash.refresh') }}
      </button>
    </div>

    <div class="drive-content custom-scrollbar">
      <!-- Folders: every recognised slides folder and how much of it is on Drive. -->
      <template v-if="activeTab === 'folders'">
        <EmptySetState
          v-if="!page.loading.value && page.visibleFolders.value.length === 0"
          :title="page.counts.value.all === 0 ? $t('drive.noFolders') : $t('drive.noFoldersFiltered')"
          :hint="page.counts.value.all === 0 ? $t('drive.noFoldersHint') : undefined"
        />
        <ul v-else class="drive-list">
          <li v-for="folder in page.visibleFolders.value" :key="folder.path" class="drive-row">
            <div class="drive-row-main">
              <div class="drive-row-title" :title="folder.name">{{ driveFolderTitle(folder) }}</div>
              <div class="drive-row-meta">
                <span v-if="folder.courseId" class="entity-id">{{ folder.courseId }}</span>
                <span v-if="folder.sessionId" class="entity-id">{{ folder.sessionId }}</span>
                <span class="drive-row-count">{{ $t('drive.uploadedOf', { uploaded: folder.counts.uploaded, total: folder.counts.total }) }}</span>
                <span v-if="folder.counts.changed > 0" class="badge drive-badge">{{ $t('drive.changedCount', { count: folder.counts.changed }) }}</span>
                <span v-if="folder.shares.length > 0" class="drive-row-count">· {{ $t('drive.shareCount', { count: folder.shares.length }) }}</span>
                <span v-if="folder.counts.lastUploadAt" class="drive-row-time">· {{ $t('drive.lastUpload', { time: formatDate(folder.counts.lastUploadAt) }) }}</span>
              </div>
              <div v-if="uploadRow(folder)" class="drive-progress">
                <div class="progress-bar"><div class="progress-fill" :style="{ width: uploadPercent(folder) + '%' }"></div></div>
                <span class="drive-progress-text">{{ uploadText(folder) }}</span>
              </div>
              <div v-else-if="lastFailure(folder)" class="drive-row-failure" role="status">{{ lastFailure(folder) }}</div>
            </div>
            <div class="drive-row-actions">
              <button v-if="uploadRow(folder)" type="button" class="btn btn--sm" @click="page.cancelUpload(folder)">
                {{ $t('trash.cancel') }}
              </button>
              <button
                v-else-if="folder.counts.status !== 'uploaded'"
                type="button"
                class="btn btn--sm"
                :disabled="folder.counts.total === 0"
                @click="page.upload(folder)"
              >
                {{ folder.counts.status === 'changed' ? $t('drive.uploadChanges') : $t('drive.upload') }}
              </button>
              <button type="button" class="btn btn--sm" :disabled="folder.counts.total === 0" @click="shareFolderPath = folder.path">
                {{ $t('drive.createShare') }}
              </button>
              <button type="button" class="btn btn--sm btn--ghost" :title="$t('drive.openFolder')" @click="openFolder(folder.path)">
                {{ $t('drive.openFolder') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="page.unrecognisedCount.value > 0" class="drive-footnote">
          {{ $t('drive.unrecognisedNote', { count: page.unrecognisedCount.value }) }}
        </p>
      </template>

      <!-- Shares: links made from these folders, newest first. -->
      <template v-else-if="activeTab === 'shares'">
        <EmptySetState
          v-if="!page.loading.value && page.shares.value.length === 0"
          :title="$t('drive.noShares')"
          :hint="$t('drive.noSharesHint')"
        />
        <ul v-else class="drive-list">
          <li v-for="row in page.shares.value" :key="row.share.id" class="drive-row">
            <div class="drive-row-main">
              <div class="drive-row-title">{{ driveFolderTitle(row.folder) }}</div>
              <div class="drive-row-meta">
                <span class="drive-row-count">{{ formatDate(row.share.createdAt) }}</span>
                <span class="drive-row-count">· {{ $t('drive.viewerSlides', { count: row.share.files.length }) }}</span>
                <span v-if="row.share.timeline" class="badge drive-badge">{{ $t('drive.timelineBadge') }}</span>
              </div>
              <div class="drive-share-link" :title="row.share.shortUrl || row.share.longUrl">{{ row.share.shortUrl || row.share.longUrl }}</div>
              <div v-if="shareErrors[row.share.id]" class="drive-row-failure" role="status">{{ shareErrors[row.share.id] }}</div>
            </div>
            <div class="drive-row-actions">
              <button type="button" class="btn btn--sm" @click="copy(row.share.shortUrl || row.share.longUrl, row.share.id)">
                {{ copiedId === row.share.id ? $t('drive.copied') : $t('drive.copyLink') }}
              </button>
              <button v-if="!row.share.shortUrl" type="button" class="btn btn--sm" @click="shorten(row)">
                {{ $t('drive.shorten') }}
              </button>
              <button type="button" class="btn btn--sm" @click="openInViewer(row.share.shortUrl || row.share.longUrl)">
                {{ $t('drive.openInViewer') }}
              </button>
              <button type="button" class="btn btn--sm btn--ghost" @click="openExternal(row.share.shortUrl || row.share.longUrl)">
                {{ $t('drive.openInBrowser') }}
              </button>
              <button type="button" class="btn btn--sm btn--ghost" @click="page.removeShare(row)">
                {{ $t('drive.removeShare') }}
              </button>
            </div>
          </li>
        </ul>
      </template>

      <DriveViewerPanel v-show="activeTab === 'viewer'" ref="viewerRef" />
    </div>

    <DriveShareDialog
      v-if="shareFolder"
      :folder="shareFolder"
      @close="shareFolderPath = null"
      @created="page.refreshFolder(shareFolder.path)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DriveFolderSummary } from '@common/driveStatus'
import { DriveUploads } from '@shared/services/driveUploadQueue'
import { localeTag } from '@shared/i18n'
import { driveFolderTitle, useDrivePage, type DriveFolderFilter, type DriveShareRow } from '@features/cloudNotes/useDrivePage'
import EmptySetState from '../shell/EmptySetState.vue'
import PageErrorNotice from '../shell/PageErrorNotice.vue'
import DriveShareDialog from './DriveShareDialog.vue'
import DriveViewerPanel from './DriveViewerPanel.vue'

type DriveTab = 'folders' | 'shares' | 'viewer'

const { t } = useI18n()
const page = useDrivePage()
const activeTab = ref<DriveTab>('folders')
const viewerRef = ref<InstanceType<typeof DriveViewerPanel> | null>(null)
const shareFolderPath = ref<string | null>(null)
const copiedId = ref<string | null>(null)
const shareErrors = reactive<Record<string, string>>({})

const WHY_URL = 'https://learn.ruc.edu.kg/disclosure'
const bannerVisible = ref(true)

const tabs: Array<{ id: DriveTab; label: string }> = [
  { id: 'folders', label: 'drive.tabs.folders' },
  { id: 'shares', label: 'drive.tabs.shares' },
  { id: 'viewer', label: 'drive.tabs.viewer' },
]

const filters: Array<{ id: DriveFolderFilter; label: string }> = [
  { id: 'all', label: 'drive.filters.all' },
  { id: 'none', label: 'drive.filters.none' },
  { id: 'partial', label: 'drive.filters.partial' },
  { id: 'uploaded', label: 'drive.filters.uploaded' },
  { id: 'changed', label: 'drive.filters.changed' },
]

// Looked up by path so the dialog sees the folder as refreshed after an upload.
const shareFolder = computed(() =>
  shareFolderPath.value ? page.folders.value.find((f) => f.path === shareFolderPath.value) ?? null : null)

// Kept mounted (the viewer keeps its link); the lists reload whenever the page shows again.
const props = defineProps<{ active: boolean }>()
onMounted(() => { void page.load() })
watch(() => props.active, (active) => { if (active) void page.load() })

function uploadRow(folder: DriveFolderSummary) {
  return DriveUploads.isBusy(folder.path) ? DriveUploads.rowOf(folder.path) ?? null : null
}

function uploadPercent(folder: DriveFolderSummary): number {
  const row = uploadRow(folder)
  if (!row || row.total === 0) return 0
  return Math.round(((row.done + row.failed) / row.total) * 100)
}

function uploadText(folder: DriveFolderSummary): string {
  const row = uploadRow(folder)
  if (!row) return ''
  if (row.status === 'queued' || row.status === 'checking') return t('drive.uploadWaiting')
  return t('drive.uploadingCount', { done: row.done, total: row.total })
}

/** What went wrong in the folder's last upload, until it is queued again. */
function lastFailure(folder: DriveFolderSummary): string {
  const row = DriveUploads.rowOf(folder.path)
  if (!row) return ''
  if (row.status === 'error') return row.error === 'sign-in' ? t('drive.signInRequired') : t('drive.uploadFailed')
  if (row.failed > 0) return t('drive.uploadSomeFailed', { count: row.failed })
  return ''
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(localeTag(), { dateStyle: 'medium', timeStyle: 'short' })
}

function openFolder(folderPath: string): void {
  void window.electronAPI.shell.openPath(folderPath)
}

function openExternal(url: string): void {
  if (/^https:\/\//.test(url)) void window.electronAPI.shell.openExternal(url)
}

async function copy(text: string, id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 1500)
  } catch { /* clipboard unavailable: nothing to show */ }
}

async function shorten(row: DriveShareRow): Promise<void> {
  delete shareErrors[row.share.id]
  const failure = await page.shorten(row)
  if (failure) shareErrors[row.share.id] = t('drive.shortenFailed')
}

function openInViewer(link: string): void {
  activeTab.value = 'viewer'
  viewerRef.value?.openLink(link)
}
</script>

<style scoped>
.drive-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Public-images banner (same look as the old Drive page). */
.drive-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 7px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  background-color: var(--warning-bg);
  border-bottom: 1px solid var(--border-color);
}

.drive-banner-msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.drive-banner-msg svg {
  color: var(--warning);
  flex-shrink: 0;
}

.drive-banner-a {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}

.drive-banner-a:hover {
  text-decoration: underline;
}

.drive-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.drive-banner-close:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.drive-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
}

/* Same segmented control as the Developer page switch. */
.drive-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.drive-pill {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
}

.drive-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.drive-filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.drive-filter {
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.drive-filter.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.drive-filter-count {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.drive-refresh {
  margin-left: auto;
}

.drive-refresh .spinning {
  animation: drive-spin 1s linear infinite;
}

@keyframes drive-spin {
  to { transform: rotate(360deg); }
}

.drive-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.drive-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drive-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-elevated);
}

.drive-row-main {
  flex: 1;
  min-width: 0;
}

.drive-row-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drive-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.drive-row-count,
.drive-row-time {
  font-variant-numeric: tabular-nums;
}

.drive-row-time {
  color: var(--text-muted);
}

.drive-badge {
  font-size: 11px;
}

.drive-row-failure {
  margin-top: 4px;
  font-size: 12px;
  color: var(--danger);
}

.drive-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.drive-progress .progress-bar {
  flex: 1;
  max-width: 240px;
}

.drive-progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.drive-share-link {
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drive-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.drive-footnote {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.entity-id {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-subtle);
}

.entity-id::before {
  content: '#';
  opacity: 0.55;
  margin-right: 1px;
}
</style>
