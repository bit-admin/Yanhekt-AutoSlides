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
      <div
        :class="['tab-container', 'custom-scrollbar', { 'tab-hidden': currentTab !== 'task' }]"
        data-tab="task"
      >
        <TaskQueuePanel
          :highlighted-task-id="highlightedTaskId"
          :auto-post-processing="autoPostProcessing"
        />
      </div>

      <div
        :class="['tab-container', 'custom-scrollbar', { 'tab-hidden': currentTab !== 'download' }]"
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
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.navigation-bar {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-modal);
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
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.nav-btn:hover {
  background-color: var(--bg-hover);
}

.nav-btn.active {
  background-color: var(--bg-surface);
  border-bottom-color: var(--accent);
  color: var(--accent);
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
