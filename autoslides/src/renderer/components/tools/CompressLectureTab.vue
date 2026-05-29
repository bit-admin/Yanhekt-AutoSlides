<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-7 py-3.5">
      <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.inputFile') }}</label>
      <div class="flex gap-2">
        <input
          :value="inputPath || $t('compressLecture.noInputSelected')"
          type="text"
          readonly
          :class="[pathInputCls, inputPath ? 'text-fg' : 'text-fg-muted']"
          :title="inputPath"
        />
        <button :class="[btnNeutral, 'min-w-[104px]']" @click="selectInput" :disabled="isRunning">
          {{ $t('compressLecture.browse') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.outputFile') }}</label>
      <div class="flex gap-2">
        <input
          :value="outputPath || suggestedOutputPath || $t('compressLecture.autoOutputHint')"
          type="text"
          readonly
          :class="[pathInputCls, (outputPath || suggestedOutputPath) ? 'text-fg' : 'text-fg-muted']"
          :title="outputPath || suggestedOutputPath"
        />
        <button :class="[btnNeutral, 'min-w-[104px]']" @click="selectOutput" :disabled="isRunning || !inputPath">
          {{ $t('compressLecture.browse') }}
        </button>
        <button
          v-if="hasCustomOutputPath"
          :class="btnNeutral"
          @click="useSuggestedOutput"
          :disabled="isRunning || !inputPath"
        >
          {{ $t('compressLecture.useAutoOutput') }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-x-[18px] gap-y-3 max-[980px]:grid-cols-1">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.videoPreset') }}</label>
        <select v-model="preset" :class="fieldSel" :disabled="isRunning">
          <option value="tiny">{{ $t('compressLecture.presetTiny') }}</option>
          <option value="small">{{ $t('compressLecture.presetSmall') }}</option>
          <option value="readable">{{ $t('compressLecture.presetReadable') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.cropMode') }}</label>
        <select v-model="cropMode" :class="fieldSel" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.cropNone') }}</option>
          <option value="4:3">{{ $t('compressLecture.crop43') }}</option>
          <option value="auto">{{ $t('compressLecture.cropAuto') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.videoFilter') }}</label>
        <select v-model="filterMode" :class="fieldSel" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.filterNone') }}</option>
          <option value="denoise">{{ $t('compressLecture.filterDenoise') }}</option>
          <option value="sharpen">{{ $t('compressLecture.filterSharpen') }}</option>
          <option value="both">{{ $t('compressLecture.filterBoth') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.scaler') }}</label>
        <select v-model="scaler" :class="fieldSel" :disabled="isRunning">
          <option value="lanczos">lanczos</option>
          <option value="bicubic">bicubic</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.audioPreset') }}</label>
        <select v-model="audioPreset" :class="fieldSel" :disabled="isRunning">
          <option value="low">{{ $t('compressLecture.audioLow') }}</option>
          <option value="mid">{{ $t('compressLecture.audioMid') }}</option>
          <option value="high">{{ $t('compressLecture.audioHigh') }}</option>
          <option value="max">{{ $t('compressLecture.audioMax') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.audioFilter') }}</label>
        <select v-model="audioFilterPreset" :class="fieldSel" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.audioFilterNone') }}</option>
          <option value="clean">{{ $t('compressLecture.audioFilterClean') }}</option>
          <option value="speech">{{ $t('compressLecture.audioFilterSpeech') }}</option>
          <option value="strong">{{ $t('compressLecture.audioFilterStrong') }}</option>
          <option value="loudnorm">{{ $t('compressLecture.audioFilterLoudnorm') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.container') }}</label>
        <select v-model="container" :class="fieldSel" :disabled="isRunning">
          <option value="mp4">mp4</option>
          <option value="mkv">mkv</option>
        </select>
      </div>

      <div class="flex justify-end">
        <label :class="ccToggleItem">
          <input type="checkbox" class="h-3.5 w-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50" v-model="keepAac" :disabled="isRunning" />
          <span class="text-xs text-fg">{{ $t('compressLecture.keepAac') }}</span>
        </label>
      </div>

      <template v-if="!keepAac">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.opusVbr') }}</label>
          <select v-model="opusVbr" :class="fieldSel" :disabled="isRunning">
            <option value="on">on</option>
            <option value="constrained">constrained</option>
            <option value="off">off</option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.opusFrameDuration') }}</label>
          <select v-model="opusFrameDuration" :class="fieldSel" :disabled="isRunning">
            <option :value="20">20</option>
            <option :value="40">40</option>
            <option :value="60">60</option>
          </select>
        </div>
      </template>

      <div class="col-span-2 flex flex-col gap-2 max-[980px]:col-span-1">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.x265Params') }}</label>
        <input v-model="x265Params" type="text" :class="fieldCls" :disabled="isRunning" />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button :class="btnNeutral" @click="preview" :disabled="isRunning || !inputPath">
        {{ $t('compressLecture.previewCommand') }}
      </button>
      <button
        v-if="isRunning"
        :class="btnDanger"
        @click="cancel"
      >
        {{ $t('compressLecture.cancel') }}
      </button>
      <button
        v-else
        :class="btnPrimary"
        @click="start"
        :disabled="!canStart"
      >
        {{ $t('compressLecture.start') }}
      </button>
      <button
        :class="btnNeutral"
        @click="openOutput"
        :disabled="!lastOutputPath && !outputPath"
      >
        {{ $t('compressLecture.openOutput') }}
      </button>
    </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-fg">{{ $t('compressLecture.commandPreview') }}</label>
        <textarea
          :value="previewCommand"
          :class="[fieldCls, 'min-h-[110px] resize-y font-mono']"
          rows="5"
          readonly
          :placeholder="$t('compressLecture.commandPreviewPlaceholder')"
        ></textarea>
        <div v-if="previewResult" class="grid grid-cols-3 gap-2 text-xs text-fg-secondary max-[980px]:grid-cols-1">
          <div>{{ $t('compressLecture.sourceSize') }}: {{ previewResult.sourceWidth }}×{{ previewResult.sourceHeight }}</div>
          <div>{{ $t('compressLecture.targetSize') }}: {{ previewResult.targetWidth }}×{{ previewResult.targetHeight }}</div>
          <div>{{ $t('compressLecture.contentAspect') }}: {{ previewResult.contentAspect }}</div>
        </div>
      </div>
    </div>

    <div v-if="status === 'running'" class="h-[3px] w-full flex-shrink-0 overflow-hidden bg-[#e0e0e0] dark:bg-[#3a3a3a]">
      <div class="h-full bg-accent transition-[width] duration-150" :style="{ width: `${fakeProgress}%` }"></div>
    </div>

    <div class="flex min-h-[30px] flex-shrink-0 items-center border-t border-line bg-[#fafafa] px-4 py-1.5 dark:bg-[#252525]">
      <div v-if="status !== 'idle'" class="flex items-center gap-2.5 text-xs">
        <span class="font-medium text-fg">{{ statusText }}</span>
        <span v-if="status === 'running'" class="text-fg-secondary">{{ $t('compressLecture.runningHint') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCompressLecture } from '@features/tools/useCompressLecture'

const { t } = useI18n()

const fieldCls = 'w-full rounded border border-line-input bg-surface px-2.5 py-[7px] text-xs text-fg dark:border-[#4a4a4a] dark:bg-[#2b2b2b]'
const fieldSel = 'w-full cursor-pointer rounded border border-line-input bg-surface px-2.5 py-[7px] text-xs text-fg disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4a4a4a] dark:bg-[#2b2b2b]'
const btnNeutral = 'rounded border border-line-input bg-surface px-3.5 py-[7px] text-xs text-fg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4a4a4a] dark:bg-[#2b2b2b] dark:text-[#ddd]'
const btnPrimary = 'rounded border border-accent bg-accent px-3.5 py-[7px] text-xs text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3a8edb] dark:bg-[#3a8edb]'
const btnDanger = 'rounded border border-[#d9534f] bg-surface px-3.5 py-[7px] text-xs text-[#d9534f] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2b2b2b]'
const pathInputCls = 'min-w-0 flex-1 truncate rounded border border-line-input bg-[#fafafa] px-2.5 py-[7px] text-xs dark:border-[#4a4a4a] dark:bg-[#242424]'
const ccToggleItem = 'flex cursor-pointer items-center gap-2 rounded border border-[#ddd] bg-[#f8f9fa] px-2.5 py-2 transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:border-[#404040] dark:bg-[#2a2a2a] dark:hover:border-[#555] dark:hover:bg-[#333]'

const {
  inputPath,
  outputPath,
  hasCustomOutputPath,
  preset,
  audioPreset,
  audioFilterPreset,
  cropMode,
  filterMode,
  scaler,
  container,
  opusVbr,
  opusFrameDuration,
  keepAac,
  x265Params,
  isRunning,
  status,
  statusMessage,
  fakeProgress,
  previewResult,
  previewCommand,
  canStart,
  suggestedOutputPath,
  lastOutputPath,
  selectInput,
  selectOutput,
  useSuggestedOutput,
  preview,
  start,
  cancel,
  openOutput
} = useCompressLecture()

const statusText = computed(() => {
  if (status.value === 'previewing') return t('compressLecture.statusPreviewing')
  if (status.value === 'running') return t('compressLecture.statusRunning')
  if (status.value === 'completed') return t('compressLecture.statusCompleted')
  if (status.value === 'cancelled') return t('compressLecture.statusCancelled')
  if (status.value === 'error') {
    if (statusMessage.value === 'missingInput') {
      return t('compressLecture.missingInput')
    }
    return statusMessage.value || t('compressLecture.statusError')
  }
  return ''
})
</script>

