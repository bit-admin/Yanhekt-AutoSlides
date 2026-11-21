<template>
  <!-- --left-panel-width lets the title bar split its background at the
       sidebar boundary (transparent glass left, opaque right) on macOS;
       --right-panel-width pins the title bar's view switcher to the right
       panel's left edge so it left-aligns over that panel. -->
  <div class="app" :style="{ '--left-panel-width': renderedLeft + 'px', '--right-panel-width': renderedRight + 'px' }">
    <!-- macOS only (display gated in CSS): one continuous glass tint behind
         both the title bar's sidebar segment and the left panel, so the two
         regions cannot mismatch. -->
    <div class="sidebar-glass-underlay"></div>
    <!-- Custom Title Bar -->
    <TitleBar />

    <div class="layout">
      <div class="left-panel" :class="{ collapsed: layoutStore.leftCollapsed }" :inert="layoutStore.leftCollapsed" :style="{ width: renderedLeft + 'px' }">
        <LeftPanel />
      </div>
      <!-- Divider hidden while the panel is collapsed so a 0-width panel can't
           be drag-resized. -->
      <div v-if="!layoutStore.leftCollapsed" class="divider left-divider" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="$t('titlebar.resizeLeftPanel')" :aria-valuenow="renderedLeft" aria-valuemin="200" @keydown="nudgePanel('left', $event)" @mousedown="startResize('left', $event)"></div>

      <!-- Browser Login View (replaces MainContent and RightPanel) -->
      <div v-if="isBrowserLoginActive" class="browser-login-container" :style="{ width: (renderedMain + renderedRight) + 'px' }">
        <BrowserLoginView
          :key="browserLoginTarget"
          :target="browserLoginTarget"
          @close="onBrowserLoginClose"
          @token-received="handleBrowserToken"
          @yanhe2-signed-in="closeBrowserLogin"
        />
      </div>

      <!-- Browser sign-in temporarily covers the shell without destroying open
           tools or playback tabs. -->
      <div v-show="!isBrowserLoginActive" class="main-content" :style="{ width: renderedMain + 'px' }">
        <MainContent @switch-to-download="handleSwitchToDownload" @switch-to-task="handleSwitchToTask" />
      </div>
      <div v-if="!isBrowserLoginActive && !rightHidden" class="divider right-divider" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="$t('titlebar.resizeRightPanel')" :aria-valuenow="renderedRight" aria-valuemin="250" @keydown="nudgePanel('right', $event)" @mousedown="startResize('right', $event)"></div>

      <div v-show="!isBrowserLoginActive" class="right-panel" :class="{ collapsed: rightHidden }" :inert="rightHidden" :style="{ width: renderedRight + 'px' }">
        <RightPanel ref="rightPanelRef" />
      </div>
    </div>

    <OnboardingModal
      v-if="showOnboarding"
      v-show="!isBrowserLoginActive"
      :kind="onboardingKind"
      :steps="onboardingSteps"
      @finish="completeOnboarding"
    />
  </div>
</template>

