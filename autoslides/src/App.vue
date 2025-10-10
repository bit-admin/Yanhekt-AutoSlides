<template>
  <div class="app">
    <!-- Custom Title Bar -->
    <TitleBar />

    <div class="layout">
      <div class="left-panel" :style="{ width: leftWidth + 'px' }">
        <LeftPanelDemo v-if="isDemoMode" ref="leftPanelDemoRef" />
        <LeftPanel v-else />
      </div>
      <div class="divider left-divider" @mousedown="startResize('left', $event)"></div>

      <div class="main-content" :style="{ width: mainWidth + 'px' }">
        <SessionPageDemo v-if="isDemoMode && showSessionDemo" ref="sessionPageDemoRef" @back-to-courses="handleBackToCourses" />
        <MainContentDemo v-else-if="isDemoMode && showMainDemo" ref="mainContentDemoRef" />
        <MainContent v-else @switch-to-download="handleSwitchToDownload" @switch-to-task="handleSwitchToTask" />
      </div>
      <div class="divider right-divider" @mousedown="startResize('right', $event)"></div>

      <div class="right-panel" :style="{ width: rightWidth + 'px' }">
        <RightPanelDemo v-if="isDemoMode && showRightPanelDemo" ref="rightPanelDemoRef" />
        <RightPanel v-else ref="rightPanelRef" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import TitleBar from './renderer/components/TitleBar.vue'
import LeftPanel from './renderer/components/LeftPanel.vue'
import LeftPanelDemo from './renderer/components/demo/LeftPanelDemo.vue'
import MainContent from './renderer/components/MainContent.vue'
import MainContentDemo from './renderer/components/demo/MainContentDemo.vue'
import SessionPageDemo from './renderer/components/demo/SessionPageDemo.vue'
import RightPanel from './renderer/components/RightPanel.vue'
import RightPanelDemo from './renderer/components/demo/RightPanelDemo.vue'
import { useTour } from './renderer/composables/useTour'

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
const rightPanelDemoRef = ref()
const leftPanelDemoRef = ref()
const mainContentDemoRef = ref()
const sessionPageDemoRef = ref()
const isDemoMode = ref(false)
const showMainDemo = ref(false)
const showSessionDemo = ref(false)
const showRightPanelDemo = ref(false)
const { checkFirstVisit, showWelcomePopup } = useTour()

const handleSwitchToDownload = () => {
  if (rightPanelRef.value?.switchToDownload) {
    rightPanelRef.value.switchToDownload()
  }
}

