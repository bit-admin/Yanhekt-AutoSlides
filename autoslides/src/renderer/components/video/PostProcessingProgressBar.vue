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
      <div class="pp-phase-bar three-color" :class="{ disabled: state.phase3.status === 'skipped' }">
        <!-- Green: completed AI decisions -->
        <div
          class="pp-phase-fill"
          :class="{
            active: state.phase3.status === 'active',
            completed: state.phase3.status === 'completed'
          }"
          :style="{ width: aiCompletedWidth }"
        ></div>
        <!-- Blue: in-progress batch overlay -->
        <div
          v-if="state.phase3.status === 'active' && state.ai.inProgress > 0 && state.ai.total > 0"
          class="pp-phase-fill in-progress"
          :style="{
            left: aiCompletedWidth,
            width: aiInProgressWidth
          }"
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

const aiCompletedWidth = computed(() => {
  const { completed, total } = props.state.ai
  if (props.state.phase3.status === 'skipped' || total === 0) return '0%'
  return `${(completed / total) * 100}%`
})

const aiInProgressWidth = computed(() => {
  const { inProgress, total } = props.state.ai
  if (props.state.phase3.status === 'skipped' || total === 0) return '0%'
  return `${(inProgress / total) * 100}%`
})
</script>

<style scoped>
.pp-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pp-phase-item {
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
  color: #555;
  font-weight: 500;
}

.pp-phase-status {
  color: #888;
}

.pp-phase-status.active {
  color: #007acc;
  font-weight: 600;
}

.pp-phase-status.completed {
  color: #16a34a;
  font-weight: 600;
}

.pp-phase-status.skipped {
  color: #999;
  font-style: italic;
}

.pp-phase-bar {
  position: relative;
  height: 4px;
  background-color: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
}

.pp-phase-bar.disabled {
  opacity: 0.5;
}

.pp-phase-bar.three-color {
  position: relative;
}

.pp-phase-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
  background-color: #ddd;
}

.pp-phase-fill.active {
  background-color: #007acc;
}

.pp-phase-fill.completed {
  background-color: #16a34a;
}

.pp-phase-bar.three-color .pp-phase-fill.in-progress {
  position: absolute;
  top: 0;
  background-color: #007acc;
}

@media (prefers-color-scheme: dark) {
  .pp-phase-name {
    color: #ccc;
  }

  .pp-phase-status {
    color: #999;
  }

  .pp-phase-status.active {
    color: #4fc3f7;
  }

  .pp-phase-status.completed {
    color: #4ade80;
  }

  .pp-phase-bar {
    background-color: #404040;
  }

  .pp-phase-fill {
    background-color: #555;
  }

  .pp-phase-fill.active {
    background-color: #4fc3f7;
  }

  .pp-phase-fill.completed {
    background-color: #4ade80;
  }

  .pp-phase-bar.three-color .pp-phase-fill.in-progress {
    background-color: #4fc3f7;
  }
}
</style>
