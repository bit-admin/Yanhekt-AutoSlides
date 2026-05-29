<template>
  <div class="h-full overflow-hidden">
    <div class="flex h-full">
      <!-- Left Column: Offline Post-Processing -->
      <div class="flex flex-1 flex-col overflow-y-auto p-6 [&:first-child]:border-r [&:first-child]:border-line">
        <h3 class="m-0 mb-5 border-b border-line pb-2.5 text-[15px] font-semibold text-fg">{{$t('offlineProcessing.title') }}</h3>

        <!-- Input Folder -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.inputFolder') }}</label>
          <div class="flex gap-2">
            <input
              :value="offlineInputFolderPath || $t('offlineProcessing.noFolderSelected')"
              type="text"
              readonly
              :class="[dirInput, offlineInputFolderPath ? 'text-fg' : 'text-fg-muted']"
              :title="offlineInputFolderPath"
            />
            <button @click="offlineProcessing.selectInputFolder()" :class="browseBtn" :disabled="offlineIsProcessing">
              {{ $t('offlineProcessing.selectFolder') }}
            </button>
          </div>
        </div>

        <!-- Post-Processing Configuration -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.postProcessingConfig') }}</label>
          <div class="flex flex-col gap-1.5">
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="offlineEnableDuplicateRemoval" :disabled="offlineIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.enableDuplicateRemoval') }}</span>
            </label>
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="offlineEnableExclusionList" :disabled="offlineIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.enableExclusionList') }}</span>
            </label>
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="offlineEnableAIFiltering" :disabled="offlineIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.enableAIFiltering') }}</span>
            </label>
          </div>
          <div class="mt-1.5 text-[11px] text-fg-muted">{{ $t('offlineProcessing.exclusionListNote') }}</div>
        </div>

        <!-- Output Options -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="flex flex-col gap-1.5">
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="offlineEnablePngColorReduction" :disabled="offlineIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer to push controls to bottom -->
        <div class="flex-1"></div>

        <!-- Progress bar -->
        <div v-if="offlineProgress.phase !== 'idle' && offlineProgress.phase !== 'error'" class="mb-4 h-1 w-full overflow-hidden rounded-[2px] bg-[#e0e0e0] dark:bg-[#404040]">
          <div class="h-full bg-accent transition-[width] duration-300" :style="{ width: overallOfflineProgress + '%' }"></div>
        </div>

        <div v-if="offlineProgress.errorMessage && !offlineIsProcessing" class="mb-3 text-xs text-[#c62828] dark:text-[#ff8a80]">
          {{
            offlineProgress.errorMessage === 'noImagesFound'
              ? $t('offlineProcessing.noImagesFound')
              : offlineProgress.errorMessage
          }}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 border-t border-line pt-4">
          <button
            v-if="offlineProgress.phase === 'completed'"
            @click="openOfflineOutputFolder"
            class="mr-auto cursor-pointer rounded border border-accent bg-surface px-4 py-2 text-xs text-accent transition-colors hover:bg-accent hover:text-white dark:bg-[#2d2d2d]"
          >{{ $t('offlineProcessing.openOutput') }}</button>
          <button
            v-if="offlineIsProcessing"
            @click="offlineProcessing.cancelProcessing()"
            class="ml-auto cursor-pointer rounded border border-line-input bg-surface px-4 py-2 text-xs text-fg transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#333] dark:hover:border-[#666] dark:hover:bg-[#404040]"
          >{{ $t('offlineProcessing.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="ml-auto cursor-pointer rounded border border-line-input bg-surface px-4 py-2 text-xs text-fg transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#333] dark:hover:border-[#666] dark:hover:bg-[#404040]"
          >{{ $t('offlineProcessing.close') }}</button>
          <button
            @click="offlineProcessing.startProcessing()"
            :disabled="!offlineInputFolderPath || offlineIsProcessing || offlineProgress.phase === 'completed'"
            class="cursor-pointer rounded border-none bg-accent px-4 py-2 text-xs font-medium text-white transition-colors enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-[#ccc]"
          >{{ offlineIsProcessing ? $t('offlineProcessing.processing') : $t('offlineProcessing.start') }}</button>
        </div>
      </div>

      <!-- Right Column: Auto Crop -->
      <div class="flex flex-1 flex-col overflow-y-auto p-6 [&:first-child]:border-r [&:first-child]:border-line">
        <h3 class="m-0 mb-5 border-b border-line pb-2.5 text-[15px] font-semibold text-fg">{{$t('offlineProcessing.autoCrop.title') }}</h3>

        <!-- Input Images -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.autoCrop.inputImages') }}</label>
          <div class="flex gap-2">
            <input
              :value="autoCropSelectedImagePaths.length === 0
                ? $t('offlineProcessing.autoCrop.noImagesSelected')
                : $t('offlineProcessing.autoCrop.imagesSelected', { count: autoCropSelectedImagePaths.length })"
              type="text"
              readonly
              :class="[dirInput, autoCropSelectedImagePaths.length === 0 ? 'text-fg-muted' : 'text-fg']"
            />
            <button @click="autoCrop.selectImages()" :class="browseBtn" :disabled="autoCropIsProcessing">
              {{ $t('offlineProcessing.autoCrop.select') }}
            </button>
          </div>
        </div>

        <!-- Configuration -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.autoCrop.config') }}</label>
          <div class="flex flex-col gap-1.5">
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="autoCropRedBoxMode" :disabled="autoCropIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.autoCrop.redBoxMode') }}</span>
            </label>
            <label :class="[toggleItem, { 'pointer-events-none cursor-not-allowed opacity-50': !autoCropRedBoxMode || autoCropEdgesUnavailable }]">
              <input
                type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                v-model="autoCropShowEdges"
                :disabled="autoCropIsProcessing || !autoCropRedBoxMode || autoCropEdgesUnavailable"
              />
              <span class="text-xs text-fg">{{$t('offlineProcessing.autoCrop.showEdges') }}</span>
            </label>
          </div>
        </div>

        <!-- Output Options -->
        <div class="mb-5">
          <label class="mb-2 block text-xs font-semibold text-fg">{{ $t('offlineProcessing.outputOptions') }}</label>
          <div class="flex flex-col gap-1.5">
            <label :class="toggleItem">
              <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="autoCropEnablePngColorReduction" :disabled="autoCropIsProcessing" />
              <span class="text-xs text-fg">{{$t('offlineProcessing.enablePngColorReduction') }}</span>
            </label>
          </div>
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Progress bar -->
        <div v-if="autoCropProgress.phase !== 'idle'" class="mb-4 h-1 w-full overflow-hidden rounded-[2px] bg-[#e0e0e0] dark:bg-[#404040]">
          <div class="h-full bg-accent transition-[width] duration-300" :style="{ width: autoCropOverallProgress + '%' }"></div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 border-t border-line pt-4">
          <button
            v-if="autoCropProgress.phase === 'completed' || autoCropProgress.phase === 'cancelled'"
            @click="autoCrop.openOutputFolder()"
            class="mr-auto cursor-pointer rounded border border-accent bg-surface px-4 py-2 text-xs text-accent transition-colors hover:bg-accent hover:text-white dark:bg-[#2d2d2d]"
          >{{ $t('offlineProcessing.autoCrop.openOutput') }}</button>
          <button
            v-if="autoCropIsProcessing"
            @click="autoCrop.cancelProcessing()"
            class="ml-auto cursor-pointer rounded border border-line-input bg-surface px-4 py-2 text-xs text-fg transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#333] dark:hover:border-[#666] dark:hover:bg-[#404040]"
          >{{ $t('offlineProcessing.autoCrop.cancel') }}</button>
          <button
            v-else
            @click="resetAndClose"
            class="ml-auto cursor-pointer rounded border border-line-input bg-surface px-4 py-2 text-xs text-fg transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#333] dark:hover:border-[#666] dark:hover:bg-[#404040]"
          >{{ $t('offlineProcessing.autoCrop.close') }}</button>
          <button
            @click="autoCrop.startProcessing()"
            :disabled="autoCropSelectedImagePaths.length === 0 || autoCropIsProcessing || autoCropProgress.phase === 'completed'"
            class="cursor-pointer rounded border-none bg-accent px-4 py-2 text-xs font-medium text-white transition-colors enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-[#ccc]"
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

const browseBtn = 'whitespace-nowrap rounded border border-line-input bg-surface px-3.5 py-[7px] text-xs text-fg cursor-pointer transition-colors enabled:hover:border-[#ccc] enabled:hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#333] dark:enabled:hover:border-[#666] dark:enabled:hover:bg-[#404040]'
const toggleItem = 'flex cursor-pointer items-center gap-2 rounded border border-[#ddd] bg-[#f8f9fa] px-2.5 py-2 transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:border-[#404040] dark:bg-[#2a2a2a] dark:hover:border-[#555] dark:hover:bg-[#333]'
const dirInput = 'min-w-0 flex-1 truncate rounded border border-line-input bg-[#fafafa] px-2.5 py-[7px] text-xs dark:bg-[#2d2d2d]'

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

