<template>
  <div class="right-panel">
    <div class="content-area">
      <div
        :class="['tab-container', 'custom-scrollbar', { 'tab-hidden': rightPanelStore.currentTab !== 'task' }]"
        data-tab="task"
      >
        <TaskQueuePanel
          :highlighted-task-id="highlightedTaskId"
          :auto-post-processing="autoPostProcessing"
        />
      </div>

      <div
        :class="['tab-container', 'custom-scrollbar', { 'tab-hidden': rightPanelStore.currentTab !== 'download' }]"
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
import { createLogger } from '@shared/utils/logger';
const log = createLogger('RightPanel');
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { configStore } from '@shared/services/configStore'
import { rightPanelStore } from '@shared/services/rightPanelStore'
import TaskQueuePanel from './TaskQueuePanel.vue'
import DownloadQueuePanel from './DownloadQueuePanel.vue'

type Tab = 'task' | 'download'

const autoPostProcessing = ref<boolean>(true)
const highlightedTaskId = ref<string | null>(null)
const highlightedDownloadId = ref<string | null>(null)
const HIGHLIGHT_DURATION_MS = 1500

let taskHighlightTimeout: ReturnType<typeof setTimeout> | null = null
let downloadHighlightTimeout: ReturnType<typeof setTimeout> | null = null

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
  rightPanelStore.currentTab = 'download'
  highlightDownloadItem(downloadItemId)
}

const switchToTask = (taskId?: string) => {
  rightPanelStore.currentTab = 'task'
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
    log.error('Failed to load autoPostProcessing config:', error)
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
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
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

</style>
