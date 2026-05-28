<template>
  <div class="download-content">
    <div class="section-header">
      <h3>{{ $t('downloads.downloadList') }}</h3>
      <div class="queue-controls">
        <button @click="cancelAllDownloads" class="control-btn cancel-all-btn" title="Cancel All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ $t('downloads.cancelAll') }}
        </button>
        <button @click="clearCompleted" class="control-btn clear-btn" title="Clear Completed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
          </svg>
          {{ $t('downloads.clear') }}
        </button>
      </div>
    </div>

    <div class="download-queue" v-if="downloadItems.length > 0">
      <div
        v-for="item in downloadItems"
        :key="item.id"
        class="download-item-wrapper"
        :class="{ 'row-highlight': highlightedDownloadId === item.id }"
        :data-download-id="item.id"
      >
        <div
          class="download-item"
          :class="[`status-${item.status}`]"
        >
          <div class="item-status">
            <div :class="['status-indicator', `status-${item.status}`]">
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

          <div class="item-info">
            <div class="item-name" :title="item.name">
              {{ item.name }}
            </div>
            <div class="item-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${item.progress}%` }"></div>
              </div>
              <div class="progress-text">
                <span v-if="item.status === 'queued'">{{ $t('downloads.queued') }}</span>
                <span v-else-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'processing'">{{ $t('downloads.processing') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                <span v-else-if="item.status === 'error'">{{ item.error || $t('downloads.error') }}</span>
              </div>
            </div>
          </div>

          <div class="item-actions">
            <button
              @click="retryDownload(item.id)"
              class="retry-item-btn"
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
              class="cancel-item-btn"
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
          class="extraction-affiliated-panel"
          :class="[`ext-status-${item.extractionStatus}`]"
        >
          <div class="ext-row">
            <span class="ext-name">
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
              class="cancel-item-btn"
              :title="$t('downloads.extraction.cancel')"
              @click="cancelExtraction(item.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="ext-bar">
            <div
              class="ext-fill"
              :class="{
                active: item.extractionStatus === 'extracting' || item.extractionStatus === 'normalizing',
                completed: item.extractionStatus === 'completed' || item.extractionStatus === 'post_processing',
                errored: item.extractionStatus === 'error' || item.extractionStatus === 'cancelled'
              }"
              :style="{ width: extractionBarWidth(item) + '%' }"
            ></div>
          </div>
        </div>

        <div
          v-if="getDownloadPostProcessJob(item.id)"
          class="post-process-affiliated-panel"
          :class="[`pp-status-${getDownloadPostProcessJob(item.id)?.status}`]"
        >
          <div class="pp-panel-content">
            <PostProcessingProgressBar :state="fromJobProgress(getDownloadPostProcessJob(item.id)!)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-queue">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <p>{{ $t('downloads.noDownloads') }}</p>
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
.download-content {
  padding: 16px;
  height: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.queue-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background-color: #f8f9fa;
}

.cancel-all-btn {
  color: #dc3545;
  border-color: #dc3545;
}

.cancel-all-btn:hover {
  background-color: #f8d7da;
  border-color: #c82333;
}

.clear-btn {
  color: #6c757d;
  border-color: #6c757d;
}

.clear-btn:hover {
  background-color: #e2e3e5;
  border-color: #545b62;
}

