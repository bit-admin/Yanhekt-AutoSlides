<template>
  <div class="offline-processing-tab">
    <div class="offline-columns">
      <!-- Left Column: Offline Post-Processing -->
      <div class="offline-column">
        <h3 class="column-title">{{ $t('offlineProcessing.title') }}</h3>

        <!-- Input Folder -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.inputFolder') }}</label>
          <div class="directory-input-group">
            <input
              :value="offlineInputFolderPath || $t('offlineProcessing.noFolderSelected')"
              type="text"
              readonly
              class="directory-input"
              :class="{ 'placeholder-text': !offlineInputFolderPath }"
              :title="offlineInputFolderPath"
            />
            <button @click="offlineProcessing.selectInputFolder()" class="browse-btn" :disabled="offlineIsProcessing">
              {{ $t('offlineProcessing.selectFolder') }}
            </button>
          </div>
        </div>

        <!-- Post-Processing Configuration -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.postProcessingConfig') }}</label>
          <div class="toggle-list">
            <label class="toggle-item">
              <input type="checkbox" v-model="offlineEnableDuplicateRemoval" :disabled="offlineIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.enableDuplicateRemoval') }}</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" v-model="offlineEnableExclusionList" :disabled="offlineIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.enableExclusionList') }}</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" v-model="offlineEnableAIFiltering" :disabled="offlineIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.enableAIFiltering') }}</span>
            </label>
          </div>
          <div class="setting-note">{{ $t('offlineProcessing.exclusionListNote') }}</div>
        </div>

        <!-- Output Options -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="toggle-list">
            <label class="toggle-item">
              <input type="checkbox" v-model="offlineEnablePngColorReduction" :disabled="offlineIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer to push controls to bottom -->
        <div class="offline-spacer"></div>

        <!-- Progress bar -->
        <div v-if="offlineProgress.phase !== 'idle'" class="progress-track">
          <div class="progress-fill" :style="{ width: overallOfflineProgress + '%' }"></div>
        </div>

        <!-- Actions -->
        <div class="offline-actions">
          <button
            v-if="offlineProgress.phase === 'completed'"
            @click="openOfflineOutputFolder"
            class="open-output-btn"
          >{{ $t('offlineProcessing.openOutput') }}</button>
          <button
            v-if="offlineIsProcessing"
            @click="offlineProcessing.cancelProcessing()"
            class="secondary-btn"
          >{{ $t('offlineProcessing.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="secondary-btn"
          >{{ $t('offlineProcessing.close') }}</button>
          <button
            @click="offlineProcessing.startProcessing()"
            :disabled="!offlineInputFolderPath || offlineIsProcessing || offlineProgress.phase === 'completed'"
            class="primary-btn"
          >{{ offlineIsProcessing ? $t('offlineProcessing.processing') : $t('offlineProcessing.start') }}</button>
        </div>
      </div>

      <!-- Right Column: Auto-crop porting test -->
      <div class="offline-column auto-crop-column">
        <h3 class="column-title">{{ $t('offlineProcessing.autoCrop.title') }}</h3>
        <p class="auto-crop-description">{{ $t('offlineProcessing.autoCrop.description') }}</p>

        <div class="auto-crop-toolbar">
          <button class="primary-btn" :disabled="autoCropIsProcessing" @click="autoCrop.selectImage()">
            {{ $t('offlineProcessing.autoCrop.selectImage') }}
          </button>
          <button
            class="secondary-btn auto-crop-secondary"
            :disabled="!autoCropHasImage || autoCropIsProcessing"
            @click="autoCrop.rerun()"
          >{{ $t('offlineProcessing.autoCrop.rerun') }}</button>
          <button
            class="secondary-btn auto-crop-secondary"
            :disabled="!autoCropHasImage || autoCropIsProcessing"
            @click="autoCrop.clear()"
          >{{ $t('offlineProcessing.autoCrop.clear') }}</button>
          <label class="auto-crop-toggle" :class="{ disabled: !autoCropHasImage || autoCropIsProcessing }">
            <input
              type="checkbox"
              v-model="autoCropDebugEdges"
              :disabled="!autoCropHasImage || autoCropIsProcessing"
              @change="autoCrop.rerun()"
            />
            {{ $t('offlineProcessing.autoCrop.showEdges') }}
          </label>
        </div>

        <div v-if="autoCropSelectedPath" class="auto-crop-path" :title="autoCropSelectedPath">
          {{ autoCropSelectedPath }}
        </div>

        <div v-if="autoCropError" class="auto-crop-error">{{ autoCropError }}</div>

        <details v-if="autoCropDiagnostics.length" class="auto-crop-diagnostics" open>
          <summary>Diagnostics ({{ autoCropDiagnostics.length }})</summary>
          <pre>{{ autoCropDiagnostics.join('\n') }}</pre>
        </details>

        <div class="auto-crop-canvas-area" :class="{ empty: !autoCropHasImage }">
          <div v-if="!autoCropHasImage && !autoCropIsProcessing" class="auto-crop-empty">
            {{ $t('offlineProcessing.autoCrop.noSelection') }}
          </div>
          <div v-else class="auto-crop-stage">
            <canvas ref="overlayCanvasRef" class="auto-crop-canvas"></canvas>
            <div v-if="autoCropIsProcessing" class="auto-crop-loading">
              {{ $t('offlineProcessing.autoCrop.loading') }}
            </div>
          </div>
          <div v-if="autoCropResult && !autoCropResult.bbox && !autoCropIsProcessing" class="auto-crop-no-bbox">
            {{ $t('offlineProcessing.autoCrop.noBbox') }}
          </div>
        </div>

        <div v-if="autoCropResult" class="auto-crop-meta">
          <h4 class="meta-title">{{ $t('offlineProcessing.autoCrop.metadataTitle') }}</h4>
          <dl class="meta-list">
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelBbox') }}</dt>
              <dd>
                <template v-if="autoCropResult.bbox">
                  {{ autoCropResult.bbox.x }}, {{ autoCropResult.bbox.y }},
                  {{ autoCropResult.bbox.w }}, {{ autoCropResult.bbox.h }}
                </template>
                <template v-else>—</template>
              </dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelAspect') }}</dt>
              <dd>{{ autoCropResult.bbox ? autoCropResult.bbox.aspect.toFixed(3) : '—' }}</dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelAspectScore') }}</dt>
              <dd>{{ autoCropResult.bbox ? autoCropResult.bbox.aspectScore.toFixed(3) : '—' }}</dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelAreaRatio') }}</dt>
              <dd>{{ autoCropResult.bbox ? autoCropResult.bbox.areaRatio.toFixed(3) : '—' }}</dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelStripped') }}</dt>
              <dd>
                {{ autoCropResult.stripped.top }} / {{ autoCropResult.stripped.bottom }} /
                {{ autoCropResult.stripped.left }} / {{ autoCropResult.stripped.right }}
              </dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelInner') }}</dt>
              <dd>{{ autoCropResult.innerSize.width }} × {{ autoCropResult.innerSize.height }}</dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelCandidates') }}</dt>
              <dd>{{ autoCropResult.candidates.length }}</dd>
            </div>
            <div class="meta-row">
              <dt>{{ $t('offlineProcessing.autoCrop.labelDuration') }}</dt>
              <dd>{{ autoCropResult.durationMs.toFixed(1) }} {{ $t('offlineProcessing.autoCrop.ms') }}</dd>
            </div>
          </dl>
          <div class="auto-crop-actions">
            <button
              class="secondary-btn auto-crop-secondary"
              :disabled="!autoCropResult.bbox"
              @click="copyBbox"
            >{{ bboxCopied ? $t('offlineProcessing.autoCrop.copied') : $t('offlineProcessing.autoCrop.copyBbox') }}</button>
          </div>
          <div v-if="autoCropResult.bbox" class="cropped-preview">
            <h4 class="meta-title">{{ $t('offlineProcessing.autoCrop.croppedPreviewTitle') }}</h4>
            <canvas ref="croppedCanvasRef" class="auto-crop-canvas cropped-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useOfflineProcessing } from '../composables/useOfflineProcessing'
import { useAutoCropTest } from '../composables/useAutoCropTest'

const offlineProcessing = useOfflineProcessing()
const {
  inputFolderPath: offlineInputFolderPath,
  enableDuplicateRemoval: offlineEnableDuplicateRemoval,
  enableExclusionList: offlineEnableExclusionList,
  enableAIFiltering: offlineEnableAIFiltering,
  enablePngColorReduction: offlineEnablePngColorReduction,
  isProcessing: offlineIsProcessing,
  progress: offlineProgress
} = offlineProcessing

// Initialize on mount (same as openModal but without toggling showOfflineModal)
offlineProcessing.openModal()

const openOfflineOutputFolder = async () => {
  if (offlineProcessing.outputDir.value) {
    await window.electronAPI.shell.openPath(offlineProcessing.outputDir.value)
  }
}

const resetAndClose = () => {
  window.electronAPI.window?.close?.()
}

const phaseOrder = ['copying', 'phase1', 'phase2', 'phase3', 'completed', 'cancelled', 'error'] as const

const isOfflinePhaseCompleted = (phase: 'phase1' | 'phase2' | 'phase3'): boolean => {
  const currentIdx = phaseOrder.indexOf(offlineProgress.value.phase as typeof phaseOrder[number])
  const phaseIdx = phaseOrder.indexOf(phase)
  return currentIdx > phaseIdx
}

const getOfflinePhaseProgress = (phase: 'phase1' | 'phase2' | 'phase3'): number => {
  if (offlineProgress.value.phase === phase) {
    return offlineProgress.value.total > 0
      ? (offlineProgress.value.currentIndex / offlineProgress.value.total) * 100
      : 0
  }
  if (isOfflinePhaseCompleted(phase)) return 100
  return 0
}

const overallOfflineProgress = computed(() => {
  const phase = offlineProgress.value.phase
  if (phase === 'idle') return 0
  if (phase === 'copying') {
    return offlineProgress.value.total > 0
      ? (offlineProgress.value.currentIndex / offlineProgress.value.total) * 2
      : 0
  }
  const p1 = getOfflinePhaseProgress('phase1')
  if (phase === 'phase1') return 2 + (p1 / 100) * 20
  const p2 = getOfflinePhaseProgress('phase2')
  if (phase === 'phase2') return 22 + (p2 / 100) * 20
  const p3 = getOfflinePhaseProgress('phase3')
  if (phase === 'phase3') return 42 + (p3 / 100) * 58
  if (phase === 'completed') return 100
  return 0
})

// ---------------------------------------------------------------------------
// Auto-crop porting test (right column)
// ---------------------------------------------------------------------------
const autoCrop = useAutoCropTest()
const {
  selectedImagePath: autoCropSelectedPath,
  sourceBitmap: autoCropBitmap,
  result: autoCropResult,
  isProcessing: autoCropIsProcessing,
  error: autoCropError,
  debugEdges: autoCropDebugEdges,
  diagnostics: autoCropDiagnostics,
} = autoCrop

const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const croppedCanvasRef = ref<HTMLCanvasElement | null>(null)
const bboxCopied = ref(false)
const edgesImageCache = ref<HTMLImageElement | null>(null)

const autoCropHasImage = computed(() => autoCropBitmap.value !== null)

const drawOverlay = async () => {
  await nextTick()
  const canvas = overlayCanvasRef.value
  const bitmap = autoCropBitmap.value
  if (!canvas || !bitmap) return

  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)

  const r = autoCropResult.value
  if (!r) return

  if (r.edgesUrl && autoCropDebugEdges.value) {
    if (!edgesImageCache.value || edgesImageCache.value.src !== r.edgesUrl) {
      const img = new Image()
      img.src = r.edgesUrl
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
      edgesImageCache.value = img
    }
    if (edgesImageCache.value && edgesImageCache.value.complete) {
      const innerW = r.innerSize.width
      const innerH = r.innerSize.height
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.drawImage(
        edgesImageCache.value,
        r.stripped.left,
        r.stripped.top,
        innerW,
        innerH,
      )
      ctx.restore()
    }
  }

  // Stripped border zones — translucent grey on the edges that were trimmed.
  const greys = [
    { x: 0, y: 0, w: canvas.width, h: r.stripped.top },
    { x: 0, y: canvas.height - r.stripped.bottom, w: canvas.width, h: r.stripped.bottom },
    { x: 0, y: 0, w: r.stripped.left, h: canvas.height },
    { x: canvas.width - r.stripped.right, y: 0, w: r.stripped.right, h: canvas.height },
  ]
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  for (const g of greys) {
    if (g.w > 0 && g.h > 0) ctx.fillRect(g.x, g.y, g.w, g.h)
  }

  if (r.bbox) {
    ctx.strokeStyle = 'rgba(255, 64, 64, 0.95)'
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 600))
    ctx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.w, r.bbox.h)
  }
}

