<template>
  <!-- Display only: nothing here seeks, searches, copies or exports. -->
  <div class="transcript-wrap">
    <button v-if="heldByUser" type="button" class="btn btn--sm transcript-follow" @click="resumeFollow">
      {{ $t('yanhe2Playback.followPlayback') }}
    </button>
    <div
      ref="scroller"
      class="transcript-panel custom-scrollbar"
      tabindex="0"
      role="region"
      :aria-label="$t('yanhe2Playback.transcript')"
      @pointerenter="reading = true"
      @pointerleave="reading = false"
      @wheel.passive="heldByUser = true"
      @keydown="onKeydown"
    >
      <div
        v-for="(line, index) in lines"
        :key="index"
        :class="['transcript-line', { current: index === currentIndex, spoken: index < currentIndex }]"
        :aria-current="index === currentIndex ? 'true' : undefined"
      >
        <span class="transcript-time">{{ formatTime(line.begin + shift) }}</span>
        <span class="transcript-text">{{ line.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// One Yanhe 2.0 recording's transcript as a reading column: a time and a
// sentence per row, the row being spoken marked, and the column kept on it
// while the lecture plays. The pointer over the column means someone is
// reading elsewhere in it, so it stops following until the pointer leaves.
import { nextTick, onMounted, ref, watch } from 'vue'
import type { Yanhe2TranscriptLine } from '@common/yanhe2Transcript'

const props = defineProps<{
  lines: Yanhe2TranscriptLine[]
  /** The row being spoken, or -1 when that is not known. */
  currentIndex: number
  /** Seconds added to each row's time, so it reads as the player's clock. */
  shift: number
  formatTime: (seconds: number) => string
}>()

const scroller = ref<HTMLElement | null>(null)
const reading = ref(false)
// Scrolled away by wheel or keyboard: stays put until Follow Playback.
const heldByUser = ref(false)
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])
const onKeydown = (event: KeyboardEvent) => {
  if (SCROLL_KEYS.has(event.key)) heldByUser.value = true
}
const resumeFollow = () => {
  heldByUser.value = false
  follow(true)
}

/**
 * How far below the column's top edge the current row is kept: room for the
 * two rows before it. Fixed, not a share of the column's height, because at
 * the default window size only the top of the column is on screen.
 */
const LEAD_PX = 72

/** Put the current row near the top, by moving this column only (never the page). */
const follow = (smooth: boolean) => {
  const box = scroller.value
  const row = box?.children[props.currentIndex] as HTMLElement | undefined
  if (!box || !row) return
  // The column is the rows' offset parent (`position: relative`).
  const top = row.offsetTop - LEAD_PX
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  box.scrollTo({ top: Math.max(0, top), behavior: smooth && !calm ? 'smooth' : 'auto' })
}

onMounted(() => follow(false))
watch(() => props.currentIndex, () => {
  if (!reading.value && !heldByUser.value) void nextTick(() => follow(true))
})
</script>

<style scoped>
.transcript-wrap {
  position: relative;
}

.transcript-follow {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: var(--z-raised);
}

.transcript-panel {
  position: relative;
  max-height: min(60vh, 520px);
  overflow-y: auto;
  padding: 12px 16px;
}

.transcript-line {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  align-items: baseline;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

/* What has been said recedes; what is being said is the one marked row. */
.transcript-line.spoken {
  color: var(--text-secondary);
}

.transcript-line.current {
  background-color: var(--bg-hover);
  font-weight: 600;
}

.transcript-time {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  user-select: none;
}

.transcript-text {
  min-width: 0;
  user-select: text;
}
</style>
