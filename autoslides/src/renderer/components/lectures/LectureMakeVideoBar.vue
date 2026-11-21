<template>
  <div class="export-bar" :class="{ 'export-bar-disabled': !isSelectMode }">
    <div class="video-config">
      <div class="config-item">
        <label class="config-label" for="slide-video-resolution">{{ $t('lectures.makeVideoResolution') }}</label>
        <select id="slide-video-resolution" v-model="options.resolution" class="select-field" :title="$t('lectures.makeVideoResolutionHint')" :disabled="!isSelectMode">
          <option v-for="value in SLIDE_VIDEO_RESOLUTIONS" :key="value" :value="value">
            {{ value === 'source' ? $t('lectures.makeVideoResolutionSource') : `${value}p` }}
          </option>
        </select>
      </div>

      <div class="config-item">
        <label class="config-label" for="slide-video-repeat">{{ $t('lectures.makeVideoRepeat') }}</label>
        <select id="slide-video-repeat" v-model.number="options.repeatSeconds" class="select-field" :title="$t('lectures.makeVideoRepeatHint')" :disabled="!isSelectMode">
          <option v-for="seconds in SLIDE_VIDEO_REPEATS" :key="seconds" :value="seconds">{{ repeatLabel(seconds) }}</option>
        </select>
      </div>

      <div class="config-item">
        <label class="config-label" for="slide-video-source">{{ $t('lectures.makeVideoAudioSource') }}</label>
        <select id="slide-video-source" v-model="options.audioSource" class="select-field" :disabled="!isSelectMode">
          <option value="screen">{{ $t('lectures.makeVideoAudioScreen') }}</option>
          <option value="mic">{{ $t('lectures.makeVideoAudioMic') }}</option>
        </select>
      </div>

      <div class="config-item">
        <label class="config-label" for="slide-video-filter">{{ $t('lectures.makeVideoAudioFilter') }}</label>
        <select id="slide-video-filter" v-model="options.audioFilter" class="select-field" :disabled="!isSelectMode">
          <option value="none">{{ $t('lectures.audioFilterNone') }}</option>
          <option value="clean">{{ $t('lectures.audioFilterClean') }}</option>
          <option value="speech">{{ $t('lectures.audioFilterSpeech') }}</option>
          <option value="strong">{{ $t('lectures.audioFilterStrong') }}</option>
          <option value="loudnorm">{{ $t('lectures.audioFilterLoudnorm') }}</option>
        </select>
      </div>
    </div>

    <div class="make-video-actions">
      <WorkspaceExportOptions :label="`CRF ${options.crf} · ${options.audioBitrateKbps} kbps`" :disabled="!isSelectMode">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 3v6m8 0v6m-6 0v6"/>
          </svg>
        </template>

        <div class="export-menu-section" role="radiogroup" :aria-label="$t('lectures.makeVideoQuality')" :title="$t('lectures.makeVideoQualityHint')">
          <span class="export-menu-section-label">{{ $t('lectures.makeVideoQuality') }}</span>
          <div class="mode-segmented">
            <label v-for="crf in SLIDE_VIDEO_CRFS" :key="crf" class="mode-option">
              <input type="radio" name="slide-video-quality" v-model="options.crf" :value="crf" />
              <span>CRF {{ crf }}</span>
            </label>
          </div>
        </div>

        <div class="export-menu-section" role="radiogroup" :aria-label="$t('lectures.makeVideoAudioBitrate')">
          <span class="export-menu-section-label">{{ $t('lectures.makeVideoAudioBitrate') }}</span>
          <div class="mode-segmented">
            <label v-for="kbps in SLIDE_VIDEO_AUDIO_BITRATES" :key="kbps" class="mode-option">
              <input type="radio" name="slide-video-bitrate" v-model="options.audioBitrateKbps" :value="kbps" />
              <span>{{ kbps }} kbps</span>
            </label>
          </div>
        </div>
      </WorkspaceExportOptions>

      <div :title="$t(actionHintKey)">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canMakeVideo"
          :aria-describedby="skipNoticeId"
          @click="emit('start', { ...options })"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="14" height="14" rx="2"/>
            <path d="m22 8-6 4 6 4V8z"/>
          </svg>
          {{ $t('lectures.makeVideo') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_SLIDE_VIDEO_OPTIONS,
  SLIDE_VIDEO_AUDIO_BITRATES,
  SLIDE_VIDEO_CRFS,
  SLIDE_VIDEO_REPEATS,
  SLIDE_VIDEO_RESOLUTIONS,
  type SlideVideoOptions,
} from '@common/slideVideo'
import WorkspaceExportOptions from '../shell/WorkspaceExportOptions.vue'

const { t } = useI18n()
const props = defineProps<{
  isSelectMode: boolean
  canMakeVideo: boolean
  skipNoticeId?: string
}>()
const emit = defineEmits<{
  (e: 'start', options: SlideVideoOptions): void
}>()

// Like the Slides export row, these options are only kept for the page session.
const options = reactive<SlideVideoOptions>({ ...DEFAULT_SLIDE_VIDEO_OPTIONS })
const actionHintKey = computed(() => {
  if (!props.isSelectMode) return 'lectures.makeVideoSelectFirst'
  return props.canMakeVideo ? 'lectures.makeVideoHelp' : 'lectures.makeVideoNeeds'
})

const repeatLabel = (seconds: number): string =>
  seconds === 0
    ? t('lectures.makeVideoRepeatOff')
    : seconds < 60
      ? t('lectures.makeVideoRepeatSeconds', { count: seconds })
      : t('lectures.makeVideoRepeatMinutes', { count: seconds / 60 })
</script>

<style scoped src="../../shared/styles/workspaceExportBar.css"></style>

<style scoped>
.export-bar {
  flex-shrink: 0;
}

.video-config {
  display: flex;
  flex: 1 1 0;
  flex-wrap: wrap;
  align-items: center;
  min-width: min(100%, 14rem);
  gap: 6px 8px;
}

.config-item {
  max-width: 100%;
}

.config-item .select-field {
  width: auto;
  min-width: 0;
  text-overflow: ellipsis;
}

.make-video-actions {
  display: flex;
  align-items: center;
  align-self: flex-end;
  gap: 8px;
  margin-inline-start: auto;
}
</style>
