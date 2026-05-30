<template>
  <div class="flex flex-row gap-3 w-full">
    <!-- Phase 1: Duplicate Removal -->
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex justify-between items-center text-[11px]">
        <span class="text-text-secondary font-medium">{{ phase1Name }}</span>
        <span v-if="state.phase1.status === 'skipped'" class="text-text-muted italic">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase1.status === 'active'" class="text-accent font-semibold">
          {{ state.phase1.current }}/{{ state.phase1.total }}
        </span>
        <span v-else-if="state.phase1.status === 'completed' && state.phase1.removed > 0" class="text-success font-semibold">
          -{{ state.phase1.removed }}
        </span>
      </div>
      <div class="relative h-1 bg-hover rounded-sm overflow-hidden" :class="{ 'opacity-50': state.phase1.status === 'skipped' }">
        <div
          class="h-full rounded-sm transition-[width] duration-300 ease-in-out"
          :class="{
            'bg-border': state.phase1.status !== 'active' && state.phase1.status !== 'completed',
            'bg-accent': state.phase1.status === 'active',
            'bg-success': state.phase1.status === 'completed'
          }"
          :style="{ width: phase1Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 2: Exclusion List -->
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex justify-between items-center text-[11px]">
        <span class="text-text-secondary font-medium">{{ phase2Name }}</span>
        <span v-if="state.phase2.status === 'skipped'" class="text-text-muted italic">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase2.status === 'active'" class="text-accent font-semibold">
          {{ state.phase2.current }}/{{ state.phase2.total }}
        </span>
        <span v-else-if="state.phase2.status === 'completed' && state.phase2.removed > 0" class="text-success font-semibold">
          -{{ state.phase2.removed }}
        </span>
      </div>
      <div class="relative h-1 bg-hover rounded-sm overflow-hidden" :class="{ 'opacity-50': state.phase2.status === 'skipped' }">
        <div
          class="h-full rounded-sm transition-[width] duration-300 ease-in-out"
          :class="{
            'bg-border': state.phase2.status !== 'active' && state.phase2.status !== 'completed',
            'bg-accent': state.phase2.status === 'active',
            'bg-success': state.phase2.status === 'completed'
          }"
          :style="{ width: phase2Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 3: AI Classification -->
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex justify-between items-center text-[11px]">
        <span class="text-text-secondary font-medium">{{ phase3Name }}</span>
        <span v-if="state.phase3.status === 'skipped'" class="text-text-muted italic">
          {{ disabledLabel }}
        </span>
        <span
          v-else-if="state.phase3.status === 'active' || state.ai.total > 0"
          :class="{ 'text-accent font-semibold': state.phase3.status === 'active' }"
        >
          {{ state.ai.completed }}/{{ state.ai.total }}
        </span>
        <span v-else-if="state.phase3.status === 'completed' && state.phase3.removed > 0" class="text-success font-semibold">
          -{{ state.phase3.removed }}
        </span>
      </div>
      <div class="relative h-1 bg-hover rounded-sm overflow-hidden" :class="{ 'opacity-50': state.phase3.status === 'skipped' }">
        <div
          class="h-full rounded-sm transition-[width] duration-300 ease-in-out"
          :class="{
            'bg-border': state.phase3.status !== 'active' && state.phase3.status !== 'completed',
            'bg-accent': state.phase3.status === 'active',
            'bg-success': state.phase3.status === 'completed',
            'animate-pp-pulse': state.phase3.status === 'active' && state.ai.inProgress > 0
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
@keyframes pp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.animate-pp-pulse {
  animation: pp-pulse 1.2s ease-in-out infinite;
}
</style>
