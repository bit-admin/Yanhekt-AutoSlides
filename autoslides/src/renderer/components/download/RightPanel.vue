<template>
  <div class="flex flex-col h-full">
    <div class="flex border-b border-border bg-elevated">
      <button
        :class="['flex-1 flex items-center justify-center gap-1.5 py-3 px-4 border-none bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-b-transparent hover:bg-hover', currentTab === 'task' ? 'bg-surface border-b-accent text-accent' : 'text-text-secondary']"
        @click="switchTab('task')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        {{ $t('navigation.task') }}
      </button>
      <button
        :class="['flex-1 flex items-center justify-center gap-1.5 py-3 px-4 border-none bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-b-transparent hover:bg-hover', currentTab === 'download' ? 'bg-surface border-b-accent text-accent' : 'text-text-secondary']"
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

    <div class="flex-1 overflow-hidden relative">
      <div
        :class="['h-full w-full absolute top-0 left-0 transition-opacity duration-200 overflow-y-auto custom-scrollbar', currentTab !== 'task' ? 'opacity-0 pointer-events-none -z-1' : '']"
        data-tab="task"
      >
        <TaskQueuePanel
          :highlighted-task-id="highlightedTaskId"
          :auto-post-processing="autoPostProcessing"
        />
      </div>

      <div
        :class="['h-full w-full absolute top-0 left-0 transition-opacity duration-200 overflow-y-auto custom-scrollbar', currentTab !== 'download' ? 'opacity-0 pointer-events-none -z-1' : '']"
        data-tab="download"
      >
        <DownloadQueuePanel
          :highlighted-download-id="highlightedDownloadId"
          :auto-post-processing="autoPostProcessing"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { configStore } from '@shared/services/configStore'
import TaskQueuePanel from './TaskQueuePanel.vue'
import DownloadQueuePanel from './DownloadQueuePanel.vue'

type Tab = 'task' | 'download'

const currentTab = ref<Tab>('task')
const autoPostProcessing = ref<boolean>(true)
const highlightedTaskId = ref<string | null>(null)
const highlightedDownloadId = ref<string | null>(null)
const HIGHLIGHT_DURATION_MS = 1500

let taskHighlightTimeout: ReturnType<typeof setTimeout> | null = null
let downloadHighlightTimeout: ReturnType<typeof setTimeout> | null = null

const switchTab = (tab: Tab) => {
  currentTab.value = tab
}

const scrollHighlightedItemIntoView = (type: Tab, itemId: string) => {
  nextTick(() => {
    const selector = type === 'task' ? '[data-task-id]' : '[data-download-id]'
    const datasetKey = type === 'task' ? 'taskId' : 'downloadId'
    const element = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find((candidate) => candidate.dataset[datasetKey] === itemId)

    element?.scrollIntoView({ block: 'nearest' })
  })
}

const highlightTaskItem = (taskId?: string) => {
  if (!taskId) return

  highlightedTaskId.value = taskId
  if (taskHighlightTimeout) {
    clearTimeout(taskHighlightTimeout)
  }

  taskHighlightTimeout = setTimeout(() => {
    if (highlightedTaskId.value === taskId) {
      highlightedTaskId.value = null
    }
    taskHighlightTimeout = null
  }, HIGHLIGHT_DURATION_MS)

  scrollHighlightedItemIntoView('task', taskId)
}

const highlightDownloadItem = (downloadItemId?: string) => {
  if (!downloadItemId) return

  highlightedDownloadId.value = downloadItemId
  if (downloadHighlightTimeout) {
    clearTimeout(downloadHighlightTimeout)
  }

  downloadHighlightTimeout = setTimeout(() => {
    if (highlightedDownloadId.value === downloadItemId) {
      highlightedDownloadId.value = null
    }
    downloadHighlightTimeout = null
  }, HIGHLIGHT_DURATION_MS)

  scrollHighlightedItemIntoView('download', downloadItemId)
}

const switchToDownload = (downloadItemId?: string) => {
  currentTab.value = 'download'
  highlightDownloadItem(downloadItemId)
}

const switchToTask = (taskId?: string) => {
  currentTab.value = 'task'
  highlightTaskItem(taskId)
}

const getSwitchItemId = (event: Event, key: 'downloadItemId' | 'taskId'): string | undefined => {
  if (!(event instanceof CustomEvent)) return undefined

  const detail: unknown = event.detail
  if (typeof detail === 'string') return detail
  if (!detail || typeof detail !== 'object') return undefined

  const value = (detail as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

const handleDownloadSwitch = (event: Event) => {
  switchToDownload(getSwitchItemId(event, 'downloadItemId'))
}

const handleTaskSwitch = (event: Event) => {
  switchToTask(getSwitchItemId(event, 'taskId'))
}

onMounted(() => {
  window.addEventListener('switchToDownload', handleDownloadSwitch)
  window.addEventListener('switchToTask', handleTaskSwitch)

  try {
    autoPostProcessing.value = configStore.autoPostProcessing !== undefined ? configStore.autoPostProcessing : true
  } catch (error) {
    console.error('Failed to load autoPostProcessing config:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('switchToDownload', handleDownloadSwitch)
  window.removeEventListener('switchToTask', handleTaskSwitch)

  if (taskHighlightTimeout) {
    clearTimeout(taskHighlightTimeout)
  }
  if (downloadHighlightTimeout) {
    clearTimeout(downloadHighlightTimeout)
  }
})

defineExpose({
  switchToDownload,
  switchToTask
})
</script>

<style scoped>
/* Custom scrollbar — macOS-style thin scrollbars that auto-hide */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.custom-scrollbar:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>
