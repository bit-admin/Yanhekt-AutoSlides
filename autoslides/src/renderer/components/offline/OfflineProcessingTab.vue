<template>
  <div class="h-full overflow-hidden">
    <div class="flex h-full">
      <!-- Left Column: Offline Post-Processing -->
      <div class="flex-1 flex flex-col p-6 overflow-y-auto border-r border-border">
        <h3 class="m-0 mb-5 text-[15px] font-semibold text-text pb-2.5 border-b border-border">{{ $t('offlineProcessing.title') }}</h3>

        <!-- Input Folder -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.inputFolder') }}</label>
          <div class="flex gap-2">
            <input
              :value="offlineInputFolderPath || $t('offlineProcessing.noFolderSelected')"
              type="text"
              readonly
              class="flex-1 py-[7px] px-2.5 border border-border-input rounded text-xs bg-subtle text-text"
              :class="{ 'text-text-muted': !offlineInputFolderPath }"
              :title="offlineInputFolderPath"
            />
            <button @click="offlineProcessing.selectInputFolder()" class="py-[7px] px-3.5 border border-border-input rounded bg-surface text-xs cursor-pointer whitespace-nowrap transition-all hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed" :disabled="offlineIsProcessing">
              {{ $t('offlineProcessing.selectFolder') }}
            </button>
          </div>
        </div>

        <!-- Post-Processing Configuration -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.postProcessingConfig') }}</label>
          <div class="flex flex-col gap-1.5">
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="offlineEnableDuplicateRemoval" :disabled="offlineIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.enableDuplicateRemoval') }}</span>
            </label>
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="offlineEnableExclusionList" :disabled="offlineIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.enableExclusionList') }}</span>
            </label>
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="offlineEnableAIFiltering" :disabled="offlineIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.enableAIFiltering') }}</span>
            </label>
          </div>
          <div class="text-[11px] text-text-muted mt-1.5">{{ $t('offlineProcessing.exclusionListNote') }}</div>
        </div>

        <!-- Output Options -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="flex flex-col gap-1.5">
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="offlineEnablePngColorReduction" :disabled="offlineIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer to push controls to bottom -->
        <div class="flex-1"></div>

        <!-- Progress bar -->
        <div v-if="offlineProgress.phase !== 'idle' && offlineProgress.phase !== 'error'" class="w-full h-1 bg-border rounded-sm overflow-hidden mb-4">
          <div class="h-full bg-accent transition-[width] duration-300 ease-in-out" :style="{ width: overallOfflineProgress + '%' }"></div>
        </div>

        <div v-if="offlineProgress.errorMessage && !offlineIsProcessing" class="text-xs mb-3 text-danger">
          {{
            offlineProgress.errorMessage === 'noImagesFound'
              ? $t('offlineProcessing.noImagesFound')
              : offlineProgress.errorMessage
          }}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-4 border-t border-border">
          <button
            v-if="offlineProgress.phase === 'completed'"
            @click="openOfflineOutputFolder"
            class="py-2 px-4 border border-accent rounded text-xs cursor-pointer transition-all bg-surface text-accent mr-auto hover:bg-accent hover:text-white"
          >{{ $t('offlineProcessing.openOutput') }}</button>
          <button
            v-if="offlineIsProcessing"
            @click="offlineProcessing.cancelProcessing()"
            class="py-2 px-4 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all ml-auto hover:bg-hover hover:border-border"
          >{{ $t('offlineProcessing.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="py-2 px-4 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all ml-auto hover:bg-hover hover:border-border"
          >{{ $t('offlineProcessing.close') }}</button>
          <button
            @click="offlineProcessing.startProcessing()"
            :disabled="!offlineInputFolderPath || offlineIsProcessing || offlineProgress.phase === 'completed'"
            class="py-2 px-4 border-none rounded bg-accent text-white text-xs font-medium cursor-pointer transition-all hover:bg-accent-strong disabled:bg-border disabled:cursor-not-allowed"
          >{{ offlineIsProcessing ? $t('offlineProcessing.processing') : $t('offlineProcessing.start') }}</button>
        </div>
      </div>

      <!-- Right Column: Auto Crop -->
      <div class="flex-1 flex flex-col p-6 overflow-y-auto">
        <h3 class="m-0 mb-5 text-[15px] font-semibold text-text pb-2.5 border-b border-border">{{ $t('offlineProcessing.autoCrop.title') }}</h3>

        <!-- Input Images -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.autoCrop.inputImages') }}</label>
          <div class="flex gap-2">
            <input
              :value="autoCropSelectedImagePaths.length === 0
                ? $t('offlineProcessing.autoCrop.noImagesSelected')
                : $t('offlineProcessing.autoCrop.imagesSelected', { count: autoCropSelectedImagePaths.length })"
              type="text"
              readonly
              class="flex-1 py-[7px] px-2.5 border border-border-input rounded text-xs bg-subtle text-text"
              :class="{ 'text-text-muted': autoCropSelectedImagePaths.length === 0 }"
            />
            <button @click="autoCrop.selectImages()" class="py-[7px] px-3.5 border border-border-input rounded bg-surface text-xs cursor-pointer whitespace-nowrap transition-all hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed" :disabled="autoCropIsProcessing">
              {{ $t('offlineProcessing.autoCrop.select') }}
            </button>
          </div>
        </div>

        <!-- Configuration -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.autoCrop.config') }}</label>
          <div class="flex flex-col gap-1.5">
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="autoCropRedBoxMode" :disabled="autoCropIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.autoCrop.redBoxMode') }}</span>
            </label>
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border" :class="{ 'opacity-50 cursor-not-allowed pointer-events-none': !autoCropRedBoxMode || autoCropEdgesUnavailable }">
              <input
                type="checkbox"
                v-model="autoCropShowEdges"
                :disabled="autoCropIsProcessing || !autoCropRedBoxMode || autoCropEdgesUnavailable"
                class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span class="text-xs text-text">{{ $t('offlineProcessing.autoCrop.showEdges') }}</span>
            </label>
          </div>
        </div>

        <!-- Output Options -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-text mb-2">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="flex flex-col gap-1.5">
            <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border">
              <input type="checkbox" v-model="autoCropEnablePngColorReduction" :disabled="autoCropIsProcessing" class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent disabled:opacity-50 disabled:cursor-not-allowed" />
              <span class="text-xs text-text">{{ $t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Progress bar -->
        <div v-if="autoCropProgress.phase !== 'idle'" class="w-full h-1 bg-border rounded-sm overflow-hidden mb-4">
          <div class="h-full bg-accent transition-[width] duration-300 ease-in-out" :style="{ width: autoCropOverallProgress + '%' }"></div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-4 border-t border-border">
          <button
            v-if="autoCropProgress.phase === 'completed' || autoCropProgress.phase === 'cancelled'"
            @click="autoCrop.openOutputFolder()"
            class="py-2 px-4 border border-accent rounded text-xs cursor-pointer transition-all bg-surface text-accent mr-auto hover:bg-accent hover:text-white"
          >{{ $t('offlineProcessing.autoCrop.openOutput') }}</button>
          <button
            v-if="autoCropIsProcessing"
            @click="autoCrop.cancelProcessing()"
            class="py-2 px-4 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all ml-auto hover:bg-hover hover:border-border"
          >{{ $t('offlineProcessing.autoCrop.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="py-2 px-4 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all ml-auto hover:bg-hover hover:border-border"
          >{{ $t('offlineProcessing.autoCrop.close') }}</button>
          <button
            @click="autoCrop.startProcessing()"
            :disabled="autoCropSelectedImagePaths.length === 0 || autoCropIsProcessing || autoCropProgress.phase === 'completed'"
            class="py-2 px-4 border-none rounded bg-accent text-white text-xs font-medium cursor-pointer transition-all hover:bg-accent-strong disabled:bg-border disabled:cursor-not-allowed"
          >{{ autoCropIsProcessing ? $t('offlineProcessing.autoCrop.processing') : $t('offlineProcessing.autoCrop.start') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOfflineProcessing } from '@features/offline/useOfflineProcessing'
import { useAutoCrop } from '@features/offline/useAutoCrop'

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
