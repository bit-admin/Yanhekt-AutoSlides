<template>
  <div class="p-4 h-full">
    <div class="flex justify-between items-center mb-5">
      <h3 class="m-0 text-base font-semibold text-text">{{ $t('downloads.downloadList') }}</h3>
      <div class="flex gap-2">
        <button @click="cancelAllDownloads" class="flex items-center gap-1 py-1.5 px-2 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all duration-200 hover:bg-elevated text-danger border-danger hover:bg-bg-danger/10 hover:border-bg-danger-hover" title="Cancel All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ $t('downloads.cancelAll') }}
        </button>
        <button @click="clearCompleted" class="flex items-center gap-1 py-1.5 px-2 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all duration-200 hover:bg-elevated text-text-muted border-text-muted hover:bg-[var(--border-color)] hover:border-[var(--text-secondary)]" title="Clear Completed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
          </svg>
          {{ $t('downloads.clear') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2 mb-4" v-if="downloadItems.length > 0">
      <div
        v-for="item in downloadItems"
        :key="item.id"
        class="download-item-wrapper"
        :class="{ 'row-highlight': highlightedDownloadId === item.id }"
        :data-download-id="item.id"
      >
        <div
          class="download-item flex items-center gap-3 p-3 bg-surface border border-border rounded-md transition-all duration-200 hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
          :class="[
            `status-${item.status}`,
            { 'border-accent shadow-[0_2px_4px_rgba(0,122,204,0.1)]': highlightedDownloadId === item.id }
          ]"
        >
          <div class="shrink-0">
            <div :class="[
              'flex items-center justify-center w-6 h-6 rounded-full border-2 border-current',
              `status-${item.status}`,
              item.status === 'downloading' ? 'animate-pulse' : '',
              item.status === 'processing' ? 'animate-spin' : ''
            ]">
              <svg v-if="item.status === 'queued'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <svg v-else-if="item.status === 'downloading'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <svg v-else-if="item.status === 'processing'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
              </svg>
              <svg v-else-if="item.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              <svg v-else-if="item.status === 'error'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-text mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap" :title="item.name">
              {{ item.name }}
            </div>
            <div class="flex flex-col gap-1">
              <div class="w-full h-1 bg-[#e9ecef] rounded-sm overflow-hidden">
                <div class="h-full bg-accent rounded-sm transition-[width] duration-300 ease-in-out" :style="{ width: `${item.progress}%` }"></div>
              </div>
              <div class="text-[11px] text-text-secondary">
                <span v-if="item.status === 'queued'">{{ $t('downloads.queued') }}</span>
                <span v-else-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'processing'">{{ $t('downloads.processing') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                <span v-else-if="item.status === 'error'">{{ item.error || $t('downloads.error') }}</span>
              </div>
            </div>
          </div>

          <div class="shrink-0">
            <button
              @click="retryDownload(item.id)"
              class="flex items-center justify-center w-6 h-6 border-none bg-transparent text-success rounded cursor-pointer transition-[background-color] duration-200 mr-1 hover:bg-success/10"
              title="Retry"
              v-if="item.status === 'error'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
            <button
              @click="cancelDownload(item.id)"
              class="flex items-center justify-center w-6 h-6 border-none bg-transparent text-danger rounded cursor-pointer transition-[background-color] duration-200 hover:bg-bg-danger/10"
              title="Cancel"
              v-if="item.status !== 'completed' && item.status !== 'error'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div
          v-if="item.extractionStatus && item.extractionStatus !== 'none'"
          class="extraction-affiliated-panel w-full bg-surface border border-border border-t-none rounded-b-md py-[3px] px-2"
          :class="[`ext-status-${item.extractionStatus}`]"
        >
          <div class="flex items-center justify-between gap-2 text-[11px] mb-0.5">
            <span :class="[
              'flex-1 whitespace-nowrap overflow-hidden text-ellipsis',
              item.extractionStatus === 'pending' ? 'text-text-muted' : '',
              item.extractionStatus === 'completed' || item.extractionStatus === 'post_processing' ? 'text-success' : '',
              item.extractionStatus === 'error' || item.extractionStatus === 'cancelled' ? 'text-danger' : '',
              item.extractionStatus !== 'pending' && item.extractionStatus !== 'completed' && item.extractionStatus !== 'post_processing' && item.extractionStatus !== 'error' && item.extractionStatus !== 'cancelled' ? 'text-text' : ''
            ]">
              <span v-if="item.extractionStatus === 'pending'">{{ $t('downloads.extraction.waiting') }}</span>
              <span v-else-if="item.extractionStatus === 'extracting'">{{ $t('downloads.extraction.extracting') }} {{ item.extractionProgress || 0 }}%</span>
              <span v-else-if="item.extractionStatus === 'normalizing'">{{ $t('downloads.extraction.normalizing') }}</span>
              <span v-else-if="item.extractionStatus === 'post_processing'">{{ $t('downloads.extraction.completed') }}</span>
              <span v-else-if="item.extractionStatus === 'completed'">{{ $t('downloads.extraction.completed') }}</span>
              <span v-else-if="item.extractionStatus === 'error'">{{ item.extractionError || $t('downloads.extraction.error') }}</span>
              <span v-else-if="item.extractionStatus === 'cancelled'">{{ $t('downloads.extraction.cancelled') }}</span>
            </span>
            <button
              v-if="item.extractionStatus === 'pending' || item.extractionStatus === 'extracting' || item.extractionStatus === 'normalizing'"
              class="cancel-item-btn flex items-center justify-center w-5 h-5 border-none bg-transparent text-danger rounded cursor-pointer transition-[background-color] duration-200 hover:bg-bg-danger/10"
              :title="$t('downloads.extraction.cancel')"
              @click="cancelExtraction(item.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="h-[3px] bg-border-border rounded-sm overflow-hidden">
            <div
              :class="[
                'h-full bg-border-border transition-[width] duration-300 ease-in-out',
                (item.extractionStatus === 'extracting' || item.extractionStatus === 'normalizing') ? 'bg-accent' : '',
                (item.extractionStatus === 'completed' || item.extractionStatus === 'post_processing') ? 'bg-success' : '',
                (item.extractionStatus === 'error' || item.extractionStatus === 'cancelled') ? 'bg-danger' : ''
              ]"
              :style="{ width: extractionBarWidth(item) + '%' }"
            ></div>
          </div>
        </div>

        <div
          v-if="getDownloadPostProcessJob(item.id)"
          class="post-process-affiliated-panel w-full bg-surface border border-border border-t-none rounded-b-md p-1 px-1.5 mt-0"
          :class="[`pp-status-${getDownloadPostProcessJob(item.id)?.status}`]"
        >
          <div class="pp-panel-content flex items-stretch gap-2 text-[8px]">
            <PostProcessingProgressBar :state="fromJobProgress(getDownloadPostProcessJob(item.id)!)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center text-center p-8 px-4 text-text-secondary">
      <div class="mb-4 opacity-60">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <p class="m-0 mb-5 text-sm italic">{{ $t('downloads.noDownloads') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { ExtractionQueue } from '@shared/services/extractionQueueService'
import { PostProcessingService, type PostProcessJob } from '@shared/services/postProcessingService'
import { fromJobProgress } from '@shared/postProcessing/displayAdapter'
import PostProcessingProgressBar from '@renderer/components/video/PostProcessingProgressBar.vue'

defineProps<{
  highlightedDownloadId: string | null
  autoPostProcessing: boolean
}>()

const downloadItems = computed(() => DownloadService.downloadItems)

// The extraction queue passes the download item's id as the post-processing
// job's taskId, so a reverse lookup by taskId works.
const getDownloadPostProcessJob = (itemId: string): PostProcessJob | undefined =>
  PostProcessingService.getJobByTaskId(itemId)

const cancelAllDownloads = () => DownloadService.cancelAll()
const clearCompleted = () => DownloadService.clearCompleted()
const cancelDownload = (id: string) => DownloadService.removeFromQueue(id)
const retryDownload = (id: string) => DownloadService.retryDownload(id)

const cancelExtraction = (id: string) => {
  void ExtractionQueue.cancelExtraction(id)
}

const extractionBarWidth = (item: DownloadItem): number => {
  const status = item.extractionStatus
  if (status === 'pending') return 0
  if (status === 'extracting') return Math.max(0, Math.min(100, item.extractionProgress || 0))
  if (status === 'normalizing') return 100
  if (status === 'post_processing') return 100
  if (status === 'completed') return 100
  if (status === 'error' || status === 'cancelled') return 100
  return 0
}
</script>

<style scoped>
/* Animations — custom durations not available as Tailwind defaults */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.animate-spin {
  animation: spin 2s linear infinite;
}

/* Status-specific indicator colors — scoped overrides Tailwind backgrounds */
.status-indicator.status-queued {
  color: var(--text-muted);
  background-color: var(--bg-elevated);
}

.status-indicator.status-downloading {
  color: var(--accent);
  background-color: var(--accent);
}

.status-indicator.status-processing {
  color: var(--warning);
  background-color: var(--warning-bg);
}

.status-indicator.status-completed {
  color: var(--success);
  background-color: var(--success-bg);
}

.status-indicator.status-error {
  color: var(--danger);
  background-color: var(--danger);
}

/* Status-specific border-left accent on download items */
.download-item.status-queued {
  border-left: 3px solid var(--text-muted);
}

.download-item.status-downloading {
  border-left: 3px solid var(--accent);
}

.download-item.status-processing {
  border-left: 3px solid var(--warning);
}

.download-item.status-completed {
  border-left: 3px solid var(--success);
}

.download-item.status-error {
  border-left: 3px solid var(--danger);
}

/* Adjacent panel border-left colors (sibling combinators) */
.download-item + .extraction-affiliated-panel,
.download-item + .post-process-affiliated-panel {
  border-left: 3px solid var(--success);
}

.extraction-affiliated-panel + .post-process-affiliated-panel {
  border-left: 3px solid var(--success);
}

.download-item.status-error + .extraction-affiliated-panel,
.download-item.status-error + .post-process-affiliated-panel {
  border-left: 3px solid var(--warning);
}

/* :has() for squared corners when affiliated panels are present */
.download-item-wrapper:has(.post-process-affiliated-panel) .download-item,
.download-item-wrapper:has(.extraction-affiliated-panel) .download-item {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.download-item-wrapper:has(.post-process-affiliated-panel) .extraction-affiliated-panel {
  border-radius: 0;
}

/* :deep() — style child component internals */
.pp-panel-content :deep(.pp-bar) {
  gap: 8px;
}

.pp-panel-content :deep(.pp-phase-bar) {
  height: 3px;
}
</style>
