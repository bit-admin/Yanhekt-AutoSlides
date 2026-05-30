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
    <div class="pp-phase-item">
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
}

const props = withDefaults(defineProps<Props>(), {
  labels: 'short'
})

const { t } = useI18n()

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
