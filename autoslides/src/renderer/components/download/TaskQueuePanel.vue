<template>
  <div class="task-content">
    <div class="section-header">
      <h3>{{ $t('tasks.taskList') }}</h3>
      <div class="queue-controls">
        <button
          @click="toggleTaskQueue"
          :class="['btn', 'btn--sm', taskStats.isProcessing ? 'pause-btn' : 'start-btn']"
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
        <button @click="clearCompletedTasks" class="btn btn--sm clear-btn" title="Clear Completed">
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
              class="btn--icon cancel-item-btn"
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
            <PostProcessingProgressBar
              :state="fromJobProgress(getPostProcessJob(item.id)!)"
              :cancellable="getPostProcessJob(item.id)?.classifierMode === 'llm' && getPostProcessJob(item.id)?.status === 'processing'"
              :cancelling="getPostProcessJob(item.id)?.cancelRequested === true"
              @cancel="cancelPostProcessing(item.id)"
            />
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
import { PostProcessingService, type PostProcessJob } from '@shared/services/postProcessingService'
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

const cancelPostProcessing = (taskId: string) => {
  const job = getPostProcessJob(taskId)
  if (job) PostProcessingService.cancelJob(job.id)
}

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
  display: flex;
  flex-direction: column;
}

/* Center the empty state in the space below the header, biased slightly up
   for better optical balance */
.empty-queue {
  flex: 1;
  justify-content: center;
  padding-bottom: 30%;
}

.queue-controls {
  display: flex;
  gap: 8px;
}

.clear-btn {
  color: var(--text-secondary);
  border-color: var(--text-secondary);
}

.clear-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-secondary);
}

.start-btn {
  color: var(--success);
  border-color: var(--success);
}

.start-btn:hover:not(:disabled) {
  background-color: var(--success-bg);
  border-color: var(--success);
}

.pause-btn {
  color: var(--warning);
  border-color: var(--warning);
}

.pause-btn:hover {
  background-color: var(--warning-bg);
  border-color: var(--warning);
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
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: all 0.2s;
}

.task-item-wrapper:hover .task-item {
  border-color: var(--accent);
  box-shadow: 0 2px 4px var(--focus-ring);
}

.task-item-wrapper.row-highlight .task-item {
  border-color: var(--accent);
  box-shadow: 0 2px 4px var(--focus-ring);
}

.task-item-wrapper:hover .post-process-affiliated-panel {
  border-color: var(--accent);
}

.task-item-wrapper.row-highlight .post-process-affiliated-panel {
  border-color: var(--accent);
}

.task-item:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 4px var(--focus-ring);
}

.task-item.status-queued {
  border-left: 3px solid var(--status-queued);
}

.task-item.status-in_progress {
  border-left: 3px solid var(--success);
}

.task-item.status-completed {
  border-left: 3px solid var(--success);
}

.task-item.status-error {
  border-left: 3px solid var(--danger-pink);
}

.item-status {
  flex-shrink: 0;
}

/* .status-indicator + queued/completed/error variants are shared (components.css). */

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
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

.progress-text {
  font-size: 11px;
  color: var(--text-secondary);
}

/* .post-process-affiliated-panel + .pp-panel-content are shared (components.css). */

.task-item.status-queued + .post-process-affiliated-panel {
  border-left: 3px solid var(--status-queued);
}

.task-item.status-in_progress + .post-process-affiliated-panel {
  border-left: 3px solid var(--status-active);
}

.task-item.status-completed + .post-process-affiliated-panel {
  border-left: 3px solid var(--status-active);
}

.task-item.status-error + .post-process-affiliated-panel {
  border-left: 3px solid var(--status-error);
}

.item-actions {
  flex-shrink: 0;
}

.cancel-item-btn {
  width: 24px;
  height: 24px;
  color: var(--danger-pink);
}

.cancel-item-btn:hover {
  background-color: var(--danger-bg);
}

/* .empty-queue / .empty-icon / .empty-queue p are shared (components.css). */


</style>
