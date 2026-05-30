<template>
  <div class="h-full p-4">
    <div class="mb-5 flex items-center justify-between">
      <h3 class="m-0 text-base font-semibold text-fg">{{ $t('downloads.downloadList') }}</h3>
      <div class="flex gap-2">
        <button @click="cancelAllDownloads" :class="[ctrlBtn, ctrlCancelAll]" title="Cancel All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ $t('downloads.cancelAll') }}
        </button>
        <button @click="clearCompleted" :class="[ctrlBtn, ctrlClear]" title="Clear Completed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
          </svg>
          {{ $t('downloads.clear') }}
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-2" v-if="downloadItems.length > 0">
      <div
        v-for="item in downloadItems"
        :key="item.id"
        class="group flex flex-col"
        :data-download-id="item.id"
      >
        <div
          class="flex items-center gap-3 rounded-md border border-line bg-modal p-3 transition-all group-hover:border-accent group-hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
          :class="[
            dlItemBorder(item.status),
            { 'border-accent': highlightedDownloadId === item.id,
              'rounded-b-none': (item.extractionStatus && item.extractionStatus !== 'none') || getDownloadPostProcessJob(item.id) }
          ]"
        >
          <div class="flex-shrink-0">
            <div :class="dlIndicator(item.status)">
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

          <div class="min-w-0 flex-1">
            <div class="mb-1.5 truncate text-[13px] font-medium text-fg" :title="item.name">
              {{ item.name }}
            </div>
            <div class="flex flex-col gap-1">
              <div class="h-1 w-full overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]">
                <div class="h-full rounded-[2px] bg-accent transition-[width] duration-300 dark:bg-[#4fc3f7]" :style="{ width: `${item.progress}%` }"></div>
              </div>
              <div class="text-[11px] text-fg-secondary">
                <span v-if="item.status === 'queued'">{{ $t('downloads.queued') }}</span>
                <span v-else-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'processing'">{{ $t('downloads.processing') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                <span v-else-if="item.status === 'error'">{{ item.error || $t('downloads.error') }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center">
            <button
              @click="retryDownload(item.id)"
              class="mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[#28a745] transition-colors hover:bg-[#d4edda] dark:text-[#81c784] dark:hover:bg-[#2e4a2e]"
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
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[#dc3545] transition-colors hover:bg-[#f8d7da] dark:text-[#f48fb1] dark:hover:bg-[#4a2c35]"
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
          class="w-full border border-t-0 border-line bg-modal px-2 py-[3px]"
          :class="[affiliatedBorder(item.status), { 'rounded-b-md': !getDownloadPostProcessJob(item.id) }]"
        >
          <div class="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
            <span class="flex-1 truncate" :class="extNameColor(item.extractionStatus)">
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
              class="flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[#dc3545] transition-colors hover:bg-[#f8d7da] dark:text-[#f48fb1] dark:hover:bg-[#4a2c35]"
              :title="$t('downloads.extraction.cancel')"
              @click="cancelExtraction(item.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="h-[3px] overflow-hidden rounded-[2px] bg-[#e0e0e0] dark:bg-[#404040]">
            <div
              class="h-full transition-[width] duration-300"
              :class="extFillColor(item)"
              :style="{ width: extractionBarWidth(item) + '%' }"
            ></div>
          </div>
        </div>

        <!-- 'post-process-affiliated-panel' retained as a Driver.js tour hook -->
        <div
          v-if="getDownloadPostProcessJob(item.id)"
          class="post-process-affiliated-panel w-full rounded-b-md border border-t-0 border-line bg-modal px-1.5 py-1"
          :class="affiliatedBorder(item.status)"
        >
          <div class="flex items-stretch gap-2 text-[8px]">
            <PostProcessingProgressBar :state="fromJobProgress(getDownloadPostProcessJob(item.id)!)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center p-8 text-center text-fg-secondary">
      <div class="mb-4 opacity-60">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <p class="m-0 text-sm italic">{{ $t('downloads.noDownloads') }}</p>
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

// ---- Tailwind class-string helpers ----
const ctrlBtn = 'flex items-center gap-1 rounded border px-2 py-1.5 text-[11px] cursor-pointer transition-all'
const ctrlCancelAll = 'border-[#dc3545] bg-white text-[#dc3545] hover:border-[#c82333] hover:bg-[#f8d7da] dark:border-[#f48fb1] dark:bg-[#2d2d2d] dark:text-[#f48fb1] dark:hover:bg-[#4a2c35]'
const ctrlClear = 'border-[#6c757d] bg-white text-[#6c757d] hover:border-[#545b62] hover:bg-[#e2e3e5] dark:border-[#bdbdbd] dark:bg-[#2d2d2d] dark:text-[#bdbdbd] dark:hover:bg-[#404040]'

const dlItemBorder = (s: string) => ({
  queued: 'border-l-[3px] border-l-[#6c757d] dark:border-l-[#bdbdbd]',
  downloading: 'border-l-[3px] border-l-[#007acc] dark:border-l-[#4fc3f7]',
  processing: 'border-l-[3px] border-l-[#ffc107] dark:border-l-[#ffb74d]',
  completed: 'border-l-[3px] border-l-[#28a745] dark:border-l-[#81c784]',
  error: 'border-l-[3px] border-l-[#dc3545] dark:border-l-[#f48fb1]',
}[s] || '')

const dlIndicator = (s: string) => {
  const base = 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-current'
  const v = {
    queued: 'text-[#6c757d] bg-[#f8f9fa] dark:text-[#bdbdbd] dark:bg-[#404040]',
    downloading: 'animate-pulse text-[#007acc] bg-[#e3f2fd] dark:text-[#4fc3f7] dark:bg-[#1a3a4a]',
    processing: 'animate-spin text-[#ffc107] bg-[#fff8e1] dark:text-[#ffb74d] dark:bg-[#4a3a2a]',
    completed: 'text-[#28a745] bg-[#e8f5e8] dark:text-[#81c784] dark:bg-[#2e4a2e]',
    error: 'text-[#dc3545] bg-[#ffeaea] dark:text-[#f48fb1] dark:bg-[#4a2c35]',
  }[s] || ''
  return `${base} ${v}`
}

const affiliatedBorder = (s: string) =>
  s === 'error' ? 'border-l-[3px] border-l-[#ff9800]' : 'border-l-[3px] border-l-[#9acd32]'

const extNameColor = (s: string | undefined) => ({
  pending: 'text-[#6c757d] dark:text-[#9e9e9e]',
  completed: 'text-[#28a745] dark:text-[#81c784]',
  error: 'text-[#dc3545] dark:text-[#f48fb1]',
  cancelled: 'text-[#dc3545] dark:text-[#f48fb1]',
}[s || ''] || 'text-fg')

const extFillColor = (item: DownloadItem) => {
  const s = item.extractionStatus
  if (s === 'extracting' || s === 'normalizing') return 'bg-[#007acc] dark:bg-[#4fc3f7]'
  if (s === 'completed' || s === 'post_processing') return 'bg-[#28a745] dark:bg-[#81c784]'
  if (s === 'error' || s === 'cancelled') return 'bg-[#dc3545] dark:bg-[#f48fb1]'
  return 'bg-[#e0e0e0] dark:bg-[#404040]'
}

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

