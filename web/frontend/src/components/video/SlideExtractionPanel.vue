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

      <div class="slide-counter" :class="{ active: enabled }">
        <svg class="counter-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <span class="counter-text">
          <strong class="count-num">{{ slides.length }}</strong> {{ $t('playback.slides') }}
          <span v-if="enabled" class="counter-status-pill">{{ $t('playback.extracted') }}</span>
        </span>
        <span
          v-if="enabled && status.verificationState === 'verifying'"
          class="verification-dot"
          :title="`${status.currentVerification}`"
        ></span>
      </div>

      <button
        v-if="slides.length > 0"
        class="btn btn--sm btn-postprocess"
        :class="{ 'btn--primary': postStatus?.state !== 'running', 'is-processing': isPostProcessing }"
        :disabled="isPostProcessing"
        :title="$t('playback.postProcess')"
        @click="$emit('postProcess')"
      >
        <svg v-if="!isPostProcessing" class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="m2 17 10 5 10-5"/>
          <path d="m2 12 10 5 10-5"/>
        </svg>
        <span v-else class="processing-spinner"></span>
        <span>{{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}</span>
      </button>

      <button
        v-if="slides.length > 0"
        class="collapse-btn"
        :class="{ collapsed }"
        :title="$t('playback.slides')"
        @click="collapsed = !collapsed"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
    </div>

    <!-- Premium Post-Processing Progress Dashboard -->
    <div
      v-if="postStatus && (postStatus.state === 'running' || postStatus.state === 'done' || postStatus.state === 'error')"
      class="post-process-dashboard"
      :class="`status-${postStatus.state}`"
    >
      <div v-if="postStatus.state === 'running'" class="dashboard-progress">
        <!-- Phase 1: Duplicates -->
        <div class="progress-phase" :class="phase1.state">
          <div class="phase-meta">
            <span class="phase-name">{{ $t('playback.postProcessStatus.phase1NameShort') }}</span>
            <span class="phase-val">{{ phase1.text }}</span>
          </div>
          <div class="phase-bar-track">
            <div class="phase-bar-fill" :style="{ width: phase1.pct + '%' }"></div>
          </div>
        </div>

        <!-- Phase 2: Exclusions -->
        <div class="progress-phase" :class="phase2.state">
          <div class="phase-meta">
            <span class="phase-name">{{ $t('playback.postProcessStatus.phase2NameShort') }}</span>
            <span class="phase-val">{{ phase2.text }}</span>
          </div>
          <div class="phase-bar-track">
            <div class="phase-bar-fill" :style="{ width: phase2.pct + '%' }"></div>
          </div>
        </div>

        <!-- Phase 3: AI classification (only when the pass runs AI) -->
        <div v-if="!phase3Skipped" class="progress-phase" :class="phase3.state">
          <div class="phase-meta">
            <span class="phase-name">{{ $t('playback.postProcessStatus.phase3NameShort') }}</span>
            <span class="phase-val">{{ phase3.text }}</span>
          </div>
          <div class="phase-bar-track">
            <div class="phase-bar-fill" :class="{ retrying: phase3.retrying }" :style="{ width: phase3.pct + '%' }"></div>
          </div>
        </div>
      </div>

      <div v-else-if="postStatus.state === 'done'" class="dashboard-summary">
        <svg class="status-icon success" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        <span class="summary-text">{{ postLine }}</span>
      </div>

      <div
        v-if="postStatus.state === 'done' && postStatus.aiFailedCount > 0"
        class="dashboard-summary warning"
      >
        <svg class="status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span class="summary-text">{{ $t('playback.postProcessStatus.aiFailed', { count: postStatus.aiFailedCount }) }}</span>
      </div>

      <div v-else-if="postStatus.state === 'error'" class="dashboard-summary error">
        <svg class="status-icon error" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="summary-text">{{ $t('playback.postProcessStatus.failed') }}</span>
      </div>
    </div>

    <p v-if="captureNotSupported" class="capture-unsupported">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>{{ $t('playback.captureNotSupported') }}</span>
    </p>

    <Transition name="slide-fade">
      <div v-show="!collapsed && slides.length > 0" class="gallery-wrapper">
        <SlideGalleryStrip :slides="slides" />
      </div>
    </Transition>
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

const phase1 = computed(() => {
  const status = props.postStatus
  if (!status || !status.progress) return { state: 'idle', pct: 0, text: '' }
  const p1 = status.progress.phase1
  if (p1.skipped) return { state: 'skipped', pct: 0, text: t('playback.postProcessStatus.disabled') }
  if (status.progress.phase === 'phase1') {
    const pct = p1.total > 0 ? (p1.processed / p1.total) * 100 : 0
    return { state: 'active', pct, text: `${p1.processed}/${p1.total}` }
  }
  if (
    status.progress.phase === 'phase2' ||
    status.progress.phase === 'phase3' ||
    status.progress.phase === 'completed' ||
    status.state === 'done'
  ) {
    return { state: 'completed', pct: 100, text: p1.duplicatesRemoved > 0 ? `-${p1.duplicatesRemoved}` : '✓' }
  }
  return { state: 'idle', pct: 0, text: '' }
})

const phase2 = computed(() => {
  const status = props.postStatus
  if (!status || !status.progress) return { state: 'idle', pct: 0, text: '' }
  const p2 = status.progress.phase2
  if (p2.skipped) return { state: 'skipped', pct: 0, text: t('playback.postProcessStatus.disabled') }
  if (status.progress.phase === 'phase2') {
    const pct = p2.total > 0 ? (p2.processed / p2.total) * 100 : 0
    return { state: 'active', pct, text: `${p2.processed}/${p2.total}` }
  }
  if (status.progress.phase === 'phase3' || status.progress.phase === 'completed' || status.state === 'done') {
    return { state: 'completed', pct: 100, text: p2.excludedRemoved > 0 ? `-${p2.excludedRemoved}` : '✓' }
  }
  return { state: 'idle', pct: 0, text: '' }
})

const phase3Skipped = computed(() => props.postStatus?.progress?.phase3.skipped !== false)

const phase3 = computed(() => {
  const status = props.postStatus
  if (!status || !status.progress) return { state: 'idle', pct: 0, text: '', retrying: false }
  const p3 = status.progress.phase3
  if (status.progress.phase === 'phase3') {
    const pct = p3.total > 0 ? (p3.processed / p3.total) * 100 : 0
    return { state: 'active', pct, text: `${p3.processed}/${p3.total}`, retrying: p3.retrying > 0 }
  }
  if (status.progress.phase === 'completed' || status.state === 'done') {
    const removed = p3.aiFiltered + p3.aiFilteredEdit
    return { state: 'completed', pct: 100, text: removed > 0 ? `-${removed}` : '✓', retrying: false }
  }
  return { state: 'idle', pct: 0, text: '', retrying: false }
})

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
    if (progress?.phase === 'phase3') {
      return `${t('playback.postProcessStatus.phase3')} (${progress.phase3.processed}/${progress.phase3.total})`
    }
    return t('playback.postProcessing')
  }
  if (status.state === 'done') {
    let line = `${t('playback.postProcessStatus.completed')} · ${t('playback.postProcessStatus.duplicatesRemoved', { count: status.duplicatesRemoved })} · ${t('playback.postProcessStatus.excludedRemoved', { count: status.excludedRemoved })}`
    if (!phase3Skipped.value) {
      line += ` · ${t('playback.postProcessStatus.aiRemoved', { count: status.aiRemoved })}`
    }
    return line
  }
  return ''
})
</script>

