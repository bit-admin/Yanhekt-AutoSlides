<template>
  <div class="webcapture-tab">
    <!-- Top toolbar: navigation + URL -->
    <div class="toolbar nav-toolbar">
      <button class="btn nav-btn" @click="goBack" :title="$t('webCapture.back')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button class="btn nav-btn" @click="goForward" :title="$t('webCapture.forward')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button class="btn nav-btn" @click="reload" :title="$t('webCapture.reload')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M13 8a5 5 0 11-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <input
        class="text-input url-input"
        :value="pendingUrl"
        @input="(e) => pendingUrl = (e.target as HTMLInputElement).value"
        @keydown.enter="navigate()"
        :placeholder="$t('webCapture.urlPlaceholder')"
        spellcheck="false"
      />
      <button class="btn btn--primary" @click="navigate()" :disabled="!pendingUrl.trim()">{{ $t('webCapture.go') }}</button>
      <div class="preset-dropdown">
        <button class="btn secondary-btn preset-toggle" @click.stop="presetOpen = !presetOpen">
          {{ $t('webCapture.presets') }}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <ul v-if="presetOpen" class="preset-menu">
          <li v-for="p in presets" :key="p.url" @click="onSelectPreset(p)">{{ $t(p.labelKey) }}</li>
        </ul>
      </div>
    </div>

    <!-- Second toolbar: course + selector + capture actions -->
    <div class="toolbar action-toolbar">
      <div class="field-group">
        <label class="field-label">{{ $t('webCapture.name') }}</label>
        <input
          class="text-input"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          :placeholder="pageTitle || $t('webCapture.courseNamePlaceholder')"
        />
      </div>
      <div class="field-group grow" :class="{ faded: regionOverridesSelector }">
        <label class="field-label">{{ $t('webCapture.selector') }}</label>
        <input
          class="text-input"
          :value="userSelector"
          @input="(e) => onUserSelectorInput((e.target as HTMLInputElement).value)"
          :placeholder="regionOverridesSelector ? $t('webCapture.regionOverride') : (detectedVideo?.selector || 'video')"
          spellcheck="false"
        />
      </div>
      <button
        class="btn secondary-btn"
        :class="{ active: pickerActive === 'pick', faded: regionOverridesSelector }"
        @click="pickerActive === 'pick' ? cancelPicker() : pickVideoSelector()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'pick' ? $t('webCapture.cancelPick') : $t('webCapture.pickVideo') }}
      </button>
      <button
        class="btn secondary-btn"
        :class="{ active: pickerActive === 'block' }"
        @click="pickerActive === 'block' ? cancelPicker() : startBlocker()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'block' ? $t('webCapture.cancelBlock') : $t('webCapture.blockElement') }}
      </button>
      <button
        class="btn secondary-btn"
        @click="clearBlocks"
        :disabled="blockedSelectors.length === 0"
      >
        {{ $t('webCapture.clearBlocks', { n: blockedSelectors.length }) }}
      </button>
      <button
        class="btn secondary-btn"
        :class="{ active: regionDrawMode }"
        @click="regionDrawMode ? cancelRegionDraw() : beginRegionDraw()"
        :disabled="captureState === 'running'"
      >
        {{ customRegion ? $t('webCapture.redrawRegion') : $t('webCapture.drawRegion') }}
      </button>
      <button
        v-if="customRegion"
        class="btn secondary-btn"
        @click="clearRegion"
        :disabled="captureState === 'running'"
      >
        {{ $t('webCapture.clearRegion') }}
      </button>
      <button
        v-if="captureState !== 'running'"
        class="btn btn--primary"
        @click="requestStart"
        :disabled="!canStart"
      >
        {{ $t('webCapture.start') }}
      </button>
      <button
        v-else
        class="btn btn--danger"
        @click="stopCapture"
      >
        {{ $t('webCapture.stop') }}
      </button>
    </div>

    <!-- Status strip -->
    <div class="status-bar">
      <span class="status-chip">{{ $t('webCapture.modeLabel') }}: <b>{{ captureMode }}</b></span>
      <span class="status-chip" v-if="detectedVideo">{{ $t('webCapture.detected') }}: {{ detectedVideo.width }}×{{ detectedVideo.height }}</span>
      <span class="status-chip" v-else-if="captureState === 'idle'">{{ $t('webCapture.noVideoDetected') }}</span>
      <span class="status-chip" v-if="customRegion">{{ $t('webCapture.regionLabel') }}: {{ customRegion.width }}×{{ customRegion.height }}</span>
      <span class="status-chip">{{ $t('webCapture.ticks') }}: {{ tickCount }}</span>
      <span class="status-chip">{{ $t('webCapture.saved') }}: {{ savedCount }}</span>
      <span class="status-message">{{ displayStatus }}</span>
    </div>

    <!-- Webview area -->
    <div class="webview-container">
      <webview
        v-if="preloadPath"
        ref="webviewEl"
        :preload="preloadPath"
        src="about:blank"
        partition="persist:webcapture"
        allowpopups
        class="capture-webview"
      ></webview>
      <div v-else class="webview-placeholder">{{ $t('webCapture.initializing') }}</div>
      <RegionOverlay
        v-if="regionDrawMode"
        :hint="$t('webCapture.regionHint')"
        :useRegionLabel="$t('webCapture.useRegion')"
        :cancelLabel="$t('webCapture.cancel')"
        @commit="onRegionCommit"
        @cancel="cancelRegionDraw"
      />
      <div
        v-if="customRegion && !regionDrawMode"
        class="region-indicator"
        :style="{
          left: customRegion.x + 'px',
          top: customRegion.y + 'px',
          width: customRegion.width + 'px',
          height: customRegion.height + 'px',
        }"
      >
        <span class="region-indicator-label">{{ customRegion.width }}×{{ customRegion.height }}</span>
      </div>
    </div>

    <!-- Confirm name modal -->
    <div v-if="captureState === 'confirming'" class="modal-overlay" @click.self="cancelStart">
      <div class="modal">
        <h3>{{ $t('webCapture.confirmTitle') }}</h3>
        <p>{{ $t('webCapture.confirmDesc') }} <code>slides_{{ sanitizedPreview }}</code>.</p>
        <input
          class="text-input modal-input"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          @keydown.enter="confirmAndStart"
          ref="modalInputRef"
        />
        <div class="modal-actions">
          <button class="btn secondary-btn" @click="cancelStart">{{ $t('webCapture.cancel') }}</button>
          <button class="btn btn--primary" @click="confirmAndStart" :disabled="!courseName.trim()">{{ $t('webCapture.start') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('WebCaptureTab');
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWebCapture, type WebCapturePreset } from '@features/webCapture/useWebCapture'
import RegionOverlay from './RegionOverlay.vue'

const { t } = useI18n()

const {
  preloadPath,
  currentUrl,
  pendingUrl,
  pageTitle,
  courseName,
  detectedVideo,
  userSelector,
  customRegion,
  blockedSelectors,
  captureState,
  captureMode,
  tickCount,
  savedCount,
  pickerActive,
  regionDrawMode,
  statusMessage,
  statusParams,
  canStart,
  regionOverridesSelector,
  presets,
  attachWebview,
  navigate,
  navigatePreset,
  goBack,
  goForward,
  reload,
  pickVideoSelector,
  startBlocker,
  cancelPicker,
  clearBlocks,
  setRegion,
  clearRegion,
  beginRegionDraw,
  cancelRegionDraw,
  requestStart,
  cancelStart,
  confirmAndStart,
  stopCapture,
  onCourseNameInput,
  onUserSelectorInput,
} = useWebCapture()

const webviewEl = ref<HTMLElement | null>(null)
const modalInputRef = ref<HTMLInputElement | null>(null)
const presetOpen = ref(false)

const onSelectPreset = (preset: WebCapturePreset) => {
  presetOpen.value = false
  void navigatePreset(preset)
}

const sanitizedPreview = computed(() => {
  const name = courseName.value.trim() || pageTitle.value.trim() || 'Untitled'
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').replace(/_{2,}/g, '_').trim()
})

const displayStatus = computed(() => {
  const key = statusMessage.value
  if (!key) return ''
  if (key.startsWith('webCapture.')) {
    return t(key, statusParams.value)
  }
  return key
})

const onRegionCommit = (rect: { x: number; y: number; width: number; height: number }) => {
  setRegion(rect)
}

// Close preset dropdown on outside click
const closePreset = () => { presetOpen.value = false }
onMounted(() => document.addEventListener('click', closePreset))
onBeforeUnmount(() => document.removeEventListener('click', closePreset))

// Focus modal input when confirming
const focusModal = async () => {
  await nextTick()
  modalInputRef.value?.focus()
  modalInputRef.value?.select()
}

// Attach once the <webview> appears in the DOM (it is v-if'd on preloadPath).
watch(preloadPath, async (val) => {
  if (!val) return
  for (let i = 0; i < 30; i++) {
    await nextTick()
    const el = webviewEl.value as unknown as Electron.WebviewTag | null
    if (el) {
      attachWebview(el as never)
      return
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  log.warn('WebCaptureTab: webview element never appeared')
}, { immediate: true })

watch(captureState, (val) => {
  if (val === 'confirming') void focusModal()
})
</script>

<style scoped>
.webcapture-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: var(--bg-subtle);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.action-toolbar {
  background-color: var(--bg-page);
}

/* Square 28×28 icon button for back/forward/reload */
.nav-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

.url-input {
  flex: 1;
  min-width: 200px;
}

.preset-dropdown {
  position: relative;
}

.preset-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preset-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 140px;
  padding: 4px 0;
  list-style: none;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-input);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-md);
  z-index: var(--z-sticky);
}

