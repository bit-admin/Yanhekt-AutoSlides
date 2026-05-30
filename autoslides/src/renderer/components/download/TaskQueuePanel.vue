<template>
  <div class="p-4 h-full">
    <div class="flex justify-between items-center mb-5">
      <h3 class="m-0 text-base font-semibold text-text">{{ $t('tasks.taskList') }}</h3>
      <div class="flex gap-2">
        <button
          @click="toggleTaskQueue"
          :class="['flex items-center gap-1 py-1.5 px-2 border rounded text-[11px] cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed', taskStats.isProcessing ? 'border-text-warning text-text-warning hover:bg-warning-bg hover:border-[#e0a800]' : 'border-success text-success hover:bg-success/10 hover:border-success']"
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
        <button @click="clearCompletedTasks" class="flex items-center gap-1 py-1.5 px-2 border border-text-muted rounded text-[11px] text-text-muted cursor-pointer transition-all hover:bg-[var(--border-color)] hover:border-[var(--text-secondary)]" title="Clear Completed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
          </svg>
          {{ $t('tasks.clear') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2 mb-4" v-if="taskItems.length > 0">
      <div
        v-for="item in taskItems"
        :key="item.id"
        class="flex flex-col"
        :class="{ '[&_>_div:first-child]:border-accent [&_>_div:first-child]:shadow-[0_2px_4px_rgba(0,122,204,0.1)]': highlightedTaskId === item.id }"
        :data-task-id="item.id"
      >
        <div
          class="flex items-center gap-3 p-3 bg-surface border border-border rounded-md transition-all hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
          :class="{
            'border-l-[3px] border-l-[var(--text-muted)]': item.status === 'queued',
            'border-l-[3px] border-l-success': item.status === 'in_progress' || item.status === 'completed',
            'border-l-[3px] border-l-danger': item.status === 'error',
            'rounded-b-none': getPostProcessJob(item.id) && autoPostProcessing,
          }"
        >
          <div class="shrink-0">
            <div :class="['flex items-center justify-center w-6 h-6 rounded-full border-2 border-current', {
              'text-text-muted bg-elevated': item.status === 'queued',
              'text-accent': item.status === 'in_progress',
              'text-success bg-success/10': item.status === 'completed',
              'text-danger bg-danger/10': item.status === 'error',
            }]">
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

          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-text mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap" :title="item.name">
              {{ item.name }}
            </div>
            <div class="flex flex-col gap-1">
              <div class="w-full h-1 bg-hover rounded-sm overflow-hidden">
                <div class="h-full bg-accent rounded-sm transition-[width] duration-300" :style="{ width: `${item.progress}%` }"></div>
              </div>
              <div class="text-[11px] text-text-secondary">
                <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                <span v-else-if="item.status === 'error'">{{ item.error || $t('tasks.error') }}</span>
              </div>
            </div>
          </div>

          <div class="shrink-0">
            <button
              @click="removeTask(item.id)"
              class="flex items-center justify-center w-6 h-6 border-none bg-transparent text-danger rounded cursor-pointer transition-colors hover:bg-danger/10"
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
          class="w-full bg-surface border border-border border-t-0 rounded-b-md py-1 px-1.5"
          :class="{
            'border-l-[3px] border-l-[#9e9e9e]': item.status === 'queued',
            'border-l-[3px] border-l-[#9acd32]': item.status === 'in_progress' || item.status === 'completed',
            'border-l-[3px] border-l-[#ff9800]': item.status === 'error',
          }"
        >
          <div class="flex items-stretch gap-2 text-[8px] [&_.pp-bar]:gap-2 [&_.pp-phase-bar]:h-[3px]">
            <PostProcessingProgressBar :state="fromJobProgress(getPostProcessJob(item.id)!)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center text-center py-8 px-4 text-text-secondary">
      <div class="mb-4 opacity-60">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
      </div>
      <p class="m-0 mb-5 text-sm italic">{{ $t('tasks.noTasks') }}</p>
      <p class="m-0 mb-5 text-sm italic">{{ $t('tasks.noTasksDescription') }}</p>
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