<script setup lang="ts">
import { fitPanels, MAX_LEFT_PANEL, MIN_LEFT_PANEL, MIN_MAIN_PANE, MIN_RIGHT_PANEL } from '@shared/ui/panelLayout'
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import TitleBar from '@renderer/components/titlebar/TitleBar.vue'
import LeftPanel from '@renderer/components/settings/LeftPanel.vue'
import MainContent from '@renderer/components/MainContent.vue'
import RightPanel from '@renderer/components/download/RightPanel.vue'
import BrowserLoginView from '@renderer/components/settings/BrowserLoginView.vue'
import OnboardingModal from '@renderer/components/settings/OnboardingModal.vue'
import { useAuth, type SmsChallengeState } from '@features/platform/useAuth'
import { useSettings } from '@features/settings/useSettings'
import { useAdvancedSettings } from '@features/settings/useAdvancedSettings'
import { useCacheManagement } from '@features/platform/useCacheManagement'
import { reloadYanhe2JwtField } from '@features/platform/yanhe2AccountUi'
import { useAISettings } from '@features/ai/useAISettings'
import { usePHashExclusion } from '@features/ai/usePHashExclusion'
import { settingsContextKey } from '@features/settings/settingsContext'
import { navigationStore, type NavTarget } from '@features/course/navigationStore'
import { configStore } from '@shared/services/configStore'
import { isDemoMode, getAppVersion } from '@shared/services/runtimeEnv'
import { resolveOnboarding, type OnboardingKind, type OnboardingStep } from '@common/onboarding'
import { layoutStore } from '@shared/services/layoutStore'
import { TaskQueue } from '@shared/services/taskQueueService'
import { DownloadService } from '@shared/services/downloadService'
import { installCliControlHandler } from '@features/download/cliControlHandler'
import { installDeepLinkHandler } from '@features/course/deepLinkHandler'
import { PostProcessingService } from '@shared/services/postProcessingService'
import { SlideVideoQueue } from '@shared/services/slideVideoQueue'
import { webCaptureBusy } from '@features/webCapture/useWebCapture'
import { yuketangExportBusy } from '@features/export/useYuketang'
import { countOutputFolderWork } from '@features/download/outputFolderWork'
import { hasOutputFolderWork } from '@common/outputFolderWork'
import { slideExtractionManager } from '@shared/processing/manager'

// Whether any long-running work is active. Drives the main-process warning shown
// when the user tries to close the window or quit while work is in flight. It
// starts from the same inventory that guards the output folder.
// Extraction pipelines are not reactive, so their count is sampled.
const runningExtractions = ref(0)
const sampleExtractions = (): void => {
  runningExtractions.value = slideExtractionManager.getAll().filter((pipeline) => pipeline.isActive).length
}
sampleExtractions()
const extractionSampler = window.setInterval(sampleExtractions, 1000)
onBeforeUnmount(() => window.clearInterval(extractionSampler))

const isBusy = computed(() => {
  // A task that is only waiting in a stopped queue does not warn on quit.
  const work = { ...countOutputFolderWork(), extractions: runningExtractions.value, tasks: TaskQueue.inProgressCount }
  return hasOutputFolderWork(work) ||
    TaskQueue.isProcessing ||
    PostProcessingService.isProcessing ||
    webCaptureBusy.value || yuketangExportBusy.value
})

watch(isBusy, (busy) => {
  // Demo mode (screenshot automation) seeds finished-but-busy-looking queue items;
  // never report busy there, or the close guard's modal dialog would hang the
  // Playwright run that drives app shutdown.
  window.electronAPI.window.setBusyState(isDemoMode() ? false : busy)
}, { immediate: true })

const { t } = useI18n()

// Settings composables are constructed here (the common ancestor of LeftPanel and
// MainContent) and provided as one bundle, so both the user-bar gear button (in
// LeftPanel) and the full-width Settings page (in MainContent) inject the same
// state. See features/settings/settingsContext.ts for the contract.
const auth = useAuth()

const settings = useSettings()

const cacheManagement = useCacheManagement()

const pHashExclusion = usePHashExclusion()

const aiSettings = useAISettings({
  tokenManager: auth.tokenManager
})

// Built-in model info is fetched with the login token, so refetch whenever the
// active identity changes. Auth state is shared, but sign-in happens through
// several useAuth() instances (left-panel and onboarding SignInModal, SMS code,
// browser login, account switch, pasted token) — watching the shared refs
// covers every path, where a per-instance success callback missed most of them.
// Sign-out lands here too and flips the panel back to "log in to view".
watch([auth.isLoggedIn, auth.userId], () => {
  aiSettings.refreshBuiltinModel()
})