.preset-menu li {
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.preset-menu li:hover {
  background-color: var(--focus-ring);
  color: var(--accent);
}

.field-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.field-group.grow { flex: 1; min-width: 180px; }

.field-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.text-input {
  padding: 5px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  min-width: 120px;
}
.field-group.grow .text-input { width: 100%; min-width: 0; }

.text-input:focus { outline: none; border-color: var(--accent); }

.faded { opacity: 0.4; pointer-events: auto; }
.secondary-btn.active {
  background-color: var(--focus-ring);
  border-color: var(--accent);
  color: var(--accent);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
  background-color: var(--bg-subtle);
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.status-chip {
  display: inline-flex;
  gap: 4px;
  padding: 2px 6px;
  background-color: var(--bg-hover);
  border: 1px solid var(--border-input);
  border-radius: 3px;
}

.status-message {
  flex: 1;
  color: var(--text-secondary);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.webview-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  background-color: var(--bg-page-alt);
}

.capture-webview {
  width: 100%;
  height: 100%;
  border: none;
  display: flex;
}

.webview-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
}

.region-indicator {
  position: absolute;
  border: 2px dashed var(--accent);
  pointer-events: none;
  z-index: var(--z-dropdown);
}

.region-indicator-label {
  position: absolute;
  top: -18px;
  left: 0;
  font-size: 10px;
  color: var(--text-on-accent);
  background-color: rgba(0, 122, 204, 0.8);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-overlay);
}

.modal {
  width: 420px;
  background-color: var(--bg-modal);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 20px var(--shadow-lg);
}

.modal h3 {
  margin: 0 0 8px 0;
  font-size: 15px;
}

.modal p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 12px 0;
}

.modal code {
  padding: 1px 4px;
  background-color: var(--bg-hover);
  border-radius: 3px;
  font-size: 11px;
}

.modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
}

.modal-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

</style>
