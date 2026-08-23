<template>
  <!-- Drive-style workspace modal: rounded box, centered title, no header bar / X / chrome footer. -->
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="lec-modal-box lec-compress-box" @click.stop>
      <h3 class="lec-modal-title">{{ $t('lectures.compressModalTitle') }}</h3>
      <p class="lec-modal-help">
        {{ $t('lectures.compressModalHint') }}
      </p>

      <div class="lec-settings-grid">
        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.videoPreset') }}</label>
          <select v-model="local.preset" class="select-field">
            <option value="tiny">{{ $t('compressLecture.presetTiny') }}</option>
            <option value="small">{{ $t('compressLecture.presetSmall') }}</option>
            <option value="readable">{{ $t('compressLecture.presetReadable') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.cropMode') }}</label>
          <select v-model="local.cropMode" class="select-field">
            <option value="none">{{ $t('compressLecture.cropNone') }}</option>
            <option value="4:3">{{ $t('compressLecture.crop43') }}</option>
            <option value="auto">{{ $t('compressLecture.cropAuto') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.videoFilter') }}</label>
          <select v-model="local.filterMode" class="select-field">
            <option value="none">{{ $t('compressLecture.filterNone') }}</option>
            <option value="denoise">{{ $t('compressLecture.filterDenoise') }}</option>
            <option value="sharpen">{{ $t('compressLecture.filterSharpen') }}</option>
            <option value="both">{{ $t('compressLecture.filterBoth') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.scaler') }}</label>
          <select v-model="local.scaler" class="select-field">
            <option value="lanczos">lanczos</option>
            <option value="bicubic">bicubic</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.audioPreset') }}</label>
          <select v-model="local.audioPreset" class="select-field">
            <option value="low">{{ $t('compressLecture.audioLow') }}</option>
            <option value="mid">{{ $t('compressLecture.audioMid') }}</option>
            <option value="high">{{ $t('compressLecture.audioHigh') }}</option>
            <option value="max">{{ $t('compressLecture.audioMax') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.audioFilter') }}</label>
          <select v-model="local.audioFilterPreset" class="select-field">
            <option value="none">{{ $t('compressLecture.audioFilterNone') }}</option>
            <option value="clean">{{ $t('compressLecture.audioFilterClean') }}</option>
            <option value="speech">{{ $t('compressLecture.audioFilterSpeech') }}</option>
            <option value="strong">{{ $t('compressLecture.audioFilterStrong') }}</option>
            <option value="loudnorm">{{ $t('compressLecture.audioFilterLoudnorm') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.container') }}</label>
          <select v-model="local.container" class="select-field">
            <option value="mp4">mp4</option>
            <option value="mkv">mkv</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label">{{ $t('compressLecture.opusVbr') }}</label>
          <select v-model="local.opusVbr" class="select-field">
            <option value="on">on</option>
            <option value="constrained">constrained</option>
            <option value="off">off</option>
          </select>
        </div>
      </div>

      <p class="lec-modal-note">{{ $t('lectures.compressReplaceNote') }}</p>

      <div class="lec-modal-actions">
        <button type="button" class="btn lec-modal-btn" @click="emit('close')">
          {{ $t('trash.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary lec-modal-btn"
          :disabled="fileCount === 0"
          @click="start"
        >
          {{ $t('lectures.startCompress') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import type { LectureCompressDefaults } from '@common/types'
import { DEFAULT_COMPRESS } from '@features/lectures/lecturePrefs'

defineProps<{
  fileCount: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start', options: LectureCompressDefaults): void
}>()

// Fresh defaults each open — not persisted (Slides PDF export convention).
const local = reactive<LectureCompressDefaults>({ ...DEFAULT_COMPRESS })

const start = () => {
  emit('start', { ...local })
}
</script>

<style scoped>
/* Matches Drive NoteExportFormatModal chrome. */
.lec-modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 90vh;
  overflow: auto;
}

.lec-compress-box {
  width: min(480px, 92vw);
}

.lec-modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.lec-modal-help {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  text-align: center;
}

.lec-settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}

.lec-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.lec-field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.lec-modal-note {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.lec-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.lec-modal-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}

@media (max-width: 480px) {
  .lec-settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