const advancedSettings = useAdvancedSettings(
  {
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    downloadMaxWorkers: settings.downloadMaxWorkers,
    downloadNumRetries: settings.downloadNumRetries,
    videoRetryCount: settings.videoRetryCount,
    videoTokenRefreshSeconds: settings.videoTokenRefreshSeconds,
    previewFromVideo: settings.previewFromVideo,
    previewSeekSeconds: settings.previewSeekSeconds,
    themeMode: settings.themeMode,
    languageMode: settings.languageMode,
    preventSystemSleep: settings.preventSystemSleep,
    connectionMode: settings.connectionMode,
    muteMode: settings.muteMode,
    taskSpeed: settings.taskSpeed,
    parallelTasks: settings.parallelTasks,
    maxManualTabs: settings.maxManualTabs,
    showMorePlaybackSpeed: settings.showMorePlaybackSpeed,
    preferMicAudioByDefault: settings.preferMicAudioByDefault,
    checkMicAudioBeforeOffering: settings.checkMicAudioBeforeOffering,
    yanhe2CaptionMode: settings.yanhe2CaptionMode,
    yanhe2CaptionOffsetSeconds: settings.yanhe2CaptionOffsetSeconds,
    resumeFromServerProgress: settings.resumeFromServerProgress,
    resumeFromServerProgressLectures: settings.resumeFromServerProgressLectures,
    developerMode: settings.developerMode,
    logYanhektCatalog: settings.logYanhektCatalog,
    rememberPassword: settings.rememberPassword,
    autoSignIn: settings.autoSignIn,
    currentTermSearchSource: settings.currentTermSearchSource,
    earlierTermSearchSource: settings.earlierTermSearchSource,
    courseIndexAutoUpdate: settings.courseIndexAutoUpdate,
    yanhe2SignInWithMain: settings.yanhe2SignInWithMain,
    closeToTray: settings.closeToTray,
    enableAIFiltering: settings.enableAIFiltering,
    tempEnableAIFiltering: settings.tempEnableAIFiltering
  },
  // onOpenModal callback — runs each time the Settings page is entered.
  async () => {
    auth.loadManualToken()
    auth.tokenVerificationStatus.value = null
    auth.showToken.value = false
    void auth.loadAccountPassword()
    reloadYanhe2JwtField()
    cacheManagement.refreshCacheStats()
    cacheManagement.resetOperationStatus()
    await pHashExclusion.loadPHashExclusionList()
    await aiSettings.loadAISettings()
    aiSettings.resetTempValues()
    settings.resetTempEnableAIFiltering()
  },
  // onSaveSettings callback
  async () => {
    await aiSettings.saveAISettings()
    await settings.saveEnableAIFiltering()
  },
  t
)

provide(settingsContextKey, {
  auth,
  settings,
  advanced: advancedSettings,
  cache: cacheManagement,
  ai: aiSettings,
  phash: pHashExclusion,
})

const { isBrowserLoginActive, browserLoginTarget, closeBrowserLogin, handleBrowserToken, isLoggedIn, smsChallenge } = auth
const { isFullWidthPage } = navigationStore

// Onboarding / What's New. configStore + app version are loaded before mount.
// v4 upgrades have onboardingCompleted but no lastOnboardingVersion — the
// resolver treats that as What's New covering every catalog step. Every run
// (first-run or What's New) opens on the legal notice.
// Demo mode (screenshots) always skips it unless the demo hook forces it.
const resolveCurrentOnboarding = () =>
  resolveOnboarding({
    onboardingCompleted: configStore.onboardingCompleted,
    lastOnboardingVersion: configStore.lastOnboardingVersion,
    appVersion: getAppVersion(),
  })

const firstRunOnboarding = () =>
  resolveOnboarding({
    onboardingCompleted: false,
    lastOnboardingVersion: null,
    appVersion: getAppVersion(),
  })

const initialOnboarding = isDemoMode()
  ? { kind: 'none' as const, steps: [] as OnboardingStep[] }
  : resolveCurrentOnboarding()

const onboardingKind = ref<OnboardingKind>(
  initialOnboarding.kind === 'none' ? 'first-run' : initialOnboarding.kind
)
const onboardingSteps = ref<OnboardingStep[]>(initialOnboarding.steps)
const showOnboarding = ref(initialOnboarding.kind !== 'none')

