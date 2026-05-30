<template>
  <div class="right-panel" :data-tab="currentTab">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentTab === 'task' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        {{ $t('navigation.task') }}
      </button>
      <button
        :class="['nav-btn', { active: currentTab === 'download' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ $t('navigation.download') }}
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
            <h3>{{ $t('tasks.taskList') }}</h3>
            <div class="queue-controls">
              <button class="control-btn start-btn demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                {{ $t('tasks.start') }}
              </button>
              <button class="control-btn clear-btn demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('tasks.clear') }}
              </button>
            </div>
          </div>

          <div class="task-queue">
            <div
              v-for="item in mockTaskItems"
              :key="item.id"
              class="task-item-wrapper"
            >
              <div
                class="task-item"
                :class="[`status-${item.status}`]"
              >
                <div class="item-status">
                  <div :class="['status-indicator', `status-${item.status}`]">
                    <svg v-if="item.status === 'queued'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    <svg v-else-if="item.status === 'in_progress'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 11l3 3 8-8"/>
                      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
                    </svg>
                    <svg v-else-if="item.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20,6 9,17 4,12"/>
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
                      <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                      <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                      <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                    </div>
                  </div>
                </div>

                <div class="item-actions">
                  <button
                    class="cancel-item-btn demo-disabled"
                    v-if="item.status !== 'in_progress'"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Post-processing affiliated panel -->
              <div
                v-if="item.postProcess"
                class="post-process-affiliated-panel"
                :class="[`pp-status-${item.postProcess.status}`]"
              >
                <div class="pp-panel-content">
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase1NameShort') }}</span>
                      <span v-if="item.postProcess.phase1 === 'completed'" class="pp-phase-status completed">
                        -{{ item.postProcess.phase1Removed }}
                      </span>
                    </div>
                    <div class="pp-phase-bar">
                      <div class="pp-phase-fill" :class="{ completed: item.postProcess.phase1 === 'completed' }" :style="{ width: item.postProcess.phase1 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase2NameShort') }}</span>
                      <span v-if="item.postProcess.phase2 === 'completed'" class="pp-phase-status completed">
                        -{{ item.postProcess.phase2Removed }}
                      </span>
                    </div>
                    <div class="pp-phase-bar">
                      <div class="pp-phase-fill" :class="{ completed: item.postProcess.phase2 === 'completed' }" :style="{ width: item.postProcess.phase2 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase3NameShort') }}</span>
                      <span v-if="item.postProcess.phase3 === 'completed'" class="pp-phase-status completed">
                        -{{ item.postProcess.phase3Removed }}
                      </span>
                      <span v-else-if="item.postProcess.phase3 === 'active'" class="pp-phase-status active">
                        {{ item.postProcess.phase3Progress }}/{{ item.postProcess.phase3Total }}
                      </span>
                    </div>
                    <div class="pp-phase-bar">
                      <div class="pp-phase-fill" :class="{ completed: item.postProcess.phase3 === 'completed', active: item.postProcess.phase3 === 'active' }" :style="{ width: item.postProcess.phase3 === 'completed' ? '100%' : item.postProcess.phase3 === 'active' ? `${(item.postProcess.phase3Progress / item.postProcess.phase3Total) * 100}%` : '0%' }"></div>
                    </div>
                  </div>
                </div>
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
            <h3>{{ $t('downloads.downloadList') }}</h3>
            <div class="queue-controls">
              <button class="control-btn cancel-all-btn demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {{ $t('downloads.cancelAll') }}
              </button>
              <button class="control-btn clear-btn demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('downloads.clear') }}
              </button>
            </div>
          </div>

          <div class="download-queue">
            <div
              v-for="item in mockDownloadItems"
              :key="item.id"
              class="download-item"
              :class="[`status-${item.status}`]"
            >
              <div class="item-status">
                <div :class="['status-indicator', `status-${item.status}`]">
                  <svg v-if="item.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  <svg v-else-if="item.status === 'downloading'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
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
                    <span v-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                  </div>
                </div>
              </div>

              <div class="item-actions">
                <button
                  class="cancel-item-btn demo-disabled"
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