const drawCropped = async () => {
  await nextTick()
  const canvas = croppedCanvasRef.value
  const bitmap = autoCropBitmap.value
  const r = autoCropResult.value
  if (!canvas || !bitmap || !r || !r.bbox) return

  const { x, y, w, h } = r.bbox
  if (w <= 0 || h <= 0) return
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h)
}

watch(
  [autoCropBitmap, autoCropResult, autoCropDebugEdges],
  () => {
    if (!autoCropResult.value || !autoCropResult.value.edgesUrl) {
      edgesImageCache.value = null
    }
    drawOverlay()
    drawCropped()
  },
  { flush: 'post' },
)

const copyBbox = async () => {
  const r = autoCropResult.value
  if (!r || !r.bbox) return
  const text = `${r.bbox.x},${r.bbox.y},${r.bbox.w},${r.bbox.h}`
  try {
    await navigator.clipboard.writeText(text)
    bboxCopied.value = true
    setTimeout(() => {
      bboxCopied.value = false
    }, 1500)
  } catch (err) {
    console.warn('Failed to copy bbox', err)
  }
}
</script>

<style scoped>
.offline-processing-tab {
  height: 100%;
  overflow: hidden;
}

.offline-columns {
  display: flex;
  height: 100%;
}

.offline-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
}

