<template>
  <div class="app">
    <!-- Custom Title Bar -->
    <TitleBar />

    <div class="layout">
      <div class="left-panel" :style="{ width: leftWidth + 'px' }">
        <LeftPanel />
      </div>
      <div class="divider left-divider" @mousedown="startResize('left', $event)"></div>

      <!-- Browser Login View (replaces MainContent and RightPanel) -->
      <div v-if="isBrowserLoginActive" class="browser-login-container" :style="{ width: (mainWidth + rightWidth + 5) + 'px' }">
        <BrowserLoginView
          @close="closeBrowserLogin"
          @token-received="handleBrowserToken"
        />
      </div>

      <!-- Normal content when not in browser login mode -->
      <template v-else>
        <div class="main-content" :style="{ width: mainWidth + 'px' }">
          <MainContent @switch-to-download="handleSwitchToDownload" @switch-to-task="handleSwitchToTask" />
        </div>
        <div class="divider right-divider" @mousedown="startResize('right', $event)"></div>

        <div class="right-panel" :style="{ width: rightWidth + 'px' }">
          <RightPanel ref="rightPanelRef" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import TitleBar from '@renderer/components/titlebar/TitleBar.vue'
import LeftPanel from '@renderer/components/settings/LeftPanel.vue'
import MainContent from '@renderer/components/MainContent.vue'
import RightPanel from '@renderer/components/download/RightPanel.vue'
import BrowserLoginView from '@renderer/components/settings/BrowserLoginView.vue'
import { useAuth } from '@features/platform/useAuth'

const { isBrowserLoginActive, closeBrowserLogin, handleBrowserToken } = useAuth()

const leftWidth = ref(320)
const rightWidth = ref(320)
const mainWidth = ref(760)

let isResizing = false
let resizeType = ''
let startX = 0
let startLeftWidth = 0
let startRightWidth = 0
let containerWidth = 0

const rightPanelRef = ref()

const handleSwitchToDownload = (downloadItemId?: string) => {
  if (rightPanelRef.value?.switchToDownload) {
    rightPanelRef.value.switchToDownload(downloadItemId)
  }
}

const handleSwitchToTask = (taskId?: string) => {
  if (rightPanelRef.value?.switchToTask) {
    rightPanelRef.value.switchToTask(taskId)
  }
}

const startResize = (type: string, event: MouseEvent) => {
  isResizing = true
  resizeType = type
  startX = event.clientX
  startLeftWidth = leftWidth.value
  startRightWidth = rightWidth.value
  containerWidth = window.innerWidth - 10

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  event.preventDefault()
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing) return

  const deltaX = event.clientX - startX
  const minLeft = 250
  const minRight = 250
  const minMain = 500
  const dividerWidth = 10

  if (resizeType === 'left') {
    const newLeftWidth = Math.max(minLeft, Math.min(600, startLeftWidth + deltaX))
    const maxLeftWidth = containerWidth - rightWidth.value - minMain - dividerWidth

    leftWidth.value = Math.min(newLeftWidth, maxLeftWidth)
    mainWidth.value = containerWidth - leftWidth.value - rightWidth.value - dividerWidth
  } else if (resizeType === 'right') {
    const newRightWidth = Math.max(minRight, Math.min(600, startRightWidth - deltaX))
    const maxRightWidth = containerWidth - leftWidth.value - minMain - dividerWidth

    rightWidth.value = Math.min(newRightWidth, maxRightWidth)
    mainWidth.value = containerWidth - leftWidth.value - rightWidth.value - dividerWidth
  }
}

const stopResize = () => {
  isResizing = false
  resizeType = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const updateSizes = () => {
  const totalWidth = window.innerWidth
  const minLeft = 250
  const minRight = 250
  const minMain = 500
  const dividerWidth = 10

  const availableWidth = totalWidth - dividerWidth
  const totalMinWidth = minLeft + minRight + minMain

  if (availableWidth < totalMinWidth) {
    const ratio = availableWidth / totalMinWidth
    leftWidth.value = Math.floor(minLeft * ratio)
    rightWidth.value = Math.floor(minRight * ratio)
    mainWidth.value = availableWidth - leftWidth.value - rightWidth.value
  } else {
    const currentTotal = leftWidth.value + rightWidth.value + mainWidth.value
    if (Math.abs(currentTotal - availableWidth) > 5) {
      const ratio = availableWidth / currentTotal
      leftWidth.value = Math.max(minLeft, Math.floor(leftWidth.value * ratio))
      rightWidth.value = Math.max(minRight, Math.floor(rightWidth.value * ratio))
      mainWidth.value = availableWidth - leftWidth.value - rightWidth.value
    }
  }
}

onMounted(() => {
  // Use nextTick to ensure the DOM has been rendered.
  nextTick(() => {
    updateSizes()
  })

  window.addEventListener('resize', updateSizes)

  onUnmounted(() => {
    window.removeEventListener('resize', updateSizes)
  })
})
</script>

<style scoped>
.app {
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.layout {
  display: flex;
  height: calc(100% - 36px); /* Subtract titlebar height */
  width: 100%;
  background-color: var(--bg-page);
  overflow: hidden;
}

/* Adjust for macOS titlebar height */
@media screen and (-webkit-min-device-pixel-ratio: 1) {
  .layout {
    height: calc(100% - 32px); /* macOS titlebar is slightly shorter */
  }
}

.left-panel {
  background-color: var(--bg-modal);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

.main-content {
  background-color: var(--bg-page);
  flex-shrink: 0;
}

.right-panel {
  background-color: var(--bg-modal);
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
}

.browser-login-container {
  flex: 1;
  background-color: var(--bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.divider {
  width: 5px;
  background-color: var(--border-color);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.divider:hover {
  background-color: var(--accent-strong);
}

.divider:active {
  background-color: var(--accent-hover);
}
</style>
