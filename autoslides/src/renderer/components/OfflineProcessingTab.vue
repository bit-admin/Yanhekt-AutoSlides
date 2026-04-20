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

      <!-- Right Column: Auto Crop -->
      <div class="offline-column">
        <h3 class="column-title">{{ $t('offlineProcessing.autoCrop.title') }}</h3>

        <!-- Input Images -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.autoCrop.inputImages') }}</label>
          <div class="directory-input-group">
            <input
              :value="autoCropSelectedImagePaths.length === 0
                ? $t('offlineProcessing.autoCrop.noImagesSelected')
                : $t('offlineProcessing.autoCrop.imagesSelected', { count: autoCropSelectedImagePaths.length })"
              type="text"
              readonly
              class="directory-input"
              :class="{ 'placeholder-text': autoCropSelectedImagePaths.length === 0 }"
            />
            <button @click="autoCrop.selectImages()" class="browse-btn" :disabled="autoCropIsProcessing">
              {{ $t('offlineProcessing.autoCrop.select') }}
            </button>
          </div>
        </div>

        <!-- Configuration -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.autoCrop.config') }}</label>
          <div class="toggle-list">
            <label class="toggle-item">
              <input type="checkbox" v-model="autoCropRedBoxMode" :disabled="autoCropIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.autoCrop.redBoxMode') }}</span>
            </label>
            <label class="toggle-item" :class="{ 'toggle-item-disabled': !autoCropRedBoxMode || autoCropEdgesUnavailable }">
              <input
                type="checkbox"
                v-model="autoCropShowEdges"
                :disabled="autoCropIsProcessing || !autoCropRedBoxMode || autoCropEdgesUnavailable"
              />
              <span class="toggle-text">{{ $t('offlineProcessing.autoCrop.showEdges') }}</span>
            </label>
          </div>
        </div>

        <!-- Output Options -->
        <div class="setting-group">
          <label class="setting-label">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="toggle-list">
            <label class="toggle-item">
              <input type="checkbox" v-model="autoCropEnablePngColorReduction" :disabled="autoCropIsProcessing" />
              <span class="toggle-text">{{ $t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer -->
        <div class="offline-spacer"></div>

        <!-- Progress bar -->
        <div v-if="autoCropProgress.phase !== 'idle'" class="progress-track">
          <div class="progress-fill" :style="{ width: autoCropOverallProgress + '%' }"></div>
        </div>

        <!-- Actions -->
        <div class="offline-actions">
          <button
            v-if="autoCropProgress.phase === 'completed' || autoCropProgress.phase === 'cancelled'"
            @click="autoCrop.openOutputFolder()"
            class="open-output-btn"
          >{{ $t('offlineProcessing.autoCrop.openOutput') }}</button>
          <button
            v-if="autoCropIsProcessing"
            @click="autoCrop.cancelProcessing()"
            class="secondary-btn"
          >{{ $t('offlineProcessing.autoCrop.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="secondary-btn"
          >{{ $t('offlineProcessing.autoCrop.close') }}</button>
          <button
            @click="autoCrop.startProcessing()"
            :disabled="autoCropSelectedImagePaths.length === 0 || autoCropIsProcessing || autoCropProgress.phase === 'completed'"
            class="primary-btn"
          >{{ autoCropIsProcessing ? $t('offlineProcessing.autoCrop.processing') : $t('offlineProcessing.autoCrop.start') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOfflineProcessing } from '../composables/useOfflineProcessing'
import { useAutoCrop } from '../composables/useAutoCrop'

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
// Auto Crop (right column)
// ---------------------------------------------------------------------------
const autoCrop = useAutoCrop()
const {
  selectedImagePaths: autoCropSelectedImagePaths,
  redBoxMode: autoCropRedBoxMode,
  showEdges: autoCropShowEdges,
  enablePngColorReduction: autoCropEnablePngColorReduction,
  isProcessing: autoCropIsProcessing,
  progress: autoCropProgress,
  detectorMode: autoCropDetectorMode,
} = autoCrop

autoCrop.refreshDetectorMode()

const autoCropEdgesUnavailable = computed(() => autoCropDetectorMode.value === 'yolo_only')

const autoCropOverallProgress = computed(() => {
  const { phase, current, total } = autoCropProgress.value
  if (phase === 'idle') return 0
  if (phase === 'completed' || phase === 'cancelled' || phase === 'error') return 100
  if (total === 0) return 0
  return (current / total) * 100
})
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

.toggle-item.toggle-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
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
}
</style>