.offline-column:first-child {
  border-right: 1px solid #e0e0e0;
}

.column-title {
  margin: 0 0 20px 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}

/* Setting Groups */
.setting-group {
  margin-bottom: 20px;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.directory-input-group {
  display: flex;
  gap: 8px;
}

.directory-input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: #fafafa;
  color: #333;
}

.directory-input.placeholder-text {
  color: #999;
}

.browse-btn {
  padding: 7px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.browse-btn:hover:not(:disabled) {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.browse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Toggle List — matches LeftPanel advanced settings checkbox style */
.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-item:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.toggle-item input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: #007bff;
}

.toggle-item input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-text {
  font-size: 12px;
  color: #333;
}

.setting-note {
  font-size: 11px;
  color: #888;
  margin-top: 6px;
}

/* Spacer */
.offline-spacer {
  flex: 1;
}

/* Progress */
.progress-track {
  width: 100%;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background-color: #007acc;
  transition: width 0.3s ease;
}

/* Actions */
.offline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.open-output-btn {
  padding: 8px 16px;
  border: 1px solid #007acc;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: white;
  color: #007acc;
  margin-right: auto;
}

.open-output-btn:hover {
  background-color: #007acc;
  color: white;
}

.secondary-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}

.secondary-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.primary-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.primary-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* Auto-crop Column */
.auto-crop-column {
  gap: 12px;
}

