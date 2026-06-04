<template>
  <div class="pp-bar">
    <!-- Phase 1: Duplicate Removal -->
    <div class="pp-phase-item">
      <div class="pp-phase-header">
        <span class="pp-phase-name">{{ phase1Name }}</span>
        <span v-if="state.phase1.status === 'skipped'" class="pp-phase-status skipped">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase1.status === 'active'" class="pp-phase-status active">
          {{ state.phase1.current }}/{{ state.phase1.total }}
        </span>
        <span v-else-if="state.phase1.status === 'completed' && state.phase1.removed > 0" class="pp-phase-status completed">
          -{{ state.phase1.removed }}
        </span>
      </div>
      <div class="pp-phase-bar" :class="{ disabled: state.phase1.status === 'skipped' }">
        <div
          class="pp-phase-fill"
          :class="{
            active: state.phase1.status === 'active',
            completed: state.phase1.status === 'completed'
          }"
          :style="{ width: phase1Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 2: Exclusion List -->
    <div class="pp-phase-item">
      <div class="pp-phase-header">
        <span class="pp-phase-name">{{ phase2Name }}</span>
        <span v-if="state.phase2.status === 'skipped'" class="pp-phase-status skipped">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase2.status === 'active'" class="pp-phase-status active">
          {{ state.phase2.current }}/{{ state.phase2.total }}
        </span>
        <span v-else-if="state.phase2.status === 'completed' && state.phase2.removed > 0" class="pp-phase-status completed">
          -{{ state.phase2.removed }}
        </span>
      </div>
      <div class="pp-phase-bar" :class="{ disabled: state.phase2.status === 'skipped' }">
        <div
          class="pp-phase-fill"
          :class="{
            active: state.phase2.status === 'active',
            completed: state.phase2.status === 'completed'
          }"
          :style="{ width: phase2Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 3: AI Classification -->
    <div class="pp-phase-item" :class="{ 'pp-phase-item--cancellable': showCancel }">
      <div class="pp-phase-header">
        <span class="pp-phase-name">{{ phase3Name }}</span>
        <span v-if="state.phase3.status === 'skipped'" class="pp-phase-status skipped">
          {{ disabledLabel }}
        </span>
        <span
          v-else-if="state.phase3.status === 'active' || state.ai.total > 0"
          class="pp-phase-status"
          :class="{ active: state.phase3.status === 'active' }"
        >
          {{ state.ai.completed }}/{{ state.ai.total }}
        </span>
        <span v-else-if="state.phase3.status === 'completed' && state.phase3.removed > 0" class="pp-phase-status completed">
          -{{ state.phase3.removed }}
        </span>
      </div>
      <div class="pp-phase-bar" :class="{ disabled: state.phase3.status === 'skipped' }">
        <div
          class="pp-phase-fill"
          :class="{
            active: state.phase3.status === 'active',
            completed: state.phase3.status === 'completed',
            pulsing: state.phase3.status === 'active' && state.ai.inProgress > 0
          }"
          :style="{ width: phase3Width }"
        ></div>
      </div>

      <!-- On hover (LLM mode, AI phase active) the whole AI cell becomes a Cancel button. -->
      <button
        v-if="showCancel"
        class="pp-cancel-overlay"
        :class="{ 'is-cancelling': cancelling }"
        :disabled="cancelling"
        @click="$emit('cancel')"
      >
        <svg v-if="!cancelling" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span>{{ cancelling ? cancellingLabel : cancelLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PostProcessingDisplayState } from '@shared/postProcessing/displayAdapter'

interface Props {
  state: PostProcessingDisplayState
  /** When true, use the compact label set (postProcessStatus.phaseXNameShort). Default short. */
  labels?: 'short' | 'long'
  /** Whether the AI (phase 3) run can be cancelled (LLM mode only). */
  cancellable?: boolean
  /** Whether a cancel has already been requested for this run. */
  cancelling?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  labels: 'short',
  cancellable: false,
  cancelling: false
})

defineEmits<{ cancel: [] }>()

const { t } = useI18n()

// Show the cancel affordance only while the AI phase is actively running, or
// once a cancel has been requested (so the "cancelling…" state stays visible).
const showCancel = computed(() =>
  props.cancellable && (props.state.phase3.status === 'active' || props.cancelling)
)
const cancelLabel = computed(() => t('playback.postProcessStatus.cancelAI'))
const cancellingLabel = computed(() => t('playback.postProcessStatus.cancellingAI'))

const phase1Name = computed(() =>
  props.labels === 'long' ? t('playback.postProcessStatus.phase1Name') : t('playback.postProcessStatus.phase1NameShort')
)
const phase2Name = computed(() =>
  props.labels === 'long' ? t('playback.postProcessStatus.phase2Name') : t('playback.postProcessStatus.phase2NameShort')
)
const phase3Name = computed(() =>
  props.labels === 'long' ? t('playback.postProcessStatus.phase3Name') : t('playback.postProcessStatus.phase3NameShort')
)
const disabledLabel = computed(() => t('playback.postProcessStatus.disabled'))

function fillWidthForPhase(p: { status: string; current: number; total: number }): string {
  if (p.status === 'skipped') return '0%'
  if (p.status === 'completed') return '100%'
  if (p.status === 'active' && p.total > 0) {
    return `${(p.current / p.total) * 100}%`
  }
  return '0%'
}

const phase1Width = computed(() => fillWidthForPhase(props.state.phase1))
const phase2Width = computed(() => fillWidthForPhase(props.state.phase2))
const phase3Width = computed(() => fillWidthForPhase(props.state.phase3))
</script>

<style scoped>
.pp-bar {
  display: flex;
  flex-direction: row;
  gap: 12px;
  width: 100%;
}

.pp-phase-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pp-phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

/* The AI cell becomes a hover target so its full area can flip to a Cancel button. */
.pp-phase-item--cancellable {
  position: relative;
}

.pp-cancel-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--danger-border);
  border-radius: 4px;
  background-color: var(--danger-bg);
  color: var(--danger);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* Reveal across the whole AI cell on hover, or whenever a cancel is in flight. */
.pp-phase-item--cancellable:hover .pp-cancel-overlay,
.pp-cancel-overlay.is-cancelling {
  opacity: 1;
  pointer-events: auto;
}

.pp-cancel-overlay:hover:not(:disabled) {
  background-color: var(--danger);
  border-color: var(--danger);
  color: var(--text-on-accent);
}

.pp-cancel-overlay:disabled {
  cursor: default;
  opacity: 0.9;
}

.pp-phase-name {
  color: var(--text-secondary);
  font-weight: 500;
}

.pp-phase-status {
  color: var(--text-muted);
}

.pp-phase-status.active {
  color: var(--accent);
  font-weight: 600;
}

.pp-phase-status.completed {
  color: var(--success);
  font-weight: 600;
}

.pp-phase-status.skipped {
  color: var(--text-muted);
  font-style: italic;
}

.pp-phase-bar {
  position: relative;
  height: 4px;
  background-color: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.pp-phase-bar.disabled {
  opacity: 0.5;
}

.pp-phase-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
  background-color: var(--border-input);
}

.pp-phase-fill.active {
  background-color: var(--accent);
}

.pp-phase-fill.completed {
  background-color: var(--success);
}

.pp-phase-fill.pulsing {
  animation: pp-pulse 1.2s ease-in-out infinite;
}

@keyframes pp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
</style>
