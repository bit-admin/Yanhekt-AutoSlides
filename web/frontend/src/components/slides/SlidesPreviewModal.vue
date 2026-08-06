<template>
  <Transition name="viewer-fade">
    <div
      v-if="item"
      class="viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="item.name"
      :class="{ 'crop-mode': isCropMode }"
    >
      <!-- Top chrome: back · counter · quiet actions (iCloud Photos detail) -->
      <header class="viewer-top">
        <div class="viewer-top-left">
          <button
            type="button"
            class="viewer-icon-btn"
            :title="$t('trash.back')"
            @click="onClose"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div class="viewer-top-center">
          <div class="viewer-meta-title">{{ slideLabel }}</div>
          <div class="viewer-meta-sub">
            <span v-if="indexLabel">{{ indexLabel }}</span>
            <span v-if="statusLabel" class="viewer-meta-dot">·</span>
            <span v-if="statusLabel">{{ statusLabel }}</span>
            <span v-if="item.isCropped && item.status === 'active'" class="viewer-meta-dot">·</span>
            <span v-if="item.isCropped && item.status === 'active'" class="viewer-cropped">{{
              item.isAutoCropped ? $t('trash.autoCropped') : $t('trash.cropped')
            }}</span>
            <span v-if="reasonText" class="viewer-meta-dot">·</span>
            <span v-if="reasonText">{{ reasonText }}</span>
          </div>
        </div>

        <div class="viewer-top-right">
          <!-- Crop-mode actions live in the top bar (Apple Photos–style). -->
          <template v-if="isCropMode">
            <button
              type="button"
              class="viewer-text-btn"
              :disabled="isLoading || isAutoCropDetecting"
              @click="cancelCropMode"
            >
              {{ $t('trash.cancel') }}
            </button>
            <button
              type="button"
              class="viewer-text-btn"
              :disabled="isLoading || isAutoCropDetecting"
              @click="startAutoCropMode"
            >
              {{ isAutoCropDetecting ? '…' : $t('trash.autoCrop') }}
            </button>
            <button
              type="button"
              class="viewer-text-btn viewer-text-btn--accent"
              :disabled="!canApplyCrop || isLoading || isAutoCropDetecting"
              @click="applyCrop"
            >
              {{ $t('trash.applyCrop') }}
            </button>
          </template>
          <template v-else-if="item.status === 'active'">
            <button
              v-if="canSetBaseline"
              type="button"
              class="viewer-text-btn"
              :disabled="isLoading || isCurrentBaseline"
              :title="
                isCurrentBaseline
                  ? $t('trash.currentBaselineTooltip')
                  : $t('trash.useAsCropBaselineHint')
              "
              @click="onSetBaseline"
            >
              {{ $t('trash.useAsCropBaseline') }}
            </button>
            <!-- Uncropped: crop icon only. Cropped: Revert only (no crop+revert together). -->
            <button
              v-if="canStartCrop"
              type="button"
              class="viewer-icon-btn"
              :title="$t('trash.crop')"
              :aria-label="$t('trash.crop')"
              :disabled="isLoading"
              @click="startCropMode"
            >
              <!-- Standard crop tool: two overlapping L-brackets (Photos / Lucide crop) -->
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                <path d="M18 22V8a2 2 0 0 0-2-2H2" />
              </svg>
            </button>
            <button
              v-else-if="canRestoreCrop"
              type="button"
              class="viewer-text-btn viewer-text-btn--danger"
              :disabled="isLoading"
              :title="$t('trash.revertCrop')"
              @click="restoreCrop"
            >
              {{ $t('trash.revertCrop') }}
            </button>
            <button
              type="button"
              class="viewer-icon-btn viewer-icon-btn--danger"
              :title="$t('trash.delete')"
              @click="$emit('delete', item)"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </template>
          <template v-else>
            <button
              v-if="item.reason === 'ai_filtered_edit'"
              type="button"
              class="viewer-text-btn"
              :disabled="isLoading"
              :title="$t('trash.autoCrop')"
              @click="$emit('auto-crop', item)"
            >
              {{ $t('trash.autoCrop') }}
            </button>
            <button
              type="button"
              class="viewer-text-btn"
              :disabled="isLoading"
              @click="$emit('restore', item)"
            >
              {{ $t('trash.restore') }}
            </button>
          </template>
          <button
            type="button"
            class="viewer-icon-btn"
            :title="$t('playback.close')"
            @click="onClose"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Stage -->
      <div class="viewer-stage" @click.self="onStageBackdrop">
        <button
          v-if="canPrev && !isCropMode"
          type="button"
          class="viewer-nav viewer-nav--prev"
          :aria-label="$t('slides.prevSlide')"
          @click="go(-1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          :ref="setPreviewStageShell"
          class="preview-stage-shell"
          :class="{ 'crop-active': isCropMode }"
        >
          <div
            :ref="setPreviewStage"
            class="preview-stage"
            :class="{ 'crop-stage': isCropMode }"
            :style="previewStageStyle"
            @pointerdown="handleCropStagePointerDown"
          >
            <img
              v-if="previewImageSrc"
              class="viewer-image"
              :class="{ 'viewer-image--crop': isCropMode }"
              :src="previewImageSrc"
              :alt="item.name"
              draggable="false"
              @load="handlePreviewImageLoad"
            />

            <div
              v-if="isCropMode && cropRectPx"
              class="crop-selection"
              :style="cropSelectionStyle"
              @pointerdown.stop="startCropInteraction('move', $event)"
            >
              <div class="crop-grid">
                <span
                  v-for="line in 2"
                  :key="`v-${line}`"
                  class="crop-grid-line vertical"
                  :style="{ left: `${line * 33.333}%` }"
                ></span>
                <span
                  v-for="line in 2"
                  :key="`h-${line}`"
                  class="crop-grid-line horizontal"
                  :style="{ top: `${line * 33.333}%` }"
                ></span>
              </div>
              <button
                v-for="handle in cropHandles"
                :key="handle"
                type="button"
                class="crop-handle"
                :class="`crop-handle-${handle}`"
                @pointerdown.stop="startCropInteraction(handle, $event)"
              ></button>
            </div>
          </div>
        </div>

        <button
          v-if="canNext && !isCropMode"
          type="button"
          class="viewer-nav viewer-nav--next"
          :aria-label="$t('slides.nextSlide')"
          @click="go(1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <!-- Filmstrip stays visible while cropping (nav disabled in crop mode). -->
      <div v-if="items.length > 1" class="viewer-strip-wrap">
        <div ref="stripEl" class="viewer-strip custom-scrollbar">
          <button
            v-for="(entry, i) in items"
            :key="entry.id"
            type="button"
            class="viewer-thumb"
            :class="{ active: entry.id === item.id, removed: entry.status === 'removed' }"
            :disabled="isCropMode"
            @click="onFilmstripClick(entry)"
          >
            <img v-if="thumbUrl(entry)" :src="thumbUrl(entry)" :alt="entry.name" />
            <span v-else class="viewer-thumb-fallback">{{ i + 1 }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// Full-bleed iCloud Photos–style viewer + manual crop stage (Electron-parity).
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { useI18n } from 'vue-i18n'
import type { BaselineCrop, CropRect, ResultsItem } from '../../composables/resultsTypes'
import { useCropEditor, type CropHandle } from '../../composables/useCropEditor'

const props = withDefaults(
  defineProps<{
    item: ResultsItem | null
    items?: ResultsItem[]
    thumbnails: Record<string, string>
    isLoading?: boolean
    baselineCrop?: BaselineCrop | null
    applyCropToImage: (imagePath: string, rect: CropRect, autoCropped?: boolean) => Promise<boolean>
    restoreCropFromImage: (imagePath: string) => Promise<boolean>
    setBaselineCrop: (item: ResultsItem) => boolean
  }>(),
  {
    items: () => [],
    isLoading: false,
    baselineCrop: null,
  },
)

const emit = defineEmits<{
  close: []
  restore: [item: ResultsItem]
  delete: [item: ResultsItem]
  navigate: [item: ResultsItem]
  'auto-crop': [item: ResultsItem]
}>()

const { t } = useI18n()
const stripEl = ref<HTMLElement | null>(null)

const previewItemRef = toRef(props, 'item')
const isLoadingRef = toRef(props, 'isLoading')
const thumbnailsRef = toRef(props, 'thumbnails')

const {
  isCropMode,
  isAutoCropDetecting,
  cropRectPx,
  previewStageShell,
  previewStage,
  previewImageSrc,
  canRestoreCrop,
  canStartCrop,
  canApplyCrop,
  canSetBaseline,
  previewStageStyle,
  cropSelectionStyle,
  resetCropState,
  handlePreviewImageLoad,
  startCropMode,
  startAutoCropMode,
  cancelCropMode,
  handleCropStagePointerDown,
  startCropInteraction,
  applyCrop,
  restoreCrop,
} = useCropEditor({
  previewItem: previewItemRef,
  isLoading: isLoadingRef,
  thumbnails: thumbnailsRef,
  applyCropToImage: (path, rect, auto) => props.applyCropToImage(path, rect, auto),
  restoreCropFromImage: (path) => props.restoreCropFromImage(path),
})

// Function refs so the crop editor's stage elements are wired without relying
// on string-ref name matching (and so vue-tsc sees the refs as used).
function setPreviewStageShell(el: Element | ComponentPublicInstance | null) {
  previewStageShell.value = (el as HTMLDivElement | null) ?? null
}
function setPreviewStage(el: Element | ComponentPublicInstance | null) {
  previewStage.value = (el as HTMLDivElement | null) ?? null
}

const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']

const isCurrentBaseline = computed(() => {
  const item = props.item
  const base = props.baselineCrop
  if (!item || !base) return false
  const id = item.imagePath || item.id
  return base.sourceId === id
})

function onSetBaseline() {
  if (!props.item) return
  props.setBaselineCrop(props.item)
}

// Path-keyed thumbs (see useResultsView) — never use trash-entry UUID as key.
function thumbUrl(item: ResultsItem): string {
  const key =
    item.status === 'removed'
      ? item.trashPath || item.originalPath
      : item.imagePath || item.originalPath || item.id
  return (key && props.thumbnails[key]) || ''
}

const currentIndex = computed(() => {
  if (!props.item) return -1
  return props.items.findIndex((x) => x.id === props.item!.id)
})

const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const indexLabel = computed(() => {
  if (currentIndex.value < 0 || props.items.length === 0) return ''
  return `${currentIndex.value + 1} / ${props.items.length}`
})

const slideLabel = computed(() => {
  if (!props.item) return ''
  if (currentIndex.value >= 0) return t('trash.slideNumber', { n: currentIndex.value + 1 })
  return props.item.name
})

const statusLabel = computed(() => {
  if (!props.item) return ''
  return props.item.status === 'active' ? t('trash.active') : t('trash.removed')
})

const reasonText = computed(() => {
  switch (props.item?.reason) {
    case 'duplicate':
      return t('trash.duplicate')
    case 'exclusion':
      return t('trash.exclusion')
    case 'ai_filtered':
      return t('trash.aiFilteredNotSlide')
    case 'ai_filtered_edit':
      return t('trash.aiFilteredEdit')
    case 'manual':
      return t('trash.manual')
    default:
      return ''
  }
})

function go(delta: number) {
  if (isCropMode.value) return
  const i = currentIndex.value + delta
  if (i < 0 || i >= props.items.length) return
  emit('navigate', props.items[i])
}

function onFilmstripClick(entry: ResultsItem) {
  if (isCropMode.value) return
  emit('navigate', entry)
}

function onClose() {
  if (isCropMode.value) {
    cancelCropMode()
    return
  }
  emit('close')
}

function onStageBackdrop() {
  if (isCropMode.value) return
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.item) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (isCropMode.value) {
      cancelCropMode()
    } else {
      emit('close')
    }
  } else if (e.key === 'ArrowLeft' && !isCropMode.value) {
    e.preventDefault()
    go(-1)
  } else if (e.key === 'ArrowRight' && !isCropMode.value) {
    e.preventDefault()
    go(1)
  }
}

