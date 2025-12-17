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
        {{ $t('navigation.task') }}
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
              <button
                @click="toggleTaskQueue"
                :class="['control-btn', taskStats.isProcessing ? 'pause-btn' : 'start-btn']"
                :title="taskStats.isProcessing ? 'Pause Queue' : 'Start Queue'"
                :disabled="!taskStats.hasQueuedTasks && !taskStats.isProcessing"
              >
                <svg v-if="taskStats.isProcessing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                {{ taskStats.isProcessing ? $t('tasks.pause') : $t('tasks.start') }}
              </button>
              <button @click="clearCompletedTasks" class="control-btn clear-btn" title="Clear Completed">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('tasks.clear') }}
              </button>
            </div>
          </div>

          <div class="task-queue" v-if="taskItems.length > 0">
            <div
              v-for="item in taskItems"
              :key="item.id"
              class="task-item-wrapper"
            >
              <!-- Main Task Item -->
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
                      <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                      <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                      <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                      <span v-else-if="item.status === 'error'">{{ item.error || $t('tasks.error') }}</span>
                    </div>
                  </div>
                </div>

                <div class="item-actions">
                  <button
                    @click="removeTask(item.id)"
                    class="cancel-item-btn"
                    title="Remove"
                    v-if="item.status !== 'in_progress'"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Affiliated Post-Processing Panel -->
              <div
                v-if="getPostProcessJob(item.id) && autoPostProcessing"
                class="post-process-affiliated-panel"
                :class="[`pp-status-${getPostProcessJob(item.id)?.status}`]"
              >
                <div class="pp-panel-content">
                  <!-- Phase 1: Duplicate Removal -->
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase1NameShort') }}</span>
                      <span
                        v-if="getPostProcessJob(item.id)!.progress.phase === 'phase1'"
                        class="pp-phase-status active"
                      >
                        {{ getPostProcessJob(item.id)!.progress.currentIndex }}/{{ getPostProcessJob(item.id)!.progress.total }}
                      </span>
                      <span
                        v-else-if="isPhaseCompleted(getPostProcessJob(item.id)!, 'phase1') && getPostProcessJob(item.id)!.progress.duplicatesRemoved > 0"
                        class="pp-phase-status completed"
                      >
                        -{{ getPostProcessJob(item.id)!.progress.duplicatesRemoved }}
                      </span>
                    </div>
                    <div class="pp-phase-bar">
                      <div
                        class="pp-phase-fill"
                        :class="{
                          'active': getPostProcessJob(item.id)!.progress.phase === 'phase1',
                          'completed': isPhaseCompleted(getPostProcessJob(item.id)!, 'phase1')
                        }"
                        :style="{ width: `${getPhaseProgress(getPostProcessJob(item.id)!, 'phase1')}%` }"
                      ></div>
                    </div>
                  </div>

                  <!-- Phase 2: Exclusion List -->
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase2NameShort') }}</span>
                      <span
                        v-if="getPostProcessJob(item.id)!.progress.phase === 'phase2'"
                        class="pp-phase-status active"
                      >
                        {{ getPostProcessJob(item.id)!.progress.currentIndex }}/{{ getPostProcessJob(item.id)!.progress.total }}
                      </span>
                      <span
                        v-else-if="isPhaseCompleted(getPostProcessJob(item.id)!, 'phase2') && getPostProcessJob(item.id)!.progress.excludedRemoved > 0"
                        class="pp-phase-status completed"
                      >
                        -{{ getPostProcessJob(item.id)!.progress.excludedRemoved }}
                      </span>
                    </div>
                    <div class="pp-phase-bar">
                      <div
                        class="pp-phase-fill"
                        :class="{
                          'active': getPostProcessJob(item.id)!.progress.phase === 'phase2',
                          'completed': isPhaseCompleted(getPostProcessJob(item.id)!, 'phase2')
                        }"
                        :style="{ width: `${getPhaseProgress(getPostProcessJob(item.id)!, 'phase2')}%` }"
                      ></div>
                    </div>
                  </div>

                  <!-- Phase 3: AI Classification -->
                  <div class="pp-phase-item">
                    <div class="pp-phase-header">
                      <span class="pp-phase-name">{{ $t('playback.postProcessStatus.phase3NameShort') }}</span>
                      <span
                        v-if="getPostProcessJob(item.id)!.progress.phase === 'phase3'"
                        class="pp-phase-status active"
                      >
                        {{ getPostProcessJob(item.id)!.progress.currentIndex }}/{{ getPostProcessJob(item.id)!.progress.total }}
                      </span>
                      <span
                        v-else-if="isPhaseCompleted(getPostProcessJob(item.id)!, 'phase3') && getPostProcessJob(item.id)!.progress.aiFiltered > 0"
                        class="pp-phase-status completed"
                      >
                        -{{ getPostProcessJob(item.id)!.progress.aiFiltered }}
                      </span>
                    </div>
                    <div class="pp-phase-bar three-color">
                      <!-- Green: completed progress -->
                      <div
                        class="pp-phase-fill"
                        :class="{
                          'active': getPostProcessJob(item.id)!.progress.phase === 'phase3',
                          'completed': isPhaseCompleted(getPostProcessJob(item.id)!, 'phase3')
                        }"
                        :style="{
                          width: `${getAIProgress(getPostProcessJob(item.id)!)}%`
                        }"
                      ></div>
                      <!-- Blue: in-progress batch overlay (shows current batch being processed) -->
                      <div
                        v-if="getPostProcessJob(item.id)!.progress.phase === 'phase3' && getAIInProgressWidth(getPostProcessJob(item.id)!) > 0"
                        class="pp-phase-fill in-progress"
                        :style="{
                          left: `${getAIProgress(getPostProcessJob(item.id)!)}%`,
                          width: `${getAIInProgressWidth(getPostProcessJob(item.id)!)}%`
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-queue">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 11l3 3 8-8"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
              </svg>
            </div>
            <p>{{ $t('tasks.noTasks') }}</p>
            <p>{{ $t('tasks.noTasksDescription') }}</p>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DownloadService, type DownloadItem } from '../services/downloadService'