.auto-crop-description {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.auto-crop-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.auto-crop-secondary {
  margin-left: 0;
}

.auto-crop-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  margin-left: auto;
}

.auto-crop-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auto-crop-toggle input[type="checkbox"] {
  margin: 0;
  width: 14px;
  height: 14px;
  accent-color: #007bff;
  cursor: pointer;
}

.auto-crop-path {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auto-crop-error {
  font-size: 12px;
  color: #c0392b;
  background-color: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 8px 10px;
}

.auto-crop-canvas-area {
  position: relative;
  flex: 1 1 auto;
  min-height: 160px;
  border: 1px dashed #ddd;
  border-radius: 4px;
  background-color: #fafafa;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auto-crop-canvas-area.empty {
  border-style: dashed;
}

.auto-crop-empty {
  font-size: 12px;
  color: #999;
  padding: 16px;
  text-align: center;
}

.auto-crop-stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.auto-crop-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background-color: #fff;
}

.cropped-canvas {
  border: 1px solid #ddd;
  border-radius: 4px;
}

.auto-crop-loading {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #555;
}

.auto-crop-no-bbox {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(192, 57, 43, 0.85);
  color: white;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 3px;
}

.auto-crop-meta {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.meta-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.meta-list {
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 12px;
  row-gap: 4px;
  font-size: 11px;
}

.meta-row {
  display: contents;
}

.meta-row dt {
  color: #888;
  font-weight: 500;
}

.meta-row dd {
  margin: 0;
  color: #333;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.auto-crop-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.cropped-preview {
  margin-top: 12px;
}

.auto-crop-diagnostics {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #fafafa;
  font-size: 11px;
  max-height: 180px;
  overflow: auto;
}

.auto-crop-diagnostics summary {
  cursor: pointer;
  padding: 6px 10px;
  font-weight: 600;
  color: #555;
}

.auto-crop-diagnostics pre {
  margin: 0;
  padding: 6px 10px 10px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  color: #444;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .offline-column:first-child {
    border-right-color: #3d3d3d;
  }

  .column-title {
    color: #e0e0e0;
    border-bottom-color: #3d3d3d;
  }

  .setting-label {
    color: #ccc;
  }

  .directory-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .directory-input.placeholder-text {
    color: #666;
  }

  .browse-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .browse-btn:hover:not(:disabled) {
    background-color: #404040;
    border-color: #666;
  }

  .toggle-item {
    background-color: #2a2a2a;
    border-color: #404040;
  }

  .toggle-item:hover {
    background-color: #333;
    border-color: #555;
  }

  .toggle-text {
    color: #ccc;
  }

  .setting-note {
    color: #777;
  }

  .progress-track {
    background-color: #404040;
  }

  .progress-fill {
    background-color: #4a9eff;
  }

  .offline-actions {
    border-top-color: #3d3d3d;
  }

  .open-output-btn {
    background-color: #2d2d2d;
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .open-output-btn:hover {
    background-color: #4a9eff;
    color: #1e1e1e;
  }

  .secondary-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .secondary-btn:hover {
    background-color: #404040;
    border-color: #666;
  }

  .auto-crop-description {
    color: #aaa;
  }

  .auto-crop-toggle {
    color: #ccc;
  }

  .auto-crop-path {
    color: #888;
  }

  .auto-crop-error {
    color: #f5b7b1;
    background-color: #3b1f1d;
    border-color: #5c2a26;
  }

  .auto-crop-canvas-area {
    border-color: #404040;
    background-color: #2a2a2a;
  }

  .auto-crop-empty {
    color: #777;
  }

  .auto-crop-canvas {
    background-color: #1e1e1e;
  }

  .cropped-canvas {
    border-color: #404040;
  }

  .auto-crop-loading {
    background-color: rgba(30, 30, 30, 0.7);
    color: #ccc;
  }

  .auto-crop-meta {
    border-top-color: #3d3d3d;
  }

  .meta-title {
    color: #e0e0e0;
  }

  .meta-row dt {
    color: #888;
  }

  .meta-row dd {
    color: #e0e0e0;
  }

  .auto-crop-diagnostics {
    border-color: #3d3d3d;
    background-color: #1e1e1e;
  }

  .auto-crop-diagnostics summary {
    color: #ccc;
  }

  .auto-crop-diagnostics pre {
    color: #ddd;
  }
}
</style>
