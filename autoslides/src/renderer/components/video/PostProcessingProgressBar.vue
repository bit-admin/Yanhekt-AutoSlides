<template>
  <div class="flex w-full flex-row gap-3">
    <!-- Phase 1: Duplicate Removal -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-medium text-[#555] dark:text-[#ccc]">{{ phase1Name }}</span>
        <span v-if="state.phase1.status === 'skipped'" class="italic text-fg-muted">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase1.status === 'active'" class="font-semibold text-accent">
          {{ state.phase1.current }}/{{ state.phase1.total }}
        </span>
        <span v-else-if="state.phase1.status === 'completed' && state.phase1.removed > 0" class="font-semibold text-[#16a34a] dark:text-[#4ade80]">
          -{{ state.phase1.removed }}
        </span>
      </div>
      <div
        class="relative h-1 overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]"
        :class="{ 'opacity-50': state.phase1.status === 'skipped' }"
      >
        <div
          class="h-full rounded-[2px] transition-[width] duration-300"
          :class="state.phase1.status === 'active' ? 'bg-accent'
            : state.phase1.status === 'completed' ? 'bg-[#16a34a] dark:bg-[#4ade80]'
            : 'bg-[#ddd] dark:bg-[#555]'"
          :style="{ width: phase1Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 2: Exclusion List -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-medium text-[#555] dark:text-[#ccc]">{{ phase2Name }}</span>
        <span v-if="state.phase2.status === 'skipped'" class="italic text-fg-muted">
          {{ disabledLabel }}
        </span>
        <span v-else-if="state.phase2.status === 'active'" class="font-semibold text-accent">
          {{ state.phase2.current }}/{{ state.phase2.total }}
        </span>
        <span v-else-if="state.phase2.status === 'completed' && state.phase2.removed > 0" class="font-semibold text-[#16a34a] dark:text-[#4ade80]">
          -{{ state.phase2.removed }}
        </span>
      </div>
      <div
        class="relative h-1 overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]"
        :class="{ 'opacity-50': state.phase2.status === 'skipped' }"
      >
        <div
          class="h-full rounded-[2px] transition-[width] duration-300"
          :class="state.phase2.status === 'active' ? 'bg-accent'
            : state.phase2.status === 'completed' ? 'bg-[#16a34a] dark:bg-[#4ade80]'
            : 'bg-[#ddd] dark:bg-[#555]'"
          :style="{ width: phase2Width }"
        ></div>
      </div>
    </div>

    <!-- Phase 3: AI Classification -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-medium text-[#555] dark:text-[#ccc]">{{ phase3Name }}</span>
        <span v-if="state.phase3.status === 'skipped'" class="italic text-fg-muted">
          {{ disabledLabel }}
        </span>
        <span
          v-else-if="state.phase3.status === 'active' || state.ai.total > 0"
          :class="state.phase3.status === 'active' ? 'font-semibold text-accent' : 'text-[#888] dark:text-[#999]'"
        >
          {{ state.ai.completed }}/{{ state.ai.total }}
        </span>
        <span v-else-if="state.phase3.status === 'completed' && state.phase3.removed > 0" class="font-semibold text-[#16a34a] dark:text-[#4ade80]">
          -{{ state.phase3.removed }}
        </span>
      </div>
      <div
        class="relative h-1 overflow-hidden rounded-[2px] bg-[#e9ecef] dark:bg-[#404040]"
        :class="{ 'opacity-50': state.phase3.status === 'skipped' }"
      >
        <div
          class="h-full rounded-[2px] transition-[width] duration-300"
          :class="[
            state.phase3.status === 'active' ? 'bg-accent'
              : state.phase3.status === 'completed' ? 'bg-[#16a34a] dark:bg-[#4ade80]'
              : 'bg-[#ddd] dark:bg-[#555]',
            { 'pp-pulsing': state.phase3.status === 'active' && state.ai.inProgress > 0 }
          ]"
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
/* Custom pulse for the AI phase while batches are in flight (differs from
   Tailwind's animate-pulse timing/opacity). */
.pp-pulsing {
  animation: pp-pulse 1.2s ease-in-out infinite;
}

@keyframes pp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
</style>