.download-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.download-item-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.download-item-wrapper:has(.post-process-affiliated-panel) .download-item {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.download-item-wrapper:has(.post-process-affiliated-panel) .extraction-affiliated-panel {
  border-radius: 0;
}

.download-item-wrapper:has(.extraction-affiliated-panel) .download-item {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.download-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: all 0.2s;
}

.download-item.row-highlight {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.download-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.download-item.status-queued {
  border-left: 3px solid #6c757d;
}

.download-item.status-downloading {
  border-left: 3px solid #007acc;
}

.download-item.status-processing {
  border-left: 3px solid #ffc107;
}

.download-item.status-completed {
  border-left: 3px solid #28a745;
}

.download-item.status-error {
  border-left: 3px solid #dc3545;
}

.item-status {
  flex-shrink: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid currentColor;
}

.status-indicator.status-queued {
  color: #6c757d;
  background-color: #f8f9fa;
}

.status-indicator.status-downloading {
  color: #007acc;
  background-color: #e3f2fd;
  animation: pulse 2s infinite;
}

.status-indicator.status-processing {
  color: #ffc107;
  background-color: #fff8e1;
  animation: spin 2s linear infinite;
}

.status-indicator.status-completed {
  color: #28a745;
  background-color: #e8f5e8;
}

.status-indicator.status-error {
  color: #dc3545;
  background-color: #ffeaea;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007acc;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: #666;
}

.post-process-affiliated-panel {
  width: 100%;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 4px 6px;
  margin-top: 0;
}

.pp-panel-content {
  display: flex;
  align-items: stretch;
  gap: 8px;
  font-size: 8px;
}

.pp-panel-content :deep(.pp-bar) {
  gap: 8px;
}

.pp-panel-content :deep(.pp-phase-bar) {
  height: 3px;
}

.extraction-affiliated-panel {
  width: 100%;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 3px 8px;
}

.download-item + .extraction-affiliated-panel,
.download-item + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.extraction-affiliated-panel + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.download-item.status-error + .extraction-affiliated-panel,
.download-item.status-error + .post-process-affiliated-panel {
  border-left: 3px solid #ff9800;
}

.ext-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 2px;
}

.ext-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.ext-row .cancel-item-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.ext-bar {
  height: 3px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.ext-fill {
  height: 100%;
  background-color: #e0e0e0;
  transition: width 0.3s ease;
}

.ext-fill.active {
  background-color: #007acc;
}

.ext-fill.completed {
  background-color: #28a745;
}

.ext-fill.errored {
  background-color: #dc3545;
}

.ext-status-pending .ext-name { color: #6c757d; }
.ext-status-completed .ext-name { color: #28a745; }
.ext-status-error .ext-name,
.ext-status-cancelled .ext-name { color: #dc3545; }

.item-actions {
  flex-shrink: 0;
}

.cancel-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  color: #dc3545;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-item-btn:hover {
  background-color: #f8d7da;
}

.retry-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  color: #28a745;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-right: 4px;
}

.retry-item-btn:hover {
  background-color: #d4edda;
}

.empty-queue {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  color: #666;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-queue p {
  margin: 0 0 20px 0;
  font-size: 14px;
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .section-header h3 {
    color: #e0e0e0;
  }

  .control-btn {
    background-color: #2d2d2d;
    border-color: #555;
    color: #e0e0e0;
  }

  .control-btn:hover {
    background-color: #404040;
  }

  .cancel-all-btn {
    color: #f48fb1;
    border-color: #f48fb1;
  }

  .cancel-all-btn:hover {
    background-color: #4a2c35;
    border-color: #f06292;
  }

  .clear-btn {
    color: #bdbdbd;
    border-color: #bdbdbd;
  }

  .clear-btn:hover {
    background-color: #404040;
    border-color: #9e9e9e;
  }

  .download-item {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .download-item.row-highlight {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .download-item:hover {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .download-item.status-queued {
    border-left-color: #bdbdbd;
  }

  .download-item.status-downloading {
    border-left-color: #4fc3f7;
  }

  .download-item.status-processing {
    border-left-color: #ffb74d;
  }

  .download-item.status-completed {
    border-left-color: #81c784;
  }

  .download-item.status-error {
    border-left-color: #f48fb1;
  }

  .status-indicator.status-queued {
    color: #bdbdbd;
    background-color: #404040;
  }

  .status-indicator.status-downloading {
    color: #4fc3f7;
    background-color: #1a3a4a;
  }

  .status-indicator.status-processing {
    color: #ffb74d;
    background-color: #4a3a2a;
  }

  .status-indicator.status-completed {
    color: #81c784;
    background-color: #2e4a2e;
  }

  .status-indicator.status-error {
    color: #f48fb1;
    background-color: #4a2c35;
  }

  .item-name {
    color: #e0e0e0;
  }

  .progress-bar {
    background-color: #404040;
  }

  .progress-fill {
    background-color: #4fc3f7;
  }

  .progress-text {
    color: #bdbdbd;
  }

  .post-process-affiliated-panel,
  .extraction-affiliated-panel {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .ext-name {
    color: #e0e0e0;
  }

  .ext-bar {
    background-color: #404040;
  }

  .ext-fill {
    background-color: #404040;
  }

  .ext-fill.active {
    background-color: #4fc3f7;
  }

  .ext-fill.completed {
    background-color: #81c784;
  }

  .ext-fill.errored {
    background-color: #f48fb1;
  }

  .ext-status-pending .ext-name { color: #9e9e9e; }
  .ext-status-completed .ext-name { color: #81c784; }
  .ext-status-error .ext-name,
  .ext-status-cancelled .ext-name { color: #f48fb1; }

  .cancel-item-btn {
    color: #f48fb1;
  }

  .cancel-item-btn:hover {
    background-color: #4a2c35;
  }

  .retry-item-btn {
    color: #81c784;
  }

  .retry-item-btn:hover {
    background-color: #2e4a2e;
  }

  .empty-queue {
    color: #bdbdbd;
  }
}
</style>