<style scoped>
.slide-extraction-panel {
  margin-top: 0.75rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
  box-shadow: 0 4px 12px var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.slide-extraction-panel:hover {
  box-shadow: 0 6px 16px var(--shadow-md);
  border-color: var(--border-strong);
}

.extraction-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.extraction-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
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
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease;
  flex-shrink: 0;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--text-secondary);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease;
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
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.slide-counter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  padding: 0.25rem 0.625rem;
  border-radius: 6.25rem;
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.slide-counter.active {
  border-color: rgba(6, 95, 212, 0.15);
  background-color: var(--focus-ring);
  color: var(--link-color);
}

.counter-icon {
  flex-shrink: 0;
}

.count-num {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.counter-status-pill {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  margin-left: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.verification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--warning, #ed6c02);
  box-shadow: 0 0 6px var(--warning);
  animation: verification-pulse 1.2s ease-in-out infinite;
}

@keyframes verification-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.4; }
}

.btn-postprocess {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 600;
  border-radius: 6.25rem; /* Pill shape */
  padding: 0.375rem 0.875rem;
  box-shadow: 0 2px 4px var(--shadow-sm);
  transition: all 0.2s ease;
}

.btn-postprocess:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.btn-postprocess.is-processing {
  opacity: 0.8;
}

.btn-icon {
  flex-shrink: 0;
}

.processing-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: processing-spin 0.8s linear infinite;
  flex-shrink: 0;
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
  border-radius: 50%;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background-color: var(--border-color);
  color: var(--text-primary);
}

.collapse-btn svg {
  transition: transform 0.2s ease;
}

.collapse-btn.collapsed svg {
  transform: rotate(-90deg);
}

.post-process-dashboard {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dashboard-progress {
  display: flex;
  gap: 1rem;
}

.progress-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.phase-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.6875rem;
}

.phase-name {
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.phase-val {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--text-muted);
}

.progress-phase.active .phase-name {
  color: var(--accent-deep);
}

.progress-phase.active .phase-val {
  color: var(--accent-deep);
}

.progress-phase.completed .phase-name {
  color: var(--success);
}

.progress-phase.completed .phase-val {
  color: var(--success);
}

.phase-bar-track {
  height: 4px;
  background-color: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.phase-bar-fill {
  height: 100%;
  border-radius: 2px;
  background-color: var(--border-strong);
  transition: width 0.3s ease;
}

.progress-phase.active .phase-bar-fill {
  background-color: var(--accent-deep);
  animation: active-pulse 1.5s ease-in-out infinite;
}

.progress-phase.completed .phase-bar-fill {
  background-color: var(--success);
}

@keyframes active-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.dashboard-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--success);
}

.dashboard-summary.error {
  color: var(--danger);
}

.dashboard-summary.warning {
  color: var(--warning);
  font-size: 0.75rem;
}

.progress-phase.active .phase-bar-fill.retrying {
  background-color: var(--warning);
}

.status-icon {
  flex-shrink: 0;
}

.capture-unsupported {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  background-color: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  font-size: 0.8125rem;
  font-weight: 500;
}

.capture-unsupported svg {
  flex-shrink: 0;
}

.gallery-wrapper {
  overflow: hidden;
  border-top: 1px dashed var(--border-color);
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 120px;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}
</style>
