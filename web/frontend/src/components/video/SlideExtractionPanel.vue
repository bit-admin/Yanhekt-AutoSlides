<template>
  <div class="slide-extraction-panel">
    <div class="extraction-header">
      <label class="extraction-toggle" :class="{ disabled: captureNotSupported }">
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="captureNotSupported"
          @change="$emit('toggle', ($event.target as HTMLInputElement).checked)"
        />
        <span class="toggle-slider"></span>
        <span class="toggle-text">{{ $t('playback.slideExtraction') }}</span>
      </label>

      <div class="slide-counter">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <span class="counter-text">
          {{ slides.length }} {{ $t('playback.slides') }}
          <span v-if="enabled" class="counter-status">{{ $t('playback.extracted') }}</span>
        </span>
        <span
          v-if="enabled && status.verificationState === 'verifying'"
          class="verification-dot"
          :title="`${status.currentVerification}`"
        ></span>
      </div>

      <span v-if="postLine" class="post-process-line">{{ postLine }}</span>

      <button
        v-if="slides.length > 0"
        class="btn btn--primary post-process-btn"
        :disabled="isPostProcessing"
        :title="$t('playback.postProcess')"
        @click="$emit('postProcess')"
      >
        <svg v-if="!isPostProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="m2 17 10 5 10-5"/>
          <path d="m2 12 10 5 10-5"/>
        </svg>
        <span v-else class="processing-spinner"></span>
        {{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}
      </button>

      <button
        v-if="slides.length > 0"
        class="collapse-btn"
        :title="$t('playback.slides')"
        @click="collapsed = !collapsed"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :style="{ transform: collapsed ? 'rotate(-90deg)' : 'none' }"
        >
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
    </div>

    <p v-if="captureNotSupported" class="capture-unsupported">
      {{ $t('playback.captureNotSupported') }}
    </p>

    <SlideGalleryStrip v-if="!collapsed && slides.length > 0" :slides="slides" />
  </div>
</template>

<script setup lang="ts">
// Extraction controls under the player: toggle, live counter, verification
// indicator, manual Post-process button (desktop gallery parity),
// post-processing status line, and the collapsible gallery strip.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlideGalleryStrip from './SlideGalleryStrip.vue'
import type { ExtractedSlide } from '../../lib/processing'
import type { SlideExtractionStatus } from '../../composables/video/useSlideExtraction'
import type { PostProcessingRunStatus } from '../../lib/postProcessing/runner'

const props = defineProps<{
  enabled: boolean
  status: SlideExtractionStatus
  slides: ExtractedSlide[]
  postStatus: PostProcessingRunStatus | null
  isPostProcessing: boolean
  captureNotSupported: boolean
}>()

defineEmits<{
  toggle: [checked: boolean]
  postProcess: []
}>()

const { t } = useI18n()
const collapsed = ref(false)

const postLine = computed(() => {
  const status = props.postStatus
  if (!status) return ''
  if (status.state === 'running') {
    const progress = status.progress
    if (progress?.phase === 'phase1') {
      return `${t('playback.postProcessStatus.phase1')} (${progress.phase1.processed}/${progress.phase1.total})`
    }
    if (progress?.phase === 'phase2') {
      return `${t('playback.postProcessStatus.phase2')} (${progress.phase2.processed}/${progress.phase2.total})`
    }
    return t('playback.postProcessing')
  }
  if (status.state === 'done') {
    return `${t('playback.postProcessStatus.completed')} · ${t('playback.postProcessStatus.duplicatesRemoved', { count: status.duplicatesRemoved })} · ${t('playback.postProcessStatus.excludedRemoved', { count: status.excludedRemoved })}`
  }
  return ''
})
</script>

<style scoped>
.slide-extraction-panel {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
}

.extraction-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.extraction-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.extraction-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.extraction-toggle input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--text-secondary);
  transition: transform 0.2s, background-color 0.2s;
}

.extraction-toggle input:checked + .toggle-slider {
  background-color: var(--accent);
  border-color: var(--accent);
}

.extraction-toggle input:checked + .toggle-slider::after {
  transform: translateX(16px);
  background-color: #ffffff;
}

.toggle-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.slide-counter {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.counter-status {
  color: var(--accent);
}

.verification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--warning, #e6a23c);
  animation: verification-pulse 1s ease-in-out infinite;
}

@keyframes verification-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.post-process-line {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.post-process-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.processing-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: processing-spin 0.8s linear infinite;
}

@keyframes processing-spin {
  to { transform: rotate(360deg); }
}

.collapse-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.collapse-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.collapse-btn svg {
  transition: transform 0.2s;
}

.capture-unsupported {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--danger, #d9534f);
}
</style>