type Tab = 'task' | 'download'

const { t } = useI18n()
const currentTab = ref<Tab>('task')

// Mock task items for demo
const mockTaskItems = computed(() => [
  {
    id: 'task-1',
    name: t('demo.tasks.functionalAnalysis.chapter1'),
    status: 'completed',
    progress: 100,
    postProcess: {
      status: 'completed',
      phase1: 'completed',
      phase1Removed: 3,
      phase2: 'completed',
      phase2Removed: 1,
      phase3: 'completed',
      phase3Removed: 2,
      phase3Progress: 0,
      phase3Total: 0
    }
  },
  {
    id: 'task-2',
    name: t('demo.tasks.functionalAnalysis.chapter2'),
    status: 'in_progress',
    progress: 66,
    postProcess: null
  },
  {
    id: 'task-3',
    name: t('demo.tasks.realAnalysis.chapter3'),
    status: 'queued',
    progress: 0,
    postProcess: null
  }
])

// Mock download items for demo
const mockDownloadItems = computed(() => [
  {
    id: 'download-1',
    name: t('demo.downloads.complexAnalysis.chapter5'),
    status: 'completed',
    progress: 100
  },
  {
    id: 'download-2',
    name: t('demo.downloads.complexAnalysis.chapter6'),
    status: 'downloading',
    progress: 66
  },
  {
    id: 'download-3',
    name: t('demo.downloads.abstractAlgebra.chapter7'),
    status: 'queued',
    progress: 0
  }
])

const switchTab = (tab: Tab) => {
  // Only allow programmatic tab switching in demo mode
  currentTab.value = tab
}

// Expose methods for parent components
defineExpose({
  switchToDownload: () => switchTab('download'),
  switchToTask: () => switchTab('task')
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

.start-btn {
  color: #28a745;
  border-color: #28a745;
}

.start-btn:hover {
  background-color: #d4edda;
  border-color: #1e7e34;
}

.task-queue, .download-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.task-item-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-item-wrapper:has(.post-process-affiliated-panel) .task-item {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.task-item, .download-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: all 0.2s;
}

.task-item:hover, .download-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.task-item-wrapper:hover .task-item {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.task-item-wrapper:hover .post-process-affiliated-panel {
  border-color: #007acc;
}

.task-item.status-queued, .download-item.status-queued {
  border-left: 3px solid #6c757d;
}

.task-item.status-in_progress {
  border-left: 3px solid #28a745;
}

.download-item.status-downloading {
  border-left: 3px solid #007acc;
}

.task-item.status-completed, .download-item.status-completed {
  border-left: 3px solid #28a745;
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

.status-indicator.status-in_progress {
  color: #28a745;
  background-color: #e8f5e8;
  animation: pulse 2s infinite;
}

.status-indicator.status-completed {
  color: #28a745;
  background-color: #e8f5e8;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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

/* Post-processing affiliated panel */
.post-process-affiliated-panel {
  width: 100%;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 4px 6px;
  margin-top: 0;
}

.task-item.status-completed + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.task-item.status-in_progress + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.pp-panel-content {
  display: flex;
  align-items: stretch;
  gap: 8px;
  font-size: 8px;
}

.pp-phase-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.pp-phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.pp-phase-name {
  font-weight: 500;
  color: #333;
  font-size: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pp-phase-status {
  font-size: 7px;
  padding: 1px 3px;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pp-phase-status.active {
  background-color: #007acc;
  color: white;
}

.pp-phase-status.completed {
  background-color: #28a745;
  color: white;
}

.pp-phase-bar {
  height: 3px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.pp-phase-fill {
  height: 100%;
  background-color: #e0e0e0;
  transition: width 0.3s ease;
}

.pp-phase-fill.active {
  background-color: #007acc;
}

.pp-phase-fill.completed {
  background-color: #28a745;
}

/* Demo mode disabled styles */
.demo-disabled {
  pointer-events: none !important;
  cursor: default !important;
  opacity: 0.7 !important;
}

.demo-disabled:hover {
  background-color: inherit !important;
  border-color: inherit !important;
}

</style>