async function scrollActiveThumbIntoView() {
  await nextTick()
  const root = stripEl.value
  if (!root) return
  const active = root.querySelector('.viewer-thumb.active') as HTMLElement | null
  active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
}

watch(
  () => props.item?.id,
  (id) => {
    if (id) {
      document.body.style.overflow = 'hidden'
      void scrollActiveThumbIntoView()
    } else {
      document.body.style.overflow = ''
      resetCropState()
    }
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1d1d1f;
}

html[data-theme='dark'] .viewer {
  background: #000000;
  color: #f5f5f7;
}

.viewer-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0.4rem 0.85rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  background: #fff;
}

html[data-theme='dark'] .viewer-top {
  background: #000;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.viewer-top-left,
.viewer-top-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.viewer-top-right {
  justify-content: flex-end;
}

.viewer-top-center {
  text-align: center;
  min-width: 0;
  padding: 0 0.5rem;
}

.viewer-meta-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-meta-sub {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: #6e6e73;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

html[data-theme='dark'] .viewer-meta-sub {
  color: #a1a1a6;
}

.viewer-meta-dot {
  margin: 0 0.25rem;
  opacity: 0.55;
}

.viewer-cropped {
  color: #606060;
  font-weight: 500;
}

html[data-theme='dark'] .viewer-cropped {
  color: #aaaaaa;
}

.viewer-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #1d1d1f;
  cursor: pointer;
}

html[data-theme='dark'] .viewer-icon-btn {
  color: #f5f5f7;
}

.viewer-icon-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

html[data-theme='dark'] .viewer-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.viewer-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.viewer-icon-btn--danger:hover:not(:disabled) {
  color: #ff3b30;
  background: color-mix(in srgb, #ff3b30 10%, transparent);
}

.viewer-text-btn {
  border: none;
  background: transparent;
  color: #0071e3;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  cursor: pointer;
}

.viewer-text-btn:hover:not(:disabled) {
  background: color-mix(in srgb, #0071e3 10%, transparent);
}

.viewer-text-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Accent apply (same family as default link blue, slightly stronger weight). */
.viewer-text-btn--accent {
  font-weight: 600;
}

/* Apple Photos–style Revert: red text, no fill. */
.viewer-text-btn--danger {
  color: #ff3b30;
}

.viewer-text-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, #ff3b30 10%, transparent);
}

html[data-theme='dark'] .viewer-text-btn--danger {
  color: #ff453a;
}

.viewer-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 3.5rem 0.75rem;
  background: #fafafa;
}

html[data-theme='dark'] .viewer-stage {
  background: #0a0a0a;
}

.preview-stage-shell {
  width: 100%;
  height: 100%;
  max-width: min(1100px, 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-stage-shell.crop-active {
  position: relative;
  max-width: none;
}

.preview-stage {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-stage.crop-stage {
  cursor: crosshair;
  /* Explicit size comes from previewStageStyle in crop mode. */
}

.viewer-image {
  max-width: min(1100px, 100%);
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 0.25rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  user-select: none;
}

.viewer-image--crop {
  max-width: none;
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
}

.crop-selection {
  position: absolute;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.56);
  cursor: move;
  touch-action: none;
}

.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-grid-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.62);
}

.crop-grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}

