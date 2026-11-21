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
        @input="(e) => { pendingUrl = (e.target as HTMLInputElement).value; urlDraftDirty = true }"
        @keydown.enter="navigate()"
        :aria-label="$t('webCapture.urlLabel')"
        :placeholder="$t('webCapture.urlPlaceholder')"
        spellcheck="false"
      />
      <button class="btn" @click="navigate()" :disabled="!pendingUrl.trim()">{{ $t('webCapture.go') }}</button>
      <div class="preset-dropdown">
        <button ref="presetToggle" class="btn secondary-btn preset-toggle" :aria-expanded="presetOpen" @click.stop="presetOpen = !presetOpen" @keydown.esc="closePresetToToggle">
          {{ $t('webCapture.presets') }}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <ul v-if="presetOpen" class="preset-menu" @keydown.esc.stop="closePresetToToggle">
          <li v-for="p in presets" :key="p.url">
            <button type="button" class="preset-option" @click="onSelectPreset(p)">{{ $t(p.labelKey) }}</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Second toolbar: course + selector + capture actions -->
    <div class="toolbar action-toolbar">
      <div class="field-group">
        <label class="field-label" for="webcapture-name">{{ $t('webCapture.name') }}</label>
        <input
          id="webcapture-name"
          class="text-input"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          :placeholder="pageTitle || $t('webCapture.courseNamePlaceholder')"
        />
      </div>
      <div class="field-group grow" :class="{ faded: regionOverridesSelector }">
        <label class="field-label" for="webcapture-selector">{{ $t('webCapture.selector') }}</label>
        <input
          id="webcapture-selector"
          class="text-input"
          :disabled="regionOverridesSelector"
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
        :disabled="webCaptureBusy"
      >
        {{ pickerActive === 'pick' ? $t('webCapture.cancelPick') : $t('webCapture.pickVideo') }}
      </button>
      <button
        class="btn secondary-btn"
        :class="{ active: pickerActive === 'block' }"
        @click="pickerActive === 'block' ? cancelPicker() : startBlocker()"
        :disabled="webCaptureBusy"
      >
        {{ pickerActive === 'block' ? $t('webCapture.cancelBlock') : $t('webCapture.blockElement') }}
      </button>
      <button
        class="btn secondary-btn"
        @click="clearBlocks"
        :disabled="blockedSelectors.length === 0"
      >
        {{ $t('webCapture.clearBlocks') }}
      </button>
      <button
        class="btn secondary-btn"
        :class="{ active: regionDrawMode }"
        @click="regionDrawMode ? cancelRegionDraw() : beginRegionDraw()"
        :disabled="webCaptureBusy"
      >
        {{ customRegion ? $t('webCapture.redrawRegion') : $t('webCapture.drawRegion') }}
      </button>
      <button
        v-if="customRegion"
        class="btn secondary-btn"
        @click="clearRegion"
        :disabled="webCaptureBusy"
      >
        {{ $t('webCapture.clearRegion') }}
      </button>
      <button
        v-if="captureState !== 'running' && captureState !== 'stopping'"
        class="btn btn--primary"
        @click="requestStart"
        :disabled="!canStart"
      >
        {{ $t('webCapture.start') }}
      </button>
      <button
        v-else
        class="btn btn--danger-outline"
        :disabled="captureState !== 'running'"
        @click="stopCapture"
      >
        {{ $t('webCapture.stop') }}
      </button>
    </div>

    <!-- Status strip -->
    <div class="status-bar">
      <span class="status-chip">{{ $t('webCapture.modeLabel') }}: <b>{{ $t(captureMode === 'inject' ? 'webCapture.modeVideo' : 'webCapture.modePage') }}</b></span>
      <span class="status-chip" v-if="detectedVideo">{{ $t('webCapture.detected') }}: {{ detectedVideo.width }}×{{ detectedVideo.height }}</span>
      <span class="status-chip" v-else-if="captureState === 'idle'">{{ $t('webCapture.noVideoDetected') }}</span>
      <span class="status-chip" v-if="customRegion">{{ $t('webCapture.regionLabel') }}: {{ customRegion.width }}×{{ customRegion.height }}</span>
      <span class="status-chip">{{ $t('webCapture.ticks') }}: {{ tickCount }}</span>
      <span class="status-chip">{{ $t('webCapture.saved') }}: {{ savedCount }}</span>
      <span class="status-message" role="status">{{ displayStatus }}</span>
    </div>

    <!-- Embedded page -->
    <div class="guest-container">
      <GuestSurface kind="webCapture" url="about:blank" :occluded="guestOccluded" />
      <RegionOverlay
        v-if="regionDrawMode"
        :hint="$t('webCapture.regionHint')"
        :keyHint="$t('webCapture.regionKeyHint')"
        :useRegionLabel="$t('webCapture.useRegion')"
        :cancelLabel="$t('webCapture.cancel')"
        @commit="onRegionCommit"
        @cancel="cancelRegionDraw"
      />
    </div>

    <!-- Confirm name modal -->
    <div v-if="captureState === 'confirming'" class="modal-overlay" @click.self="cancelStart">
      <div v-dialog="{ close: cancelStart }" class="dialog-box webcapture-confirm-box" aria-labelledby="webcapture-confirm-title" @click.stop>
        <h3 id="webcapture-confirm-title" class="dialog-title">{{ $t('webCapture.confirmTitle') }}</h3>
        <p class="dialog-help">{{ $t('webCapture.confirmDesc') }} <code>slides_{{ sanitizedPreview }}</code>.</p>
        <input
          class="text-input modal-input"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          @keydown.enter="courseName.trim() && confirmAndStart()"
          :aria-labelledby="'webcapture-confirm-title'"
          ref="modalInputRef"
        />
        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" @click="cancelStart">{{ $t('webCapture.cancel') }}</button>
          <button type="button" class="btn btn--primary dialog-btn" @click="confirmAndStart" :disabled="!courseName.trim()">{{ $t('webCapture.start') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { vDialog } from '@shared/ui/dialog'
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWebCapture, webCaptureBusy, type WebCapturePreset } from '@features/webCapture/useWebCapture'
import { sanitizeFileName } from '@common/sanitizeFileName'
import RegionOverlay from './RegionOverlay.vue'
import GuestSurface from '@renderer/components/shell/GuestSurface.vue'

const { t } = useI18n()

const {
  pendingUrl,
  urlDraftDirty,
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
  guest,
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

const modalInputRef = ref<HTMLInputElement | null>(null)
const presetOpen = ref(false)

const presetToggle = ref<HTMLButtonElement | null>(null)
const closePresetToToggle = () => {
  if (!presetOpen.value) return
  presetOpen.value = false
  presetToggle.value?.focus()
}

const onSelectPreset = (preset: WebCapturePreset) => {
  presetOpen.value = false
  void navigatePreset(preset)
}

// Must stay identical to the folder useWebCapture actually creates — hence the
// shared sanitizer rather than an inlined copy of its rules.
const sanitizedPreview = computed(() => {
  const name = courseName.value.trim() || pageTitle.value.trim() || 'Untitled'
  return sanitizeFileName(name)
})

const displayStatus = computed(() => {
  const key = statusMessage.value
  if (!key) return ''
  if (key.startsWith('webCapture.')) {
    const params = statusParams.value
    return t(key, typeof params.mode === 'string' ? { ...params, mode: t(params.mode) } : params)
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

// Native views paint above the DOM, so UI over the page needs it frozen.
const guestOccluded = computed(() =>
  presetOpen.value || regionDrawMode.value || captureState.value === 'confirming'
)

// The region outline is native too, and stays out of captured frames.
watch([customRegion, regionDrawMode], ([region, drawing]) => {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--control-accent').trim()
  void guest.setOutline(region && !drawing ? { ...region } : null, color || '#2a78d6')
}, { flush: 'post' })

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

.preset-option {
  display: block;
  width: 100%;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.preset-option:hover, .preset-option:focus-visible {
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

.guest-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  background-color: var(--bg-page-alt);
}

.modal-overlay {
  position: absolute;
  background-color: var(--overlay-scrim);
}

.webcapture-confirm-box {
  width: min(420px, calc(100% - 32px));
}

.webcapture-confirm-box code {
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

</style>
