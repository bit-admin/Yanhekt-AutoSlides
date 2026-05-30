<template>
  <div class="h-full p-4">
    <div class="mb-5 flex items-center justify-between">
      <h3 class="m-0 text-base font-semibold text-fg">{{ $t('tasks.taskList') }}</h3>
      <div class="flex gap-2">
        <button
          @click="toggleTaskQueue"
          :class="[ctrlBtn, taskStats.isProcessing ? ctrlPause : ctrlStart]"
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
        <button @click="clearCompletedTasks" :class="[ctrlBtn, ctrlClear]" title="Clear Completed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
          </svg>
          {{ $t('tasks.clear') }}
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-2" v-if="taskItems.length > 0">
      <div
        v-for="item in taskItems"
        :key="item.id"
        class="group flex flex-col"
        :data-task-id="item.id"
      >
        <div
          class="flex items-center gap-3 rounded-md border border-line bg-modal p-3 transition-all group-hover:border-accent group-hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
          :class="[
            itemBorderByStatus(item.status),
            { 'border-accent': highlightedTaskId === item.id,
              'rounded-b-none': getPostProcessJob(item.id) && autoPostProcessing }
          ]"
        >
          <div class="flex-shrink-0">
            <div :class="indicatorByStatus(item.status)">
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

          <div class="min-w-0 flex-1">
            <div class="mb-1.5 truncate text-[13px] font-medium text-fg" :title="item.name">
              {{ item.name }}
            </div>
            <div class="flex flex-col gap-1">
              <div class="h-1 w-full overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]">
                <div class="h-full rounded-[2px] bg-accent transition-[width] duration-300 dark:bg-[#4fc3f7]" :style="{ width: `${item.progress}%` }"></div>
              </div>
              <div class="text-[11px] text-fg-secondary">
                <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                <span v-else-if="item.status === 'error'">{{ item.error || $t('tasks.error') }}</span>
              </div>
            </div>
          </div>

          <div class="flex-shrink-0">
            <button
              @click="removeTask(item.id)"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[#dc3545] transition-colors hover:bg-[#f8d7da] dark:text-[#f48fb1] dark:hover:bg-[#4a2c35]"
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

        <!-- 'post-process-affiliated-panel' retained as a Driver.js tour hook -->
        <div
          v-if="getPostProcessJob(item.id) && autoPostProcessing"
          class="post-process-affiliated-panel w-full rounded-b-md border border-t-0 border-line bg-modal px-1.5 py-1 group-hover:border-accent"
          :class="ppBorderByStatus(getPostProcessJob(item.id)?.status)"
        >
          <div class="flex items-stretch gap-2 text-[8px]">
            <PostProcessingProgressBar :state="fromJobProgress(getPostProcessJob(item.id)!)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center p-8 text-center text-fg-secondary">
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

// ---- Tailwind class-string helpers (queue controls + per-status styling) ----
const ctrlBtn = 'flex items-center gap-1 rounded border px-2 py-1.5 text-[11px] cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-50'
const ctrlStart = 'border-[#28a745] bg-white text-[#28a745] enabled:hover:border-[#1e7e34] enabled:hover:bg-[#d4edda] dark:border-[#81c784] dark:bg-[#2d2d2d] dark:text-[#81c784] dark:enabled:hover:bg-[#2e4a2e]'
const ctrlPause = 'border-[#ffc107] bg-white text-[#ffc107] hover:border-[#e0a800] hover:bg-[#fff8e1] dark:border-[#ffb74d] dark:bg-[#2d2d2d] dark:text-[#ffb74d] dark:hover:bg-[#4a3a2a]'
const ctrlClear = 'border-[#6c757d] bg-white text-[#6c757d] hover:border-[#545b62] hover:bg-[#e2e3e5] dark:border-[#bdbdbd] dark:bg-[#2d2d2d] dark:text-[#bdbdbd] dark:hover:bg-[#404040]'

const itemBorderByStatus = (status: string) => ({
  queued: 'border-l-[3px] border-l-[#6c757d] dark:border-l-[#bdbdbd]',
  in_progress: 'border-l-[3px] border-l-[#28a745] dark:border-l-[#81c784]',
  completed: 'border-l-[3px] border-l-[#28a745] dark:border-l-[#81c784]',
  error: 'border-l-[3px] border-l-[#dc3545] dark:border-l-[#f48fb1]',
}[status] || '')

const indicatorByStatus = (status: string) => {
  const base = 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-current'
  const v = {
    queued: 'text-[#6c757d] bg-[#f8f9fa] dark:text-[#bdbdbd] dark:bg-[#404040]',
    in_progress: 'text-[#28a745] dark:text-[#81c784]',
    completed: 'text-[#28a745] bg-[#e8f5e8] dark:text-[#81c784] dark:bg-[#2e4a2e]',
    error: 'text-[#dc3545] bg-[#ffeaea] dark:text-[#f48fb1] dark:bg-[#4a2c35]',
  }[status] || ''
  return `${base} ${v}`
}

const ppBorderByStatus = (status: string | undefined) => ({
  queued: 'border-l-[3px] border-l-[#9e9e9e]',
  in_progress: 'border-l-[3px] border-l-[#9acd32] dark:border-l-[#b8e986]',
  completed: 'border-l-[3px] border-l-[#9acd32] dark:border-l-[#b8e986]',
  error: 'border-l-[3px] border-l-[#ff9800] dark:border-l-[#ffb74d]',
}[status || ''] || '')

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

