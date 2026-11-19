<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="dialog-box lec-video-box" @click.stop>
      <h3 class="dialog-title">{{ $t('lectures.makeVideoTitle') }}</h3>
      <p class="dialog-help">{{ $t('lectures.makeVideoHint') }}</p>

      <div class="lec-settings-grid">
        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-resolution">{{ $t('lectures.makeVideoResolution') }}</label>
          <select id="slide-video-resolution" v-model="local.resolution" class="select-field" :title="$t('lectures.makeVideoResolutionHint')">
            <option v-for="value in SLIDE_VIDEO_RESOLUTIONS" :key="value" :value="value">
              {{ value === 'source' ? $t('lectures.makeVideoResolutionSource') : `${value}p` }}
            </option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-quality">{{ $t('lectures.makeVideoQuality') }}</label>
          <select id="slide-video-quality" v-model.number="local.crf" class="select-field" :title="$t('lectures.makeVideoQualityHint')">
            <option :value="18">{{ $t('lectures.makeVideoQualityHigh') }}</option>
            <option :value="23">{{ $t('lectures.makeVideoQualityStandard') }}</option>
            <option :value="28">{{ $t('lectures.makeVideoQualitySmall') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-repeat">{{ $t('lectures.makeVideoRepeat') }}</label>
          <select id="slide-video-repeat" v-model.number="local.repeatSeconds" class="select-field" :title="$t('lectures.makeVideoRepeatHint')">
            <option v-for="seconds in SLIDE_VIDEO_REPEATS" :key="seconds" :value="seconds">{{ repeatLabel(seconds) }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-source">{{ $t('lectures.makeVideoAudioSource') }}</label>
          <select id="slide-video-source" v-model="local.audioSource" class="select-field">
            <option value="screen">{{ $t('lectures.makeVideoAudioScreen') }}</option>
            <option value="mic">{{ $t('lectures.makeVideoAudioMic') }}</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-bitrate">{{ $t('lectures.makeVideoAudioBitrate') }}</label>
          <select id="slide-video-bitrate" v-model.number="local.audioBitrateKbps" class="select-field">
            <option v-for="kbps in SLIDE_VIDEO_AUDIO_BITRATES" :key="kbps" :value="kbps">Opus {{ kbps }} kbps</option>
          </select>
        </div>

        <div class="lec-field">
          <label class="lec-field-label" for="slide-video-filter">{{ $t('lectures.makeVideoAudioFilter') }}</label>
          <select id="slide-video-filter" v-model="local.audioFilter" class="select-field">
            <option value="none">{{ $t('lectures.audioFilterNone') }}</option>
            <option value="clean">{{ $t('lectures.audioFilterClean') }}</option>
            <option value="speech">{{ $t('lectures.audioFilterSpeech') }}</option>
            <option value="strong">{{ $t('lectures.audioFilterStrong') }}</option>
            <option value="loudnorm">{{ $t('lectures.audioFilterLoudnorm') }}</option>
          </select>
        </div>
      </div>

      <p class="lec-modal-note">{{ $t('lectures.makeVideoNote') }}</p>
      <p v-if="skipped > 0" class="lec-modal-note">{{ $t('lectures.makeVideoSkipped', { count: skipped }) }}</p>

      <div class="dialog-actions">
        <button type="button" class="btn dialog-btn" @click="emit('close')">
          {{ $t('trash.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary dialog-btn"
          :disabled="sessionCount === 0"
          @click="emit('start', { ...local })"
        >
          {{ $t('lectures.makeVideoStart', { count: sessionCount }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_SLIDE_VIDEO_OPTIONS,
  SLIDE_VIDEO_AUDIO_BITRATES,
  SLIDE_VIDEO_REPEATS,
  SLIDE_VIDEO_RESOLUTIONS,
  type SlideVideoOptions,
} from '@common/slideVideo'

const { t } = useI18n()

const repeatLabel = (seconds: number): string =>
  seconds === 0
    ? t('lectures.makeVideoRepeatOff')
    : seconds < 60
      ? t('lectures.makeVideoRepeatSeconds', { count: seconds })
      : t('lectures.makeVideoRepeatMinutes', { count: seconds / 60 })

defineProps<{
  sessionCount: number
  /** Selected sessions that cannot make one (no timeline, or no audio). */
  skipped: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start', options: SlideVideoOptions): void
}>()

// Fresh defaults each open — not persisted (Slides PDF export convention).
const local = reactive<SlideVideoOptions>({ ...DEFAULT_SLIDE_VIDEO_OPTIONS })
</script>

<style scoped>
.lec-video-box {
  width: min(480px, 92vw);
  overflow: auto;
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

@media (max-width: 480px) {
  .lec-settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
