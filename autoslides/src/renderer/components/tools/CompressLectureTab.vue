<template>
  <div class="h-full overflow-hidden flex flex-col">
    <div class="flex-1 overflow-y-auto px-7 py-[14px] flex flex-col gap-4">
      <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold text-text">{{ $t('compressLecture.inputFile') }}</label>
      <div class="flex gap-2">
        <input
          :value="inputPath || $t('compressLecture.noInputSelected')"
          type="text"
          readonly
          class="flex-1 min-w-0 w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-subtle text-text"
          :class="{ 'text-text-muted': !inputPath }"
          :title="inputPath"
        />
        <button class="min-w-[104px] rounded border border-border-input bg-input text-xs py-[7px] px-3.5 cursor-pointer hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed" @click="selectInput" :disabled="isRunning">
          {{ $t('compressLecture.browse') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold text-text">{{ $t('compressLecture.outputFile') }}</label>
      <div class="flex gap-2">
        <input
          :value="outputPath || suggestedOutputPath || $t('compressLecture.autoOutputHint')"
          type="text"
          readonly
          class="flex-1 min-w-0 w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-subtle text-text"
          :class="{ 'text-text-muted': !outputPath && !suggestedOutputPath }"
          :title="outputPath || suggestedOutputPath"
        />
        <button class="min-w-[104px] rounded border border-border-input bg-input text-xs py-[7px] px-3.5 cursor-pointer hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed" @click="selectOutput" :disabled="isRunning || !inputPath">
          {{ $t('compressLecture.browse') }}
        </button>
        <button
          v-if="hasCustomOutputPath"
          class="rounded border border-border-input bg-input text-xs py-[7px] px-3.5 cursor-pointer hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
          @click="useSuggestedOutput"
          :disabled="isRunning || !inputPath"
        >
          {{ $t('compressLecture.useAutoOutput') }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 max-[980px]:grid-cols-1 gap-y-3 gap-x-[18px]">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.videoPreset') }}</label>
        <select v-model="preset" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="tiny">{{ $t('compressLecture.presetTiny') }}</option>
          <option value="small">{{ $t('compressLecture.presetSmall') }}</option>
          <option value="readable">{{ $t('compressLecture.presetReadable') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.cropMode') }}</label>
        <select v-model="cropMode" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.cropNone') }}</option>
          <option value="4:3">{{ $t('compressLecture.crop43') }}</option>
          <option value="auto">{{ $t('compressLecture.cropAuto') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.videoFilter') }}</label>
        <select v-model="filterMode" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.filterNone') }}</option>
          <option value="denoise">{{ $t('compressLecture.filterDenoise') }}</option>
          <option value="sharpen">{{ $t('compressLecture.filterSharpen') }}</option>
          <option value="both">{{ $t('compressLecture.filterBoth') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.scaler') }}</label>
        <select v-model="scaler" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="lanczos">lanczos</option>
          <option value="bicubic">bicubic</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.audioPreset') }}</label>
        <select v-model="audioPreset" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="low">{{ $t('compressLecture.audioLow') }}</option>
          <option value="mid">{{ $t('compressLecture.audioMid') }}</option>
          <option value="high">{{ $t('compressLecture.audioHigh') }}</option>
          <option value="max">{{ $t('compressLecture.audioMax') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.audioFilter') }}</label>
        <select v-model="audioFilterPreset" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.audioFilterNone') }}</option>
          <option value="clean">{{ $t('compressLecture.audioFilterClean') }}</option>
          <option value="speech">{{ $t('compressLecture.audioFilterSpeech') }}</option>
          <option value="strong">{{ $t('compressLecture.audioFilterStrong') }}</option>
          <option value="loudnorm">{{ $t('compressLecture.audioFilterLoudnorm') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.container') }}</label>
        <select v-model="container" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
          <option value="mp4">mp4</option>
          <option value="mkv">mkv</option>
        </select>
      </div>

      <div class="flex flex-col gap-2 justify-end">
        <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all duration-200 hover:bg-hover hover:border-border-strong [&>input]:m-0 [&>input]:cursor-pointer [&>input]:w-3.5 [&>input]:h-3.5 [&>input]:accent-accent [&>input:disabled]:opacity-50 [&>input:disabled]:cursor-not-allowed">
          <input type="checkbox" v-model="keepAac" :disabled="isRunning" />
          <span class="text-xs text-text">{{ $t('compressLecture.keepAac') }}</span>
        </label>
      </div>

      <template v-if="!keepAac">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-text">{{ $t('compressLecture.opusVbr') }}</label>
          <select v-model="opusVbr" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
            <option value="on">on</option>
            <option value="constrained">constrained</option>
            <option value="off">off</option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-text">{{ $t('compressLecture.opusFrameDuration') }}</label>
          <select v-model="opusFrameDuration" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning">
            <option :value="20">20</option>
            <option :value="40">40</option>
            <option :value="60">60</option>
          </select>
        </div>
      </template>

      <div class="flex flex-col gap-2 col-span-2 max-[980px]:col-span-1">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.x265Params') }}</label>
        <input v-model="x265Params" type="text" class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isRunning" />
      </div>
    </div>

    <div class="flex gap-2 flex-wrap">
      <button class="rounded border border-border-input bg-input text-xs py-[7px] px-3.5 cursor-pointer hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed" @click="preview" :disabled="isRunning || !inputPath">
        {{ $t('compressLecture.previewCommand') }}
      </button>
      <button
        v-if="isRunning"
        class="rounded border border-danger bg-input text-danger text-xs py-[7px] px-3.5 cursor-pointer hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="cancel"
      >
        {{ $t('compressLecture.cancel') }}
      </button>
      <button
        v-else
        class="rounded border-none bg-accent text-white text-xs py-[7px] px-3.5 cursor-pointer hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
        @click="start"
        :disabled="!canStart"
      >
        {{ $t('compressLecture.start') }}
      </button>
      <button
        class="rounded border border-border-input bg-input text-xs py-[7px] px-3.5 cursor-pointer hover:bg-hover hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
        @click="openOutput"
        :disabled="!lastOutputPath && !outputPath"
      >
        {{ $t('compressLecture.openOutput') }}
      </button>
    </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-text">{{ $t('compressLecture.commandPreview') }}</label>
        <textarea
          :value="previewCommand"
          class="w-full border border-border-input rounded text-xs py-[7px] px-2.5 bg-input text-text min-h-[110px] font-mono resize-y"
          rows="5"
          readonly
          :placeholder="$t('compressLecture.commandPreviewPlaceholder')"
        ></textarea>
        <div v-if="previewResult" class="grid grid-cols-3 max-[980px]:grid-cols-1 gap-2 text-xs text-text-secondary">
          <div>{{ $t('compressLecture.sourceSize') }}: {{ previewResult.sourceWidth }}&#215;{{ previewResult.sourceHeight }}</div>
          <div>{{ $t('compressLecture.targetSize') }}: {{ previewResult.targetWidth }}&#215;{{ previewResult.targetHeight }}</div>
          <div>{{ $t('compressLecture.contentAspect') }}: {{ previewResult.contentAspect }}</div>
        </div>
      </div>
    </div>

    <div v-if="status === 'running'" class="shrink-0 h-[3px] bg-border w-full overflow-hidden">
      <div class="h-full bg-accent transition-[width] duration-150 ease-out" :style="{ width: `${fakeProgress}%` }"></div>
    </div>

    <div class="shrink-0 min-h-[30px] py-1.5 px-4 flex items-center bg-subtle border-t border-border">
      <div v-if="status !== 'idle'" class="flex gap-2.5 items-center text-xs">
        <span class="text-text font-medium">{{ statusText }}</span>
        <span v-if="status === 'running'" class="text-text-secondary">{{ $t('compressLecture.runningHint') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCompressLecture } from '@features/tools/useCompressLecture'

const { t } = useI18n()

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
