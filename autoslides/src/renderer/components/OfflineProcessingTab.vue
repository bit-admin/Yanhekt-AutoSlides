<template>
  <div class="offline-processing-tab">
    <!-- Input Folder -->
    <div class="setting-item">
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
    <div class="offline-section-header">{{ $t('offlineProcessing.postProcessingConfig') }}</div>

    <div class="offline-toggle-list">
      <label class="phase-toggle-item">
        <input type="checkbox" v-model="offlineEnableDuplicateRemoval" :disabled="offlineIsProcessing" />
        <span class="phase-toggle-text">{{ $t('offlineProcessing.enableDuplicateRemoval') }}</span>
      </label>

      <label class="phase-toggle-item">
        <input type="checkbox" v-model="offlineEnableExclusionList" :disabled="offlineIsProcessing" />
        <span class="phase-toggle-text">{{ $t('offlineProcessing.enableExclusionList') }}</span>
      </label>

      <label class="phase-toggle-item">
        <input type="checkbox" v-model="offlineEnableAIFiltering" :disabled="offlineIsProcessing" />
        <span class="phase-toggle-text">{{ $t('offlineProcessing.enableAIFiltering') }}</span>
      </label>
    </div>
    <div class="offline-note">{{ $t('offlineProcessing.exclusionListNote') }}</div>

    <!-- Output Options -->
    <div class="offline-section-header">{{ $t('offlineProcessing.outputOptions') }}</div>

    <div class="offline-toggle-list">
      <label class="phase-toggle-item">
        <input type="checkbox" v-model="offlineEnablePngColorReduction" :disabled="offlineIsProcessing" />
        <span class="phase-toggle-text">{{ $t('offlineProcessing.enablePngColorReduction') }}</span>
      </label>
    </div>

    <!-- Spacer to push controls to bottom -->
    <div class="offline-spacer"></div>

    <!-- Progress bar -->
    <div v-if="offlineProgress.phase !== 'idle'" class="offline-progress-track">
      <div class="offline-progress-fill" :style="{ width: overallOfflineProgress + '%' }"></div>
    </div>

    <!-- Actions -->
    <div class="offline-actions">
      <button
        v-if="offlineProgress.phase === 'completed'"
        @click="openOfflineOutputFolder"
        class="offline-open-output-btn"
      >{{ $t('offlineProcessing.openOutput') }}</button>
      <button
        v-if="offlineIsProcessing"
        @click="offlineProcessing.cancelProcessing()"
        class="cancel-btn"
      >{{ $t('offlineProcessing.cancel') }}</button>
      <button
        v-else
        @click="resetAndClose"
        class="cancel-btn"
      >{{ $t('offlineProcessing.close') }}</button>
      <button
        @click="offlineProcessing.startProcessing()"
        :disabled="!offlineInputFolderPath || offlineIsProcessing || offlineProgress.phase === 'completed'"
        class="start-btn"
      >{{ offlineIsProcessing ? $t('offlineProcessing.processing') : $t('offlineProcessing.start') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOfflineProcessing } from '../composables/useOfflineProcessing'

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
</script>

<style scoped>
.offline-processing-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 24px;
  overflow-y: auto;
}

.setting-item {
  margin-bottom: 12px;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 6px;
}

.directory-input-group {
  display: flex;
  gap: 8px;
}

.directory-input {
  flex: 1;
  padding: 6px 10px;
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
  padding: 6px 12px;
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

.offline-section-header {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin-top: 12px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #eee;
}

.offline-note {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.offline-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.phase-toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.phase-toggle-item input {
  margin: 0;
  cursor: pointer;
}

.phase-toggle-text {
  font-size: 12px;
  color: #555;
}

.offline-spacer {
  flex: 1;
}

.offline-progress-track {
  width: 100%;
  height: 4px;
  background-color: #e0e0e0;
  overflow: hidden;
  margin-bottom: 12px;
}

.offline-progress-fill {
  height: 100%;
  background-color: #007acc;
  transition: width 0.3s ease;
}

.offline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.offline-open-output-btn {
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

.offline-open-output-btn:hover {
  background-color: #007acc;
  color: white;
}

.cancel-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}

.cancel-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.start-btn {
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

.start-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.start-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .setting-label {
    color: #aaa;
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

  .offline-section-header {
    color: #ccc;
    border-bottom-color: #404040;
  }

  .offline-note {
    color: #888;
  }

  .phase-toggle-text {
    color: #ccc;
  }

  .offline-progress-track {
    background-color: #404040;
  }

  .offline-progress-fill {
    background-color: #4a9eff;
  }

  .offline-actions {
    border-top-color: #404040;
  }

  .offline-open-output-btn {
    background-color: #2d2d2d;
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .offline-open-output-btn:hover {
    background-color: #4a9eff;
    color: #1e1e1e;
  }

  .cancel-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .cancel-btn:hover {
    background-color: #404040;
    border-color: #666;
  }
}
</style>
