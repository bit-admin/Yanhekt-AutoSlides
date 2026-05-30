<template>
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
        :class="{ 'row-highlight': highlightedTaskId === item.id }"
        :data-task-id="item.id"
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

        <div
          v-if="getPostProcessJob(item.id) && autoPostProcessing"
          class="post-process-affiliated-panel"
          :class="[`pp-status-${getPostProcessJob(item.id)?.status}`]"
        >
          <div class="pp-panel-content">
            <PostProcessingProgressBar :state="fromJobProgress(getPostProcessJob(item.id)!)" />
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TaskQueue, taskQueueState } from '@shared/services/taskQueueService'
import type { PostProcessJob } from '@shared/services/postProcessingService'
import { fromJobProgress } from '@shared/postProcessing/displayAdapter'
import PostProcessingProgressBar from '@renderer/components/video/PostProcessingProgressBar.vue'

defineProps<{
  highlightedTaskId: string | null
  autoPostProcessing: boolean
}>()

const taskItems = computed(() => TaskQueue.tasks)
const taskStats = computed(() => taskQueueState.value)

const getPostProcessJob = (taskId: string): PostProcessJob | undefined =>
  TaskQueue.getPostProcessJob(taskId)

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
</script>

<style scoped>
.task-content {
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

.task-queue {
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

.task-item {
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

.task-item-wrapper.row-highlight .task-item {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.task-item-wrapper:hover .post-process-affiliated-panel {
  border-color: #007acc;
}

.task-item-wrapper.row-highlight .post-process-affiliated-panel {
  border-color: #007acc;
}

.task-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.task-item.status-queued {
  border-left: 3px solid #6c757d;
}

.task-item.status-in_progress {
  border-left: 3px solid #28a745;
}

.task-item.status-completed {
  border-left: 3px solid #28a745;
}

.task-item.status-error {
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

.status-indicator.status-completed {
  color: #28a745;
  background-color: #e8f5e8;
}

.status-indicator.status-error {
  color: #dc3545;
  background-color: #ffeaea;
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

.task-item.status-queued + .post-process-affiliated-panel {
  border-left: 3px solid #9e9e9e;
}

.task-item.status-in_progress + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.task-item.status-completed + .post-process-affiliated-panel {
  border-left: 3px solid #9acd32;
}

.task-item.status-error + .post-process-affiliated-panel {
  border-left: 3px solid #ff9800;
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

  .task-item-wrapper.row-highlight .task-item {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .task-item-wrapper:hover .post-process-affiliated-panel,
  .task-item-wrapper.row-highlight .post-process-affiliated-panel {
    border-color: #4fc3f7;
  }

  .task-item {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .task-item:hover {
    border-color: #4fc3f7;
    box-shadow: 0 2px 4px rgba(79, 195, 247, 0.2);
  }

  .task-item.status-queued {
    border-left-color: #bdbdbd;
  }

  .task-item.status-in_progress {
    border-left-color: #81c784;
  }

  .task-item.status-completed {
    border-left-color: #81c784;
  }

  .task-item.status-error {
    border-left-color: #f48fb1;
  }

  .status-indicator.status-queued {
    color: #bdbdbd;
    background-color: #404040;
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

  .post-process-affiliated-panel {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .task-item.status-queued + .post-process-affiliated-panel {
    border-left-color: #9e9e9e;
  }

  .task-item.status-in_progress + .post-process-affiliated-panel {
    border-left-color: #b8e986;
  }

  .task-item.status-completed + .post-process-affiliated-panel {
    border-left-color: #b8e986;
  }

  .task-item.status-error + .post-process-affiliated-panel {
    border-left-color: #ffb74d;
  }

  .cancel-item-btn {
    color: #f48fb1;
  }

  .cancel-item-btn:hover {
    background-color: #4a2c35;
  }

  .empty-queue {
    color: #bdbdbd;
  }
}
</style>
