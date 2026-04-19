<template>
  <div class="compress-lecture-tab">
    <div class="scroll-content">
      <div class="setting-group">
      <label class="setting-label">{{ $t('compressLecture.inputFile') }}</label>
      <div class="path-row">
        <input
          :value="inputPath || $t('compressLecture.noInputSelected')"
          type="text"
          readonly
          class="path-input"
          :class="{ 'placeholder-text': !inputPath }"
          :title="inputPath"
        />
        <button class="browse-btn" @click="selectInput" :disabled="isRunning">
          {{ $t('compressLecture.browse') }}
        </button>
      </div>
    </div>

    <div class="setting-group">
      <label class="setting-label">{{ $t('compressLecture.outputFile') }}</label>
      <div class="path-row">
        <input
          :value="outputPath || suggestedOutputPath || $t('compressLecture.autoOutputHint')"
          type="text"
          readonly
          class="path-input"
          :class="{ 'placeholder-text': !outputPath && !suggestedOutputPath }"
          :title="outputPath || suggestedOutputPath"
        />
        <button class="browse-btn" @click="selectOutput" :disabled="isRunning || !inputPath">
          {{ $t('compressLecture.browse') }}
        </button>
        <button
          v-if="hasCustomOutputPath"
          class="secondary-btn"
          @click="useSuggestedOutput"
          :disabled="isRunning || !inputPath"
        >
          {{ $t('compressLecture.useAutoOutput') }}
        </button>
      </div>
    </div>

    <div class="settings-grid">
      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.videoPreset') }}</label>
        <select v-model="preset" class="select-input" :disabled="isRunning">
          <option value="tiny">{{ $t('compressLecture.presetTiny') }}</option>
          <option value="small">{{ $t('compressLecture.presetSmall') }}</option>
          <option value="readable">{{ $t('compressLecture.presetReadable') }}</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.cropMode') }}</label>
        <select v-model="cropMode" class="select-input" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.cropNone') }}</option>
          <option value="4:3">{{ $t('compressLecture.crop43') }}</option>
          <option value="auto">{{ $t('compressLecture.cropAuto') }}</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.videoFilter') }}</label>
        <select v-model="filterMode" class="select-input" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.filterNone') }}</option>
          <option value="denoise">{{ $t('compressLecture.filterDenoise') }}</option>
          <option value="sharpen">{{ $t('compressLecture.filterSharpen') }}</option>
          <option value="both">{{ $t('compressLecture.filterBoth') }}</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.scaler') }}</label>
        <select v-model="scaler" class="select-input" :disabled="isRunning">
          <option value="lanczos">lanczos</option>
          <option value="bicubic">bicubic</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.audioPreset') }}</label>
        <select v-model="audioPreset" class="select-input" :disabled="isRunning">
          <option value="low">{{ $t('compressLecture.audioLow') }}</option>
          <option value="mid">{{ $t('compressLecture.audioMid') }}</option>
          <option value="high">{{ $t('compressLecture.audioHigh') }}</option>
          <option value="max">{{ $t('compressLecture.audioMax') }}</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.audioFilter') }}</label>
        <select v-model="audioFilterPreset" class="select-input" :disabled="isRunning">
          <option value="none">{{ $t('compressLecture.audioFilterNone') }}</option>
          <option value="clean">{{ $t('compressLecture.audioFilterClean') }}</option>
          <option value="speech">{{ $t('compressLecture.audioFilterSpeech') }}</option>
          <option value="strong">{{ $t('compressLecture.audioFilterStrong') }}</option>
          <option value="loudnorm">{{ $t('compressLecture.audioFilterLoudnorm') }}</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">{{ $t('compressLecture.container') }}</label>
        <select v-model="container" class="select-input" :disabled="isRunning">
          <option value="mp4">mp4</option>
          <option value="mkv">mkv</option>
        </select>
      </div>

      <div class="setting-group setting-group-checkbox">
        <label class="toggle-item">
          <input type="checkbox" v-model="keepAac" :disabled="isRunning" />
          <span class="toggle-text">{{ $t('compressLecture.keepAac') }}</span>
        </label>
      </div>

      <template v-if="!keepAac">
        <div class="setting-group">
          <label class="setting-label">{{ $t('compressLecture.opusVbr') }}</label>
          <select v-model="opusVbr" class="select-input" :disabled="isRunning">
            <option value="on">on</option>
            <option value="constrained">constrained</option>
            <option value="off">off</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">{{ $t('compressLecture.opusFrameDuration') }}</label>
          <select v-model="opusFrameDuration" class="select-input" :disabled="isRunning">
            <option :value="20">20</option>
            <option :value="40">40</option>
            <option :value="60">60</option>
          </select>
        </div>
      </template>

      <div class="setting-group setting-group-full">
        <label class="setting-label">{{ $t('compressLecture.x265Params') }}</label>
        <input v-model="x265Params" type="text" class="text-input" :disabled="isRunning" />
      </div>
    </div>

    <div class="action-row">
      <button class="secondary-btn" @click="preview" :disabled="isRunning || !inputPath">
        {{ $t('compressLecture.previewCommand') }}
      </button>
      <button
        v-if="isRunning"
        class="danger-btn"
        @click="cancel"
      >
        {{ $t('compressLecture.cancel') }}
      </button>
      <button
        v-else
        class="primary-btn"
        @click="start"
        :disabled="!canStart"
      >
        {{ $t('compressLecture.start') }}
      </button>
      <button
        class="secondary-btn"
        @click="openOutput"
        :disabled="!lastOutputPath && !outputPath"
      >
        {{ $t('compressLecture.openOutput') }}
      </button>
    </div>

      <div class="preview-block">
        <label class="setting-label">{{ $t('compressLecture.commandPreview') }}</label>
        <textarea
          :value="previewCommand"
          class="command-preview"
          rows="5"
          readonly
          :placeholder="$t('compressLecture.commandPreviewPlaceholder')"
        ></textarea>
        <div v-if="previewResult" class="summary-grid">
          <div>{{ $t('compressLecture.sourceSize') }}: {{ previewResult.sourceWidth }}×{{ previewResult.sourceHeight }}</div>
          <div>{{ $t('compressLecture.targetSize') }}: {{ previewResult.targetWidth }}×{{ previewResult.targetHeight }}</div>
          <div>{{ $t('compressLecture.contentAspect') }}: {{ previewResult.contentAspect }}</div>
        </div>
      </div>
    </div>

    <div v-if="status === 'running'" class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${fakeProgress}%` }"></div>
    </div>

    <div class="status-footer">
      <div v-if="status !== 'idle'" class="status-row">
        <span class="status-text">{{ statusText }}</span>
        <span v-if="status === 'running'" class="status-phase">{{ $t('compressLecture.runningHint') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCompressLecture } from '../composables/useCompressLecture'

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

<style scoped>
.compress-lecture-tab {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-group-full {
  grid-column: span 2;
}

.setting-group-checkbox {
  display: flex;
  justify-content: flex-end;
}

.setting-label {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.path-row {
  display: flex;
  gap: 8px;
}

.path-row .browse-btn {
  min-width: 104px;
}

.path-input {
  flex: 1 1 auto;
  min-width: 0;
}

.path-input,
.select-input,
.text-input,
.command-preview {
  width: 100%;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  padding: 7px 10px;
  background: #fff;
  color: #333;
}

.path-input {
  background: #fafafa;
}

.path-input.placeholder-text {
  color: #999;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  row-gap: 12px;
  column-gap: 18px;
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

.action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.browse-btn,
.primary-btn,
.secondary-btn,
.danger-btn {
  border-radius: 4px;
  border: 1px solid #d9d9d9;
  background: #fff;
  font-size: 12px;
  padding: 7px 14px;
  cursor: pointer;
}

.primary-btn {
  border-color: #007acc;
  background: #007acc;
  color: #fff;
}

.primary-btn:disabled,
.secondary-btn:disabled,
.browse-btn:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger-btn {
  border-color: #d9534f;
  color: #d9534f;
}

.status-row {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.status-text {
  color: #333;
  font-weight: 500;
}

.status-phase {
  color: #666;
}

.status-footer {
  flex-shrink: 0;
  min-height: 30px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  background-color: #fafafa;
  border-top: 1px solid #e0e0e0;
}

.progress-bar-container {
  flex-shrink: 0;
  height: 3px;
  background-color: #e0e0e0;
  width: 100%;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #007acc;
  transition: width 0.15s ease-out;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-preview {
  min-height: 110px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  resize: vertical;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  font-size: 12px;
  color: #555;
}

@media (max-width: 980px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .setting-group-full {
    grid-column: span 1;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .setting-label,
  .toggle-text,
  .status-text {
    color: #ddd;
  }

  .path-input,
  .select-input,
  .text-input,
  .command-preview {
    background: #2b2b2b;
    border-color: #4a4a4a;
    color: #ddd;
  }

  .path-input {
    background: #242424;
  }

  .toggle-item {
    background-color: #2a2a2a;
    border-color: #404040;
  }

  .toggle-item:hover {
    background-color: #333;
    border-color: #555;
  }

  .browse-btn,
  .secondary-btn,
  .danger-btn {
    background: #2b2b2b;
    border-color: #4a4a4a;
    color: #ddd;
  }

  .primary-btn {
    border-color: #3a8edb;
    background: #3a8edb;
    color: #fff;
  }

  .status-phase,
  .summary-grid {
    color: #aaa;
  }

  .status-footer {
    background-color: #252525;
    border-top-color: #3d3d3d;
  }

  .progress-bar-container {
    background: #3a3a3a;
  }

  .progress-bar {
    background-color: #4a9eff;
  }
}
</style>
