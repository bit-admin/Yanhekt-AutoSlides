<template>
  <div class="right-panel">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentTab === 'task' }]"
        @click="switchTab('task')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        Task
      </button>
      <button
        :class="['nav-btn', { active: currentTab === 'download' }]"
        @click="switchTab('download')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    </div>

    <div class="content-area">
      <!-- Task Mode Container -->
      <div
        :class="['tab-container', { 'tab-hidden': currentTab !== 'task' }]"
        data-tab="task"
      >
        <div class="task-content">
          <div class="section-header">
            <h3>Task List</h3>
          </div>
          <div class="placeholder-content">
            <div class="placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 11l3 3 8-8"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
              </svg>
            </div>
            <p>Task management features will be implemented here</p>
            <div class="feature-list">
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9,11 12,14 22,4"/>
                  <path d="M21,12v7a2,2 0,0,1-2,2H5a2,2 0,0,1-2-2V5a2,2 0,0,1,2-2h11"/>
                </svg>
                <span>Task tracking</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span>Progress monitoring</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14,9V5a3,3 0,0,0-6,0v4"/>
                  <rect x="2" y="9" width="20" height="12" rx="2" ry="2"/>
                </svg>
                <span>Status updates</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Download Mode Container -->
      <div
        :class="['tab-container', { 'tab-hidden': currentTab !== 'download' }]"
        data-tab="download"
      >
        <div class="download-content">
          <div class="section-header">
            <h3>Download List</h3>
            <div class="queue-controls">
              <button @click="cancelAllDownloads" class="control-btn cancel-all-btn" title="Cancel All">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Cancel All
              </button>
              <button @click="clearCompleted" class="control-btn clear-btn" title="Clear Completed">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                Clear
              </button>
            </div>
          </div>

          <div class="download-queue" v-if="downloadItems.length > 0">
            <div
              v-for="item in downloadItems"
              :key="item.id"
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
                    <span v-if="item.status === 'queued'">Queued</span>
                    <span v-else-if="item.status === 'downloading'">Downloading {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'processing'">Processing {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'completed'">Completed</span>
                    <span v-else-if="item.status === 'error'">{{ item.error || 'Error' }}</span>
                  </div>
                </div>
              </div>

              <div class="item-actions">
                <button
                  @click="cancelDownload(item.id)"
                  class="cancel-item-btn"
                  title="Cancel"
                  v-if="item.status !== 'completed'"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
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
            <p>No downloads in queue</p>
            <div class="queue-stats">
              <div class="stat-item">
                <span class="stat-label">Active:</span>
                <span class="stat-value">{{ activeCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Completed:</span>
                <span class="stat-value">{{ completedCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Errors:</span>
                <span class="stat-value">{{ errorCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DownloadService, type DownloadItem } from '../services/downloadService'

type Tab = 'task' | 'download'

interface TabState {
  // Future state properties for each tab can be added here
  // For example: tasks, downloads, filters, etc.
  initialized: boolean;
}

const currentTab = ref<Tab>('task')

// Maintain independent state for each tab
const taskState = ref<TabState>({
  initialized: true
})

const downloadState = ref<TabState>({
  initialized: true
})

// Download management
const downloadItems = computed(() => DownloadService.downloadItems)
const activeCount = computed(() => DownloadService.activeCount)
const completedCount = computed(() => DownloadService.completedCount)
const errorCount = computed(() => DownloadService.errorCount)

const switchTab = (tab: Tab) => {
  currentTab.value = tab
}

// Expose method to switch to download tab from external components
const switchToDownload = () => {
  currentTab.value = 'download'
}

// Download controls
const cancelAllDownloads = () => {
  DownloadService.cancelAll()
}

const clearCompleted = () => {
  DownloadService.clearCompleted()
}

const cancelDownload = (id: string) => {
  DownloadService.removeFromQueue(id)
}

// Listen for download tab switching events
const handleDownloadSwitch = () => {
  switchToDownload()
}

onMounted(() => {
  // Listen for events to switch to download tab
  window.addEventListener('switchToDownload', handleDownloadSwitch)
})

onUnmounted(() => {
  window.removeEventListener('switchToDownload', handleDownloadSwitch)
})

// Expose the switchToDownload method for parent components
defineExpose({
  switchToDownload
})
</script>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.navigation-bar {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  background-color: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.nav-btn:hover {
  background-color: #e9ecef;
}

.nav-btn.active {
  background-color: white;
  border-bottom-color: #007acc;
  color: #007acc;
}

.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-container {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: opacity 0.2s ease-in-out;
  overflow-y: auto;
}

.tab-container.tab-hidden {
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

.task-content, .download-content {
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

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
  color: #666;
}

.placeholder-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.placeholder-content p {
  margin: 0 0 24px 0;
  font-size: 14px;
  font-style: italic;
  line-height: 1.4;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 200px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
}

.feature-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.download-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
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

.queue-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 200px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 10px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
</style>