import { TaskQueue, taskQueueState, type TaskItem } from '../services/taskQueueService'
import { PostProcessingService, postProcessingState, type PostProcessJob } from '../services/postProcessingService'
import { useI18n } from 'vue-i18n'

type Tab = 'task' | 'download'

interface TabState {
  // Future state properties for each tab can be added here
  // For example: tasks, downloads, filters, etc.
  initialized: boolean;
}

const { t } = useI18n()
const currentTab = ref<Tab>('task')
const autoPostProcessing = ref<boolean>(true)

// Maintain independent state for each tab
const taskState = ref<TabState>({
  initialized: true
})

const downloadState = ref<TabState>({
  initialized: true
})

// Task management
const taskItems = computed(() => TaskQueue.tasks)
const taskStats = computed(() => taskQueueState.value)

// Get post-processing job for a task
const getPostProcessJob = (taskId: string): PostProcessJob | undefined => {
  return TaskQueue.getPostProcessJob(taskId)
}

// Check if a phase has completed (we've moved past it)
const isPhaseCompleted = (job: PostProcessJob, phase: 'phase1' | 'phase2' | 'phase3'): boolean => {
  const phaseOrder = ['idle', 'phase1', 'phase2', 'phase3', 'completed']
  const currentPhaseIndex = phaseOrder.indexOf(job.progress.phase)
  const targetPhaseIndex = phaseOrder.indexOf(phase)

  return currentPhaseIndex > targetPhaseIndex || job.status === 'completed'
}

// Calculate progress percentage for a phase
const getPhaseProgress = (job: PostProcessJob, phase: 'phase1' | 'phase2' | 'phase3'): number => {
  const { progress } = job

  if (progress.phase === phase) {
    // Currently processing this phase
    return progress.total > 0 ? (progress.currentIndex / progress.total) * 100 : 0
  } else if (
    (phase === 'phase1' && (progress.phase === 'phase2' || progress.phase === 'phase3' || job.status === 'completed')) ||
    (phase === 'phase2' && (progress.phase === 'phase3' || job.status === 'completed')) ||
    (phase === 'phase3' && job.status === 'completed')
  ) {
    // Phase is completed
    return 100
  }

  return 0
}

// Get AI phase progress percentage (simplified - just use progress.currentIndex and progress.total)
const getAIProgress = (job: PostProcessJob): number => {
  // In phase 3, progress.total is the number of images to process
  // progress.currentIndex is how many have been processed
  if (job.progress.phase === 'phase3' && job.progress.total > 0) {
    return (job.progress.currentIndex / job.progress.total) * 100
  }
  // If phase 3 is completed, show 100%
  if (isPhaseCompleted(job, 'phase3')) {
    return 100
  }
  return 0
}

// Get AI in-progress batch width percentage
const getAIInProgressWidth = (job: PostProcessJob): number => {
  // Only show in-progress batch when actively processing phase 3
  if (job.progress.phase === 'phase3' && job.progress.total > 0 && job.progress.retrying > 0) {
    return (job.progress.retrying / job.progress.total) * 100
  }
  return 0
}

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

// Expose method to switch to task tab from external components
const switchToTask = () => {
  currentTab.value = 'task'
}

// Task controls
const toggleTaskQueue = () => {
  if (taskStats.value.isProcessing) {
    TaskQueue.pauseQueue()
  } else {
    TaskQueue.startQueue()
  }
}

const clearCompletedTasks = () => {
  TaskQueue.clearCompleted()
}

const removeTask = (taskId: string) => {
  TaskQueue.removeTask(taskId)
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

const retryDownload = (id: string) => {
  DownloadService.retryDownload(id)
}

// Listen for tab switching events
const handleDownloadSwitch = () => {
  switchToDownload()
}

const handleTaskSwitch = () => {
  switchToTask()
}

onMounted(async () => {
  // Listen for events to switch tabs
  window.addEventListener('switchToDownload', handleDownloadSwitch)
  window.addEventListener('switchToTask', handleTaskSwitch)

  // Load autoPostProcessing config
  try {
    const config = await window.electronAPI.config.get()
    autoPostProcessing.value = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true
  } catch (error) {
    console.error('Failed to load autoPostProcessing config:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('switchToDownload', handleDownloadSwitch)
  window.removeEventListener('switchToTask', handleTaskSwitch)
})

// Expose methods for parent components
defineExpose({
  switchToDownload,
  switchToTask
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

.start-btn:hover:not(:disabled) {
  background-color: #d4edda;
  border-color: #1e7e34;
}

.pause-btn {
  color: #ffc107;
  border-color: #ffc107;
}

.pause-btn:hover {
  background-color: #fff8e1;
  border-color: #e0a800;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn:disabled:hover {
  background-color: white;
  border-color: #ddd;
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

/* When affiliated panel exists, remove bottom border radius from task item */
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

.task-item-wrapper:hover .task-item {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.task-item-wrapper:hover .post-process-affiliated-panel {
  border-color: #007acc;
}

.task-item:hover, .download-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
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

.download-item.status-processing {
  border-left: 3px solid #ffc107;
}

.task-item.status-completed, .download-item.status-completed {
  border-left: 3px solid #28a745;
}

.task-item.status-error, .download-item.status-error {
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

/* Inherit left border color from parent task item status */
.task-item.status-queued + .post-process-affiliated-panel {
  border-left: 3px solid #6c757d;
}

.task-item.status-in_progress + .post-process-affiliated-panel {
  border-left: 3px solid #28a745;
}

.task-item.status-completed + .post-process-affiliated-panel {
  border-left: 3px solid #28a745;
}

.task-item.status-error + .post-process-affiliated-panel {
  border-left: 3px solid #dc3545;
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

.pp-phase-status.skipped {
  background-color: #e2e3e5;
  color: #6c757d;
  font-style: italic;
}

.pp-phase-bar {
  height: 3px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.pp-phase-bar.disabled {
  background-color: #f0f0f0;
}

.pp-phase-fill {
  height: 100%;
  background-color: #e0e0e0;
  transition: width 0.3s ease;
}

.pp-phase-fill.active {
  background-color: #007acc;
  animation: progressPulse 1.5s infinite;
}

.pp-phase-fill.completed {
  background-color: #28a745;
}

/* 3-color progress bar for AI processing */
.pp-phase-bar.three-color .pp-phase-fill {
  position: absolute;
  top: 0;
  height: 100%;
}

.pp-phase-bar.three-color .pp-phase-fill.completed {
  left: 0;
  background-color: #28a745;
  z-index: 2;
}

.pp-phase-bar.three-color .pp-phase-fill.in-progress {
  background-color: #007acc;
  animation: progressPulse 1.5s infinite;
  z-index: 1;
}

@keyframes progressPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
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

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .right-panel {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .content-area {
    background-color: #1e1e1e;
  }

  .task-content, .download-content {
    background-color: #1e1e1e;
  }

  .navigation-bar {
    border-bottom-color: #404040;
    background-color: #2d2d2d;
  }

  .nav-btn {
    color: #e0e0e0;
  }

  .nav-btn:hover {
    background-color: #404040;
  }

  .nav-btn.active {
    background-color: #1e1e1e;
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

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

  .start-btn {
    color: #81c784;
    border-color: #81c784;
  }

  .start-btn:hover:not(:disabled) {
    background-color: #2e4a2e;
    border-color: #66bb6a;
  }

  .pause-btn {
    color: #ffb74d;
    border-color: #ffb74d;
  }

  .pause-btn:hover {
    background-color: #4a3a2a;
    border-color: #ffa726;
  }

  .control-btn:disabled:hover {
    background-color: #2d2d2d;
    border-color: #555;
  }

  .task-item-wrapper:hover .task-item {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .task-item-wrapper:hover .post-process-affiliated-panel {
    border-color: #4fc3f7;
  }

  .task-item, .download-item {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .task-item:hover, .download-item:hover {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .task-item.status-queued, .download-item.status-queued {
    border-left-color: #bdbdbd;
  }

  .task-item.status-in_progress {
    border-left-color: #81c784;
  }

  .download-item.status-downloading {
    border-left-color: #4fc3f7;
  }

  .download-item.status-processing {
    border-left-color: #ffb74d;
  }

  .task-item.status-completed, .download-item.status-completed {
    border-left-color: #81c784;
  }

  .task-item.status-error, .download-item.status-error {
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

  /* Post-processing affiliated panel dark mode */
  .post-process-affiliated-panel {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .task-item-wrapper .task-item {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .task-item-wrapper:has(.post-process-affiliated-panel) .task-item {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  /* Inherit left border color from parent task item status - dark mode */
  .task-item.status-queued + .post-process-affiliated-panel {
    border-left-color: #bdbdbd;
  }

  .task-item.status-in_progress + .post-process-affiliated-panel {
    border-left-color: #81c784;
  }

  .task-item.status-completed + .post-process-affiliated-panel {
    border-left-color: #81c784;
  }

  .task-item.status-error + .post-process-affiliated-panel {
    border-left-color: #f48fb1;
  }

  .pp-phase-name {
    color: #e0e0e0;
  }

  .pp-phase-status.active {
    background-color: #4fc3f7;
    color: #1e1e1e;
  }

  .pp-phase-status.completed {
    background-color: #81c784;
    color: #1e1e1e;
  }

  .pp-phase-status.skipped {
    background-color: #404040;
    color: #9e9e9e;
  }

  .pp-phase-bar {
    background-color: #404040;
  }

  .pp-phase-bar.disabled {
    background-color: #3a3a3a;
  }

  .pp-phase-fill {
    background-color: #404040;
  }

  .pp-phase-fill.active {
    background-color: #4fc3f7;
  }

  .pp-phase-fill.completed {
    background-color: #81c784;
  }

  .pp-phase-bar.three-color .pp-phase-fill.completed {
    background-color: #81c784;
  }

  .pp-phase-bar.three-color .pp-phase-fill.in-progress {
    background-color: #4fc3f7;
  }

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

  .feature-item {
    background-color: #2d2d2d;
    color: #bdbdbd;
  }

  .stat-label {
    color: #757575;
  }

  .stat-value {
    color: #e0e0e0;
  }
}

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.tab-container {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.tab-container:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.tab-container::-webkit-scrollbar {
  width: 6px;
}

.tab-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.tab-container::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.tab-container:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.tab-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Dark mode scrollbar styles */
@media (prefers-color-scheme: dark) {
  .tab-container {
    scrollbar-color: transparent transparent;
  }

  .tab-container:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .tab-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .tab-container::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .tab-container:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .tab-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }
}
</style>