const handleSwitchToTask = () => {
  if (rightPanelRef.value?.switchToTask) {
    rightPanelRef.value.switchToTask()
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

// Demo mode event handlers
const handleDemoModeToggle = (event: CustomEvent) => {
  isDemoMode.value = event.detail.enabled
  if (event.detail.enabled) {
    // Reset demo states when enabling demo mode
    showMainDemo.value = false
    showSessionDemo.value = false
    showRightPanelDemo.value = false
    nextTick(() => {
      if (leftPanelDemoRef.value) {
        leftPanelDemoRef.value.resetDemo()
      }
    })
  } else {
    // Reset all demo states when exiting demo mode
    showMainDemo.value = false
    showSessionDemo.value = false
    showRightPanelDemo.value = false
    if (leftPanelDemoRef.value) {
      leftPanelDemoRef.value.resetDemo()
    }
  }
}

const handleDemoLogin = () => {
  if (leftPanelDemoRef.value) {
    leftPanelDemoRef.value.loginDemo()
  }
}

const handleSwitchToMainDemo = () => {
  showMainDemo.value = true
}

const handleSwitchToRecorded = () => {
  nextTick(() => {
    if (mainContentDemoRef.value && mainContentDemoRef.value.switchMode) {
      // Switch to recorded mode in the demo component
      mainContentDemoRef.value.switchMode('recorded')
    }
  })
}

const handleDemoSearch = () => {
  // Dispatch event to CoursePageDemo component to trigger search
  window.dispatchEvent(new CustomEvent('demo-trigger-search'))
}

const handleSwitchToSessionDemo = () => {
  showMainDemo.value = false
  showSessionDemo.value = true
}

const handleBackToCourses = () => {
  showSessionDemo.value = false
  showMainDemo.value = true
}

const handleSwitchToRightPanelDemo = () => {
  showRightPanelDemo.value = true
}

const handleSwitchToDownloadMode = () => {
  nextTick(() => {
    if (rightPanelDemoRef.value && rightPanelDemoRef.value.switchToDownload) {
      rightPanelDemoRef.value.switchToDownload()
    }
  })
}

onMounted(() => {
  // Use nextTick to ensure the DOM has been rendered.
  nextTick(() => {
    updateSizes()

    // Check if this is the first visit and show welcome popup
    if (checkFirstVisit()) {
      // Wait a bit for the UI to fully render
      setTimeout(() => {
        showWelcomePopup()
      }, 500)
    }
  })

  window.addEventListener('resize', updateSizes)
  window.addEventListener('tour-demo-mode', handleDemoModeToggle as EventListener)
  window.addEventListener('tour-demo-login', handleDemoLogin)
  window.addEventListener('tour-switch-to-main-demo', handleSwitchToMainDemo)
  window.addEventListener('tour-switch-to-recorded', handleSwitchToRecorded)
  window.addEventListener('tour-demo-search', handleDemoSearch)
  window.addEventListener('tour-switch-to-session-demo', handleSwitchToSessionDemo)
  window.addEventListener('tour-switch-to-right-panel-demo', handleSwitchToRightPanelDemo)
  window.addEventListener('tour-switch-to-download-mode', handleSwitchToDownloadMode)

  onUnmounted(() => {
    window.removeEventListener('resize', updateSizes)
    window.removeEventListener('tour-demo-mode', handleDemoModeToggle as EventListener)
    window.removeEventListener('tour-demo-login', handleDemoLogin)
    window.removeEventListener('tour-switch-to-main-demo', handleSwitchToMainDemo)
    window.removeEventListener('tour-switch-to-recorded', handleSwitchToRecorded)
    window.removeEventListener('tour-demo-search', handleDemoSearch)
    window.removeEventListener('tour-switch-to-session-demo', handleSwitchToSessionDemo)
    window.removeEventListener('tour-switch-to-right-panel-demo', handleSwitchToRightPanelDemo)
    window.removeEventListener('tour-switch-to-download-mode', handleSwitchToDownloadMode)
  })
})
</script>

<style scoped>
.app {
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.layout {
  display: flex;
  height: calc(100% - 36px); /* Subtract titlebar height */
  width: 100%;
  background-color: #f5f5f5;
  overflow: hidden;
}

/* Adjust for macOS titlebar height */
@media screen and (-webkit-min-device-pixel-ratio: 1) {
  .layout {
    height: calc(100% - 32px); /* macOS titlebar is slightly shorter */
  }
}

.left-panel {
  background-color: #ffffff;
  border-right: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.main-content {
  background-color: #ffffff;
  flex-shrink: 0;
}

.right-panel {
  background-color: #ffffff;
  border-left: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.divider {
  width: 5px;
  background-color: #e0e0e0;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.divider:hover {
  background-color: #007acc;
}

.divider:active {
  background-color: #005a9e;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .app {
    background-color: #1a1a1a;
    color: #e0e0e0;
  }

  .layout {
    background-color: #1a1a1a;
  }

  .left-panel {
    background-color: #2d2d2d;
    border-right: 1px solid #404040;
  }

  .main-content {
    background-color: #1a1a1a;
  }

  .right-panel {
    background-color: #2d2d2d;
    border-left: 1px solid #404040;
  }

  .divider {
    background-color: #404040;
  }

  .divider:hover {
    background-color: #4da6ff;
  }

  .divider:active {
    background-color: #0080ff;
  }
}
</style>