const completeOnboarding = () => {
  showOnboarding.value = false
  window.electronAPI.config.setOnboardingCompleted(true)
}

const onBrowserLoginClose = () => {
  // Close without a token: skip remaining onboarding (same as the sign-in ×). A successful browser
  // login goes through handleBrowserToken (not @close) and returns to the signed-in step.
  if (showOnboarding.value && !isLoggedIn.value) completeOnboarding()
  closeBrowserLogin()
}

// Demo-only hooks for the screenshot script. Never exposed in prod.
// - __demoSetOnboarding: render the onboarding wizard (otherwise first-run-only).
//   Optional kind 'whats-new' uses the versioned What's New hero copy.
// - __demoNavigate: drive the left-panel navigator (incl. Workspace pages) so the
//   script doesn't depend on localized nav-item text.
// - __demoSetLoggedIn / __demoSetSmsChallenge: preview the onboarding sign-in
//   step as unsigned / SMS / signed-in without hitting CAS.
if (isDemoMode()) {
  const w = window as unknown as {
    __demoSetOnboarding?: (v: boolean, kind?: 'first-run' | 'whats-new') => void
    __demoNavigate?: (target: string) => void
    __demoSetLoggedIn?: (v: boolean) => void
    __demoSetSmsChallenge?: (challenge: SmsChallengeState | null) => void
  }
  w.__demoSetOnboarding = (v, kind = 'first-run') => {
    if (v) {
      if (kind === 'whats-new') {
        const forced = resolveOnboarding({
          onboardingCompleted: true,
          lastOnboardingVersion: '4.4.1',
          appVersion: getAppVersion(),
        })
        onboardingKind.value = forced.kind === 'none' ? 'first-run' : forced.kind
        onboardingSteps.value = forced.steps
      } else {
        const forced = firstRunOnboarding()
        onboardingKind.value = 'first-run'
        onboardingSteps.value = forced.steps
      }
    }
    showOnboarding.value = v
  }
  w.__demoNavigate = (target) => navigationStore.navigate(target as NavTarget)
  w.__demoSetLoggedIn = (v) => { isLoggedIn.value = v }
  w.__demoSetSmsChallenge = (challenge) => { smsChallenge.value = challenge }
}

// Baselines match the panel widths the old proportional layout produced at the
// previous 1400-wide default window (240/320 scaled by 1400/1320 ≈ 254/339,
// rounded to 255/340). updateSizes now holds these fixed and lets the main
// content absorb any window-width slack (845 fills the 1440-wide default).
const leftWidth = ref(255)
const rightWidth = ref(340)
const mainWidth = ref(845)
// What the user last chose. A narrow window borrows from these and gives it back.
let chosenLeft = leftWidth.value
let chosenRight = rightWidth.value

// leftWidth/rightWidth/mainWidth stay the expanded baseline that the resize
// logic operates on (preserving the invariant innerWidth === left+main+right).
// Collapsing is purely presentational: a collapsed panel renders at 0 and its
// width is handed to the main content, so toggling never disturbs the baseline.
// A Workspace page hides the right panel just like collapsing it, but without
// touching the user's rightCollapsed preference — so toggling back to a Yanhekt
// page (or a playback tab) restores the panel exactly as the user left it.
const rightHidden = computed(() => isFullWidthPage.value || layoutStore.rightCollapsed)
const renderedLeft = computed(() => (layoutStore.leftCollapsed ? 0 : leftWidth.value))
const renderedRight = computed(() => (rightHidden.value ? 0 : rightWidth.value))
const renderedMain = computed(() =>
  mainWidth.value +
  (layoutStore.leftCollapsed ? leftWidth.value : 0) +
  (rightHidden.value ? rightWidth.value : 0)
)

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

  // Lock the resize cursor globally: the divider unmounts the moment a drag
  // snaps the panel collapsed, so without this the cursor would flip back to
  // default mid-drag.
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  event.preventDefault()
}

