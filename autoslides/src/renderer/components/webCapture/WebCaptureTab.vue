<template>
  <div class="flex h-full flex-col bg-surface text-fg">
    <!-- Top toolbar: navigation + URL -->
    <div class="flex flex-wrap items-center gap-2 border-b border-line bg-[#fafafa] px-3 py-1.5 dark:bg-[#252525]">
      <button :class="navBtn" @click="goBack" :title="$t('webCapture.back')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button :class="navBtn" @click="goForward" :title="$t('webCapture.forward')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <button :class="navBtn" @click="reload" :title="$t('webCapture.reload')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M13 8a5 5 0 11-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </button>
      <input
        :class="[fieldInput, 'min-w-[200px] flex-1']"
        :value="pendingUrl"
        @input="(e) => pendingUrl = (e.target as HTMLInputElement).value"
        @keydown.enter="navigate()"
        :placeholder="$t('webCapture.urlPlaceholder')"
        spellcheck="false"
      />
      <button :class="primaryBtn" @click="navigate()" :disabled="!pendingUrl.trim()">{{ $t('webCapture.go') }}</button>
      <div class="relative">
        <button :class="[secondaryBtn, 'flex items-center gap-1']" @click.stop="presetOpen = !presetOpen">
          {{ $t('webCapture.presets') }}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <ul v-if="presetOpen" class="absolute right-0 top-full z-dropdown mt-1 min-w-[140px] list-none rounded-md border border-line-input bg-surface py-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] dark:border-[#555] dark:bg-[#2a2a2a]">
          <li v-for="p in presets" :key="p.url" class="cursor-pointer whitespace-nowrap px-3 py-1 text-xs hover:bg-accent/[0.08] hover:text-accent dark:hover:bg-accent/[0.12]" @click="onSelectPreset(p)">{{ $t(p.labelKey) }}</li>
        </ul>
      </div>
    </div>

    <!-- Second toolbar: course + selector + capture actions -->
    <div class="flex flex-wrap items-center gap-2 border-b border-line bg-[#f5f5f5] px-3 py-1.5 dark:bg-[#2a2a2a]">
      <div class="flex items-center gap-1.5">
        <label class="whitespace-nowrap text-[11px] text-fg-secondary">{{ $t('webCapture.name') }}</label>
        <input
          :class="[fieldInput, 'min-w-[120px]']"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          :placeholder="pageTitle || $t('webCapture.courseNamePlaceholder')"
        />
      </div>
      <div class="flex min-w-[180px] flex-1 items-center gap-1.5" :class="{ 'opacity-40': regionOverridesSelector }">
        <label class="whitespace-nowrap text-[11px] text-fg-secondary">{{ $t('webCapture.selector') }}</label>
        <input
          :class="[fieldInput, 'w-full min-w-0']"
          :value="userSelector"
          @input="(e) => onUserSelectorInput((e.target as HTMLInputElement).value)"
          :placeholder="regionOverridesSelector ? $t('webCapture.regionOverride') : (detectedVideo?.selector || 'video')"
          spellcheck="false"
        />
      </div>
      <button
        :class="[secondaryBtn, pickerActive === 'pick' ? secondaryActive : '', regionOverridesSelector ? 'opacity-40' : '']"
        @click="pickerActive === 'pick' ? cancelPicker() : pickVideoSelector()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'pick' ? $t('webCapture.cancelPick') : $t('webCapture.pickVideo') }}
      </button>
      <button
        :class="[secondaryBtn, pickerActive === 'block' ? secondaryActive : '']"
        @click="pickerActive === 'block' ? cancelPicker() : startBlocker()"
        :disabled="captureState === 'running'"
      >
        {{ pickerActive === 'block' ? $t('webCapture.cancelBlock') : $t('webCapture.blockElement') }}
      </button>
      <button
        :class="secondaryBtn"
        @click="clearBlocks"
        :disabled="blockedSelectors.length === 0"
      >
        {{ $t('webCapture.clearBlocks', { n: blockedSelectors.length }) }}
      </button>
      <button
        :class="[secondaryBtn, regionDrawMode ? secondaryActive : '']"
        @click="regionDrawMode ? cancelRegionDraw() : beginRegionDraw()"
        :disabled="captureState === 'running'"
      >
        {{ customRegion ? $t('webCapture.redrawRegion') : $t('webCapture.drawRegion') }}
      </button>
      <button
        v-if="customRegion"
        :class="secondaryBtn"
        @click="clearRegion"
        :disabled="captureState === 'running'"
      >
        {{ $t('webCapture.clearRegion') }}
      </button>
      <button
        v-if="captureState !== 'running'"
        :class="primaryBtn"
        @click="requestStart"
        :disabled="!canStart"
      >
        {{ $t('webCapture.start') }}
      </button>
      <button
        v-else
        :class="[primaryBtn, '!bg-[#d9534f] hover:!bg-[#b52b27]']"
        @click="stopCapture"
      >
        {{ $t('webCapture.stop') }}
      </button>
    </div>

    <!-- Status strip -->
    <div class="flex flex-wrap items-center gap-2.5 border-b border-line bg-[#f0f0f0] px-3 py-[5px] text-[11px] text-fg-secondary dark:bg-[#252525]">
      <span :class="statusChip">{{ $t('webCapture.modeLabel') }}: <b>{{ captureMode }}</b></span>
      <span :class="statusChip" v-if="detectedVideo">{{ $t('webCapture.detected') }}: {{ detectedVideo.width }}×{{ detectedVideo.height }}</span>
      <span :class="statusChip" v-else-if="captureState === 'idle'">{{ $t('webCapture.noVideoDetected') }}</span>
      <span :class="statusChip" v-if="customRegion">{{ $t('webCapture.regionLabel') }}: {{ customRegion.width }}×{{ customRegion.height }}</span>
      <span :class="statusChip">{{ $t('webCapture.ticks') }}: {{ tickCount }}</span>
      <span :class="statusChip">{{ $t('webCapture.saved') }}: {{ savedCount }}</span>
      <span class="flex-1 truncate italic text-fg-secondary">{{ displayStatus }}</span>
    </div>

    <!-- Webview area -->
    <div class="relative flex-1 overflow-hidden bg-[#222]">
      <webview
        v-if="preloadPath"
        ref="webviewEl"
        :preload="preloadPath"
        src="about:blank"
        partition="persist:webcapture"
        allowpopups
        class="flex h-full w-full border-none"
      ></webview>
      <div v-else class="flex h-full items-center justify-center text-xs text-[#aaa]">{{ $t('webCapture.initializing') }}</div>
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
        class="pointer-events-none absolute z-[5] border-2 border-dashed border-accent"
        :style="{
          left: customRegion.x + 'px',
          top: customRegion.y + 'px',
          width: customRegion.width + 'px',
          height: customRegion.height + 'px',
        }"
      >
        <span class="absolute -top-[18px] left-0 whitespace-nowrap rounded-[3px] bg-accent/80 px-1.5 py-px text-[10px] text-white">{{ customRegion.width }}×{{ customRegion.height }}</span>
      </div>
    </div>

    <!-- Confirm name modal -->
    <div v-if="captureState === 'confirming'" class="absolute inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="cancelStart">
      <div class="w-[420px] rounded-lg bg-modal p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <h3 class="m-0 mb-2 text-[15px] text-fg">{{ $t('webCapture.confirmTitle') }}</h3>
        <p class="m-0 mb-3 text-xs text-fg-secondary">{{ $t('webCapture.confirmDesc') }} <code class="rounded-[3px] bg-[#f0f0f0] px-1 py-px text-[11px] dark:bg-[#3a3a3a]">slides_{{ sanitizedPreview }}</code>.</p>
        <input
          :class="[fieldInput, 'w-full px-2.5 py-2 text-[13px]']"
          :value="courseName"
          @input="(e) => onCourseNameInput((e.target as HTMLInputElement).value)"
          @keydown.enter="confirmAndStart"
          ref="modalInputRef"
        />
        <div class="mt-3.5 flex justify-end gap-2">
          <button :class="secondaryBtn" @click="cancelStart">{{ $t('webCapture.cancel') }}</button>
          <button :class="primaryBtn" @click="confirmAndStart" :disabled="!courseName.trim()">{{ $t('webCapture.start') }}</button>
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

// ---- Tailwind class-string constants ----
const navBtn = 'flex h-7 w-7 items-center justify-center rounded border border-line-input bg-surface text-fg-secondary cursor-pointer hover:bg-[#f0f0f0] dark:bg-[#333] dark:border-[#555] dark:hover:bg-[#404040]'
const fieldInput = 'rounded border border-line-input bg-surface px-2 py-[5px] text-xs text-fg focus:border-accent focus:outline-none dark:border-[#555] dark:bg-[#2d2d2d]'
const primaryBtn = 'rounded border-none bg-accent px-3.5 py-[5px] text-xs font-medium text-white cursor-pointer enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-[#ccc]'
const secondaryBtn = 'rounded border border-[#ccc] bg-surface px-2.5 py-[5px] text-xs text-fg cursor-pointer enabled:hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:text-[#aaa] dark:border-[#555] dark:bg-[#333] dark:enabled:hover:bg-[#404040]'
const secondaryActive = 'border-accent bg-accent/15 text-accent'
const statusChip = 'inline-flex gap-1 rounded-[3px] border border-line-input bg-surface px-1.5 py-0.5 dark:border-[#555] dark:bg-[#333]'

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

