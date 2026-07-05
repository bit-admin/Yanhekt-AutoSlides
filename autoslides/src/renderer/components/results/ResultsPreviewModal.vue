<template>
  <!-- Preview + crop modal. The component stays mounted for the page's whole
       lifetime (v-if is INSIDE) so the auto-crop worker client lives as long
       as the page, exactly as before the extraction. -->
  <div v-if="previewItem" class="preview-modal-overlay" @click="emit('close')">
    <div class="preview-modal" :class="{ 'metadata-visible': showPreviewMetadata, 'crop-mode': isCropMode }" @click.stop>
      <button class="preview-close-btn" @click="emit('close')">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="preview-content">
        <div class="preview-image-container" :class="{ 'crop-mode': isCropMode }">
          <div ref="previewStageShell" class="preview-stage-shell" :class="{ 'crop-active': isCropMode }">
            <div
              ref="previewStage"
              class="preview-stage"
              :class="{ 'crop-stage': isCropMode }"
              :style="previewStageStyle"
              @pointerdown="handleCropStagePointerDown"
            >
              <img
                v-if="previewImageSrc"
                :src="previewImageSrc"
                :alt="previewItem.name"
                class="preview-image"
                draggable="false"
                @load="handlePreviewImageLoad"
              />
              <div v-else class="preview-image-placeholder">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.2"/>
                </svg>
              </div>

              <div
                v-if="isCropMode && cropRectPx"
                class="crop-selection"
                :style="cropSelectionStyle"
                @pointerdown.stop="startCropInteraction('move', $event)"
              >
                <div class="crop-grid">
                  <span v-for="line in 2" :key="`v-${line}`" class="crop-grid-line vertical" :style="{ left: `${line * 33.333}%` }"></span>
                  <span v-for="line in 2" :key="`h-${line}`" class="crop-grid-line horizontal" :style="{ top: `${line * 33.333}%` }"></span>
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

          <div class="preview-actions">
            <template v-if="isCropMode">
              <button class="preview-action-btn" :disabled="isLoading" @click="cancelCropMode">
                {{ $t('trash.cancel') }}
              </button>
              <button class="preview-action-btn primary" :disabled="!canApplyCrop || isLoading" @click="applyCrop">
                {{ $t('trash.applyCrop') }}
              </button>
            </template>
            <template v-else>
              <button
                v-if="canRestoreCrop"
                class="preview-action-btn"
                :disabled="isLoading"
                @click="restoreCrop"
              >
                {{ $t('trash.restoreCrop') }}
              </button>
              <button
                v-if="canRecrop"
                class="preview-action-btn"
                :disabled="isLoading"
                @click="startCropMode"
              >
                {{ $t('trash.recrop') }}
              </button>
              <template v-else-if="canStartCrop">
                <button
                  class="preview-action-btn"
                  :disabled="isLoading || isAutoCropDetecting"
                  @click="startCropMode"
                >
                  {{ $t('trash.crop') }}
                </button>
                <button
                  class="preview-action-btn"
                  :disabled="isLoading || isAutoCropDetecting"
                  @click="startAutoCropMode"
                >
                  {{ $t('trash.autoCrop') }}
                </button>
              </template>
              <button
                v-if="canSetCurrentAsBaseline"
                class="preview-action-btn"
                :disabled="isLoading || isCurrentPreviewBaseline"
                :title="isCurrentPreviewBaseline ? $t('trash.currentBaselineTooltip') : $t('trash.useAsCropBaselineHint')"
                @click="handleSetBaseline"
              >
                {{ $t('trash.useAsCropBaseline') }}
              </button>
              <button class="preview-action-btn" @click="togglePreviewMetadata">
                <span>{{ showPreviewMetadata ? $t('trash.hideMetadata') : $t('trash.showMetadata') }}</span>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path
                    :d="showPreviewMetadata ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </template>
          </div>
        </div>

        <div class="preview-info-container">
          <div class="preview-info-title">{{ $t('trash.metadata') }}</div>
          <table class="preview-info-table">
            <tbody>
              <tr>
                <td class="info-label">{{ $t('trash.filename') }}</td>
                <td class="info-value">{{ previewItem.name }}</td>
              </tr>
              <tr>
                <td class="info-label">{{ $t('trash.folder') }}</td>
                <td class="info-value">{{ currentFolderDisplayName }}</td>
              </tr>
              <tr>
                <td class="info-label">{{ $t('trash.status') }}</td>
                <td class="info-value">
                  <span v-if="previewItem.status === 'active' && previewItem.isCropped" class="badge badge--cropped">{{ getCropLabel() }}</span>
                  <span class="badge" :class="`badge--${previewItem.status}`">{{ getStatusLabel(previewItem.status) }}</span>
                </td>
              </tr>
              <tr v-if="previewItem.status === 'active'">
                <td class="info-label">{{ $t('trash.currentPath') }}</td>
                <td class="info-value info-path">{{ previewItem.imagePath || previewItem.originalPath }}</td>
              </tr>
              <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.croppedAt">
                <td class="info-label">{{ $t('trash.croppedAt') }}</td>
                <td class="info-value">{{ formatDate(previewItem.croppedAt) }}</td>
              </tr>
              <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.cropRect">
                <td class="info-label">{{ $t('trash.cropArea') }}</td>
                <td class="info-value">{{ formatCropArea(previewItem.cropRect) }}</td>
              </tr>
              <tr v-if="previewItem.status === 'removed'">
                <td class="info-label">{{ $t('trash.originalPath') }}</td>
                <td class="info-value info-path">{{ previewItem.originalPath }}</td>
              </tr>
              <tr v-if="previewItem.status === 'removed' && previewItem.reason">
                <td class="info-label">{{ $t('trash.filterReason') }}</td>
                <td class="info-value">
                  <span :class="['reason-badge', `reason-${previewItem.reason}`]">{{ getReasonLabel(previewItem.reason) }}</span>
                </td>
              </tr>
              <tr v-if="previewItem.status === 'removed' && previewItem.reasonDetails">
                <td class="info-label">{{ $t('trash.reasonDetails') }}</td>
                <td class="info-value">{{ previewItem.reasonDetails }}</td>
              </tr>
              <tr v-if="previewItem.status === 'removed' && previewItem.trashedAt">
                <td class="info-label">{{ $t('trash.trashedAt') }}</td>
                <td class="info-value">{{ formatDate(previewItem.trashedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAutoCropWorkerClient } from '@shared/autoCrop'
import { useCropEditor, type CropHandle } from '@features/results/useCropEditor'
import type { CropRect, ResultsItem, ResultsReason } from '@features/results/useResultsView'

const props = defineProps<{
  previewItem: ResultsItem | null
  isLoading: boolean
  thumbnails: Record<string, string>
  currentFolderDisplayName: string
  canSetCurrentAsBaseline: boolean
  isCurrentPreviewBaseline: boolean
  formatDate: (dateString: string) => string
  applyCropToImage: (imagePath: string, rect: CropRect, autoCropped?: boolean) => Promise<boolean>
  restoreCropFromImage: (imagePath: string) => Promise<boolean>
  setBaselineCrop: (item: ResultsItem) => boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const showPreviewMetadata = ref(false)

// The worker client lives for this component's lifetime — the component is
// mounted unconditionally, so this matches the former page-long lifetime.
const autoCropClient = createAutoCropWorkerClient()
onBeforeUnmount(() => autoCropClient.destroy())

const {
  isCropMode,
  cropRectPx,
  previewStageShell,
  previewStage,
  isAutoCropDetecting,
  previewImageSrc,
  canRestoreCrop,
  canRecrop,
  canStartCrop,
  canApplyCrop,
  previewStageStyle,
  cropSelectionStyle,
  resetCropState,
  handlePreviewImageLoad,
  startCropMode,
  cancelCropMode,
  startAutoCropMode,
  handleCropStagePointerDown,
  startCropInteraction,
  applyCrop,
  restoreCrop,
} = useCropEditor({
  previewItem: toRef(props, 'previewItem'),
  isLoading: toRef(props, 'isLoading'),
  thumbnails: toRef(props, 'thumbnails'),
  showPreviewMetadata,
  applyCropToImage: (imagePath, rect, autoCropped) => props.applyCropToImage(imagePath, rect, autoCropped),
  restoreCropFromImage: (imagePath) => props.restoreCropFromImage(imagePath),
  detectBbox: autoCropClient.detectBbox,
  t,
})

// Replaces the former parent-side open/close wrappers: any preview identity
// change (open, switch item, close) clears crop state and collapses metadata
// before the DOM updates.
watch(() => props.previewItem, () => {
  resetCropState()
  showPreviewMetadata.value = false
})

const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']

const togglePreviewMetadata = () => {
  showPreviewMetadata.value = !showPreviewMetadata.value
}

const handleSetBaseline = () => {
  const item = props.previewItem
  if (!item) return
  props.setBaselineCrop(item)
}

const getReasonLabel = (reason: ResultsReason) => {
  switch (reason) {
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
      return reason
  }
}

const getStatusLabel = (status: 'active' | 'removed') => {
  return status === 'active' ? t('trash.active') : t('trash.removed')
}

const getCropLabel = () => {
  return props.previewItem?.isAutoCropped ? t('trash.autoCropped') : t('trash.cropped')
}

const formatCropArea = (rect?: CropRect) => {
  if (!rect) return ''
  return `${rect.x}, ${rect.y}, ${rect.width} × ${rect.height}`
}
</script>

<style scoped>
.preview-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.preview-modal {
  position: relative;
  width: min(960px, calc(100vw - 48px));
  aspect-ratio: 16 / 10;
  max-height: calc(100vh - 48px);
  background-color: var(--bg-modal);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
}

.preview-modal.metadata-visible {
  width: min(1200px, calc(100vw - 48px));
  aspect-ratio: auto;
}

.preview-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: var(--z-base);
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
}

.preview-content {
  height: 100%;
}

.preview-modal.metadata-visible .preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  min-height: 420px;
  height: auto;
}

.preview-image-container {
  position: relative;
  background-color: var(--bg-surface);
  padding: 54px 18px 58px;
  height: 100%;
}

.preview-modal.metadata-visible .preview-image-container {
  min-height: 420px;
  height: auto;
}

.preview-stage-shell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-stage-shell.crop-active {
  position: relative;
}

.preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-stage.crop-stage {
  cursor: crosshair;
}

.preview-image,
.preview-image-placeholder {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-image {
  user-select: none;
}

.preview-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.preview-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: var(--z-base);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.preview-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: none;
  border-radius: 999px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-action-btn.primary {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.preview-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.preview-modal:not(.metadata-visible) .preview-info-container {
  display: none;
}

.preview-info-container {
  padding: 20px;
  overflow-y: auto;
}

.preview-info-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text-primary);
}

.preview-info-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-info-table td {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
  vertical-align: top;
}

.info-label {
  width: 110px;
  color: var(--text-secondary);
  font-size: 12px;
}

.info-value {
  font-size: 12px;
  color: var(--text-primary);
  word-break: break-word;
}

.info-value .badge + .badge {
  margin-left: 6px;
}

.info-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* Reason badge (this component's copy — ResultsImageGrid carries its own,
   matching the established per-component scoped duplication). */
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
}

.reason-badge.reason-duplicate {
  background-color: var(--reason-duplicate-bg);
  color: var(--reason-duplicate-text);
}

.reason-badge.reason-exclusion {
  background-color: var(--reason-exclusion-bg);
  color: var(--reason-exclusion-text);
}

.reason-badge.reason-ai_filtered {
  background-color: var(--reason-ai-bg);
  color: var(--reason-ai-text);
}

.reason-badge.reason-ai_filtered_edit {
  background-color: var(--reason-ai-edit-bg);
  color: var(--reason-ai-edit-text);
}

.reason-badge.reason-manual {
  background-color: var(--badge-removed-bg);
  color: var(--badge-removed-text);
}
</style>
