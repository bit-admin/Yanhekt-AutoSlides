<template>
  <div class="flex flex-col h-full bg-surface text-text">
    <!-- Top toolbar: navigation + URL -->
    <div class="toolbar nav-toolbar flex items-center gap-2 py-1.5 px-3 bg-subtle border-b border-border flex-wrap">
      <button class="flex items-center justify-center w-7 h-7 border border-border-input rounded bg-surface cursor-pointer text-text-secondary hover:bg-page" @click="goBack" :title="$t('webCapture.back')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button class="flex items-center justify-center w-7 h-7 border border-border-input rounded bg-surface cursor-pointer text-text-secondary hover:bg-page" @click="goForward" :title="$t('webCapture.forward')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button class="flex items-center justify-center w-7 h-7 border border-border-input rounded bg-surface cursor-pointer text-text-secondary hover:bg-page" @click="reload" :title="$t('webCapture.reload')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M13 8a5 5 0 11-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <input
        class="flex-1 min-w-[200px] py-[5px] px-2 border border-border-input rounded text-xs bg-surface focus:outline-none focus:border-accent"
        :value="pendingUrl"
        @input="(e) => pendingUrl = (e.target as HTMLInputElement).value"
        @keydown.enter="navigate()"
        :placeholder="$t('webCapture.urlPlaceholder')"
        spellcheck="false"
      />
      <button class="py-[5px] px-3.5 rounded bg-accent text-white text-xs font-medium cursor-pointer hover:not-disabled:bg-accent-strong disabled:bg-[var(--border-strong)] disabled:cursor-not-allowed" @click="navigate()" :disabled="!pendingUrl.trim()">{{ $t('webCapture.go') }}</button>
      <div class="relative">
        <button class="flex items-center gap-1 py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed" @click.stop="presetOpen = !presetOpen">
          {{ $t('webCapture.presets') }}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <ul v-if="presetOpen" class="absolute top-full right-0 mt-1 min-w-[140px] py-1 list-none bg-surface border border-border-input rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.12)] z-20">
          <li v-for="p in presets" :key="p.url" @click="onSelectPreset(p)" class="py-1 px-3 text-xs cursor-pointer whitespace-nowrap hover:bg-accent/8 hover:text-accent">{{ $t(p.labelKey) }}</li>
        </ul>
      </div>
    </div>

    <!-- Second toolbar: course + selector + capture actions -->
    <div class="toolbar action-toolbar flex items-center gap-2 py-1.5 px-3 bg-page border-b border-border flex-wrap">
      <div class="flex items-center gap-1.5">
        <label class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('webCapture.name') }}</label>
        <input
          class="text-input py-[5px] px-2 border border-border-input rounded text-xs bg-surface min-w-[120px] focus:outline-none focus:border-accent"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          :placeholder="pageTitle || $t('webCapture.courseNamePlaceholder')"
        />
      </div>
      <div class="flex items-center gap-1.5 flex-1 min-w-[180px] opacity-40" :class="{ 'opacity-40': regionOverridesSelector }">
        <label class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('webCapture.selector') }}</label>
        <input
          class="text-input py-[5px] px-2 border border-border-input rounded text-xs bg-surface min-w-[120px] w-full min-w-0 focus:outline-none focus:border-accent"
          :value="userSelector"
          @input="(e) => onUserSelectorInput((e.target as HTMLInputElement).value)"
          :placeholder="regionOverridesSelector ? $t('webCapture.regionOverride') : (detectedVideo?.selector || 'video')"
          spellcheck="false"
        />
      </div>
      <button
        class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed [&.active]:bg-accent/12 [&.active]:border-accent [&.active]:text-accent"
        :class="{ active: pickerActive === 'pick', 'opacity-40': regionOverridesSelector }"
        @click="pickerActive === 'pick' ? cancelPicker() : pickVideoSelector()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'pick' ? $t('webCapture.cancelPick') : $t('webCapture.pickVideo') }}
      </button>
      <button
        class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed [&.active]:bg-accent/12 [&.active]:border-accent [&.active]:text-accent"
        :class="{ active: pickerActive === 'block' }"
        @click="pickerActive === 'block' ? cancelPicker() : startBlocker()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'block' ? $t('webCapture.cancelBlock') : $t('webCapture.blockElement') }}
      </button>
      <button
        class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed"
        @click="clearBlocks"
        :disabled="blockedSelectors.length === 0"
      >
        {{ $t('webCapture.clearBlocks', { n: blockedSelectors.length }) }}
      </button>
      <button
        class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed [&.active]:bg-accent/12 [&.active]:border-accent [&.active]:text-accent"
        :class="{ active: regionDrawMode }"
        @click="regionDrawMode ? cancelRegionDraw() : beginRegionDraw()"
        :disabled="captureState === 'running'"
      >
        {{ customRegion ? $t('webCapture.redrawRegion') : $t('webCapture.drawRegion') }}
      </button>
      <button
        v-if="customRegion"
        class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed"
        @click="clearRegion"
        :disabled="captureState === 'running'"
      >
        {{ $t('webCapture.clearRegion') }}
      </button>
      <button
        v-if="captureState !== 'running'"
        class="py-[5px] px-3.5 rounded bg-accent text-white text-xs font-medium cursor-pointer hover:not-disabled:bg-accent-strong disabled:bg-[var(--border-strong)] disabled:cursor-not-allowed"
        @click="requestStart"
        :disabled="!canStart"
      >
        {{ $t('webCapture.start') }}
      </button>
      <button
        v-else
        class="py-[5px] px-3.5 rounded bg-[#d9534f] text-white text-xs font-medium cursor-pointer hover:bg-[#b52b27]"
        @click="stopCapture"
      >
        {{ $t('webCapture.stop') }}
      </button>
    </div>

    <!-- Status strip -->
    <div class="flex items-center gap-2.5 py-[5px] px-3 bg-page border-b border-border text-[11px] text-text-secondary flex-wrap">
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]">{{ $t('webCapture.modeLabel') }}: <b>{{ captureMode }}</b></span>
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]" v-if="detectedVideo">{{ $t('webCapture.detected') }}: {{ detectedVideo.width }}×{{ detectedVideo.height }}</span>
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]" v-else-if="captureState === 'idle'">{{ $t('webCapture.noVideoDetected') }}</span>
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]" v-if="customRegion">{{ $t('webCapture.regionLabel') }}: {{ customRegion.width }}×{{ customRegion.height }}</span>
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]">{{ $t('webCapture.ticks') }}: {{ tickCount }}</span>
      <span class="inline-flex gap-1 py-0.5 px-1.5 bg-surface border border-border-input rounded-[3px]">{{ $t('webCapture.saved') }}: {{ savedCount }}</span>
      <span class="flex-1 text-text-secondary italic overflow-hidden text-ellipsis whitespace-nowrap">{{ displayStatus }}</span>
    </div>

    <!-- Webview area -->
    <div class="relative flex-1 overflow-hidden bg-[var(--text-primary)]">
      <webview
        v-if="preloadPath"
        ref="webviewEl"
        :preload="preloadPath"
        src="about:blank"
        partition="persist:webcapture"
        allowpopups
        class="w-full h-full border-none flex"
      ></webview>
      <div v-else class="h-full flex items-center justify-center text-text-muted text-xs">{{ $t('webCapture.initializing') }}</div>
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
        class="absolute border-2 border-dashed border-accent pointer-events-none z-5"
        :style="{
          left: customRegion.x + 'px',
          top: customRegion.y + 'px',
          width: customRegion.width + 'px',
          height: customRegion.height + 'px',
        }"
      >
        <span class="absolute -top-[18px] left-0 text-[10px] text-white bg-[rgba(0,122,204,0.8)] py-px px-1.5 rounded-[3px] whitespace-nowrap">{{ customRegion.width }}×{{ customRegion.height }}</span>
      </div>
    </div>

    <!-- Confirm name modal -->
    <div v-if="captureState === 'confirming'" class="absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-50" @click.self="cancelStart">
      <div class="w-[420px] bg-surface rounded-lg p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <h3 class="m-0 mb-2 text-[15px]">{{ $t('webCapture.confirmTitle') }}</h3>
        <p class="text-xs text-text-secondary m-0 mb-3">{{ $t('webCapture.confirmDesc') }} <code class="py-px px-1 bg-page rounded-[3px] text-[11px]">slides_{{ sanitizedPreview }}</code>.</p>
        <input
          class="w-full box-border py-2 px-2.5 text-[13px] py-[5px] px-2 border border-border-input rounded text-xs bg-surface min-w-[120px] focus:outline-none focus:border-accent"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          @keydown.enter="confirmAndStart"
          ref="modalInputRef"
        />
        <div class="mt-3.5 flex justify-end gap-2">
          <button class="py-[5px] px-2.5 border border-border-strong rounded bg-surface text-text text-xs cursor-pointer hover:not-disabled:bg-page disabled:text-text-muted disabled:cursor-not-allowed" @click="cancelStart">{{ $t('webCapture.cancel') }}</button>
          <button class="py-[5px] px-3.5 rounded bg-accent text-white text-xs font-medium cursor-pointer hover:not-disabled:bg-accent-strong disabled:bg-[var(--border-strong)] disabled:cursor-not-allowed" @click="confirmAndStart" :disabled="!courseName.trim()">{{ $t('webCapture.start') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  console.warn('WebCaptureTab: webview element never appeared')
}, { immediate: true })

watch(captureState, (val) => {
  if (val === 'confirming') void focusModal()
})
</script>
