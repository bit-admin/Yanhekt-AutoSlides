<template>
  <!-- --left-panel-width lets the title bar split its background at the
       sidebar boundary (transparent glass left, opaque right) on macOS;
       --right-panel-width pins the title bar's view switcher to the right
       panel's left edge so it left-aligns over that panel. -->
  <div class="app" :style="{ '--left-panel-width': leftWidth + 'px', '--right-panel-width': rightWidth + 'px' }">
    <!-- macOS only (display gated in CSS): one continuous glass tint behind
         both the title bar's sidebar segment and the left panel, so the two
         regions cannot mismatch. -->
    <div class="sidebar-glass-underlay"></div>
    <!-- Custom Title Bar -->
    <TitleBar />

    <div class="layout">
      <div class="left-panel" :style="{ width: leftWidth + 'px' }">
        <LeftPanel />
      </div>
      <div class="divider left-divider" @mousedown="startResize('left', $event)"></div>

      <!-- Browser Login View (replaces MainContent and RightPanel) -->
      <div v-if="isBrowserLoginActive" class="browser-login-container" :style="{ width: (mainWidth + rightWidth) + 'px' }">
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

    <OnboardingModal v-if="showOnboarding" @finish="completeOnboarding" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import TitleBar from '@renderer/components/titlebar/TitleBar.vue'
import LeftPanel from '@renderer/components/settings/LeftPanel.vue'
import MainContent from '@renderer/components/MainContent.vue'
import RightPanel from '@renderer/components/download/RightPanel.vue'
import BrowserLoginView from '@renderer/components/settings/BrowserLoginView.vue'
import OnboardingModal from '@renderer/components/settings/OnboardingModal.vue'
import { useAuth } from '@features/platform/useAuth'
import { configStore } from '@shared/services/configStore'
import { isDemoMode } from '@shared/services/runtimeEnv'

const { isBrowserLoginActive, closeBrowserLogin, handleBrowserToken } = useAuth()

// First-run onboarding. configStore is loaded before app.mount, so the flag is
// available synchronously here. Existing installs are migrated to "completed"
// in the main-process ConfigService, so only genuine first runs see the wizard.
// Demo mode (screenshots) always skips it.
const showOnboarding = ref(!configStore.onboardingCompleted && !isDemoMode())

const completeOnboarding = () => {
  showOnboarding.value = false
  window.electronAPI.config.setOnboardingCompleted(true)
}

// Demo-only hook so the screenshot script can render the onboarding wizard (it's
// otherwise first-run-only and suppressed in demo mode). Never exposed in prod.
if (isDemoMode()) {
  ;(window as unknown as { __demoSetOnboarding?: (v: boolean) => void }).__demoSetOnboarding = (v) => {
    showOnboarding.value = v
  }
}

const leftWidth = ref(240)
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
  containerWidth = window.innerWidth

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  event.preventDefault()
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing) return

  const deltaX = event.clientX - startX
  const minLeft = 200
  const minRight = 250
  const minMain = 500
  const dividerWidth = 0 // dividers overlap panel edges, zero layout width

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
  const minLeft = 200
  const minRight = 250
  const minMain = 500
  const dividerWidth = 0 // dividers overlap panel edges, zero layout width

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

/* Gray sidebar on opaque platforms; macOS overrides with the glass tint */
.left-panel {
  background-color: var(--bg-page-alt);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* macOS frosted sidebar: the window's vibrancy shows through the transparent
   app/layout layers; the full-height underlay paints the only glass tint. */
.platform-darwin .app,
.platform-darwin .layout {
  background-color: transparent;
}

.platform-darwin .left-panel {
  background-color: transparent;
}

.sidebar-glass-underlay {
  display: none;
}

/* z-index -1 keeps it behind all in-flow content (opaque panels cover it);
   it shows only through the transparent sidebar column and title bar segment */
.platform-darwin .sidebar-glass-underlay {
  display: block;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--left-panel-width);
  z-index: -1;
  background-color: var(--bg-sidebar-glass);
}

/* Demo mode runs with macOS vibrancy disabled (opaque window for clean
   screenshots), so the faint glass tint would read as white. Paint the
   solid sidebar gray instead — matching the opaque-platform appearance. */
.platform-darwin.demo-mode .sidebar-glass-underlay {
  background-color: var(--bg-page-alt);
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

/* Zero-width grab strip: negative margins make the 10px handle straddle the
   panel boundary without occupying layout space, so the panels sit flush and
   only their 1px hairline borders are visible. Positioned so it stays on top
   of the adjacent panel edges for hit-testing. */
.divider {
  width: 10px;
  margin: 0 -5px;
  position: relative;
  z-index: var(--z-dropdown);
  background-color: transparent;
  cursor: col-resize;
  flex-shrink: 0;
}
</style>