// Arrow keys do what a short drag does, within the same limits (no collapse).
const PANEL_KEY_STEP = 16
const nudgePanel = (type: 'left' | 'right', event: KeyboardEvent) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? PANEL_KEY_STEP : -PANEL_KEY_STEP
  if (type === 'left') choosePanelWidth('left', leftWidth.value + delta, window.innerWidth)
  else choosePanelWidth('right', rightWidth.value - delta, window.innerWidth)
}

/** Record a width the user picked, within what leaves the center pane its minimum. */
const choosePanelWidth = (type: 'left' | 'right', raw: number, total: number) => {
  if (type === 'left') {
    chosenLeft = Math.max(MIN_LEFT_PANEL, Math.min(raw, MAX_LEFT_PANEL, total - renderedRight.value - MIN_MAIN_PANE))
  } else {
    chosenRight = Math.max(MIN_RIGHT_PANEL, Math.min(raw, total - renderedLeft.value - MIN_MAIN_PANE))
  }
  updateSizes()
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing) return

  const deltaX = event.clientX - startX
  // Drag a divider past its min by this margin to snap the panel collapsed
  // (Finder-style). Dragging back out past the margin re-expands it — the
  // mousemove listener lives on document, so the drag survives the divider
  // unmounting while collapsed.
  const collapseGap = 60

  if (resizeType === 'left') {
    const rawLeftWidth = startLeftWidth + deltaX
    if (rawLeftWidth < MIN_LEFT_PANEL - collapseGap) {
      // Keep the baseline at min so re-expanding (drag-out or toggle) restores
      // a sensible width rather than a sliver.
      layoutStore.leftCollapsed = true
      chosenLeft = MIN_LEFT_PANEL
      updateSizes()
      return
    }
    layoutStore.leftCollapsed = false
    choosePanelWidth('left', rawLeftWidth, containerWidth)
  } else if (resizeType === 'right') {
    const rawRightWidth = startRightWidth - deltaX
    if (rawRightWidth < MIN_RIGHT_PANEL - collapseGap) {
      layoutStore.rightCollapsed = true
      chosenRight = MIN_RIGHT_PANEL
      updateSizes()
      return
    }
    layoutStore.rightCollapsed = false
    choosePanelWidth('right', rawRightWidth, containerWidth)
  }
}

const stopResize = () => {
  isResizing = false
  resizeType = ''
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const updateSizes = () => {
  const fit = fitPanels({
    total: window.innerWidth,
    left: chosenLeft,
    right: chosenRight,
    leftShown: !layoutStore.leftCollapsed,
    rightShown: !rightHidden.value,
  })
  leftWidth.value = fit.left
  rightWidth.value = fit.right
  mainWidth.value = fit.main
}

// Showing a panel in a narrow window has to make room for it too.
watch([() => layoutStore.leftCollapsed, rightHidden], updateSizes)

onMounted(() => {
  // Use nextTick to ensure the DOM has been rendered.
  nextTick(() => {
    updateSizes()
  })

  window.addEventListener('resize', updateSizes)

  // `autoslides` commands: answer main once the app (and its queue) is up.
  const uninstallCliControl = installCliControlHandler()
  // `autoslides://` links: main holds one until this says it is ready.
  const uninstallDeepLink = installDeepLinkHandler()

  onUnmounted(() => {
    window.removeEventListener('resize', updateSizes)
    uninstallCliControl()
    uninstallDeepLink()
  })
})
</script>

<style scoped>
.app {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.layout {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  background-color: var(--bg-page);
  overflow: hidden;
}

/* Gray sidebar on opaque platforms; macOS overrides with the glass tint */
.left-panel {
  background-color: var(--bg-page-alt);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* Only clip while collapsed (width 0) so the still-mounted contents don't bleed
   across the boundary. When expanded we must NOT clip, or panel popovers/flyouts
   (e.g. the user menu) that overflow the panel edge get cut off. */
.left-panel.collapsed,
.right-panel.collapsed {
  overflow: hidden;
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

/* Both side panels sit a step below the content column: warm paper rails
   around a near-white page, the way Claude's desktop chrome reads. */
.right-panel {
  background-color: var(--bg-page-alt);
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