.crop-grid-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}

.crop-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  background-color: #ffffff;
  transform: translate(-50%, -50%);
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.crop-handle-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.crop-handle-ne {
  top: 0;
  left: 100%;
  cursor: nesw-resize;
}

.crop-handle-sw {
  top: 100%;
  left: 0;
  cursor: nesw-resize;
}

.crop-handle-se {
  top: 100%;
  left: 100%;
  cursor: nwse-resize;
}

.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #1d1d1f;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
}

html[data-theme='dark'] .viewer-nav {
  background: rgba(44, 44, 46, 0.92);
  color: #f5f5f7;
}

.viewer-nav:hover {
  background: #fff;
}

.viewer-nav--prev {
  left: 0.75rem;
}

.viewer-nav--next {
  right: 0.75rem;
}

.viewer-strip-wrap {
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  padding: 0.55rem 0.75rem 0.7rem;
}

html[data-theme='dark'] .viewer-strip-wrap {
  background: #000;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.viewer-strip {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scroll-snap-type: x proximity;
}

.viewer-thumb {
  flex: 0 0 auto;
  width: 72px;
  aspect-ratio: 16 / 9;
  border: 2px solid transparent;
  border-radius: 0.3rem;
  padding: 0;
  overflow: hidden;
  background: #f0f0f2;
  cursor: pointer;
  scroll-snap-align: center;
}

html[data-theme='dark'] .viewer-thumb {
  background: #1c1c1e;
}

.viewer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.viewer-thumb.active {
  border-color: #0071e3;
}

html[data-theme='dark'] .viewer-thumb.active {
  border-color: #0a84ff;
}

.viewer-thumb.removed {
  opacity: 0.55;
}

.viewer-thumb:disabled {
  cursor: default;
  opacity: 0.7;
}

.viewer-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 0.7rem;
  color: #86868b;
}

.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.18s ease;
}

.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .viewer-stage {
    padding: 0.5rem 0.5rem 0.35rem;
  }

  .viewer-nav {
    display: none;
  }

  .viewer-thumb {
    width: 56px;
  }

  }
</style>
