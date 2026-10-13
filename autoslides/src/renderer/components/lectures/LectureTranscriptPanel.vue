<template>
  <!--
    The lecture's subtitles as a column beside the picture: a time and a
    sentence per row, the row being spoken marked, a click seeks to it.
    Beside rather than over the video, so it and the slides strip along the
    bottom can both be open.
  -->
  <aside ref="rootEl" class="transcript-side" :class="{ 'is-resizing': resizing }">
    <!-- The column's left edge, dragged like the line above the slides strip. -->
    <div
      class="side-resize-handle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="$t('lectures.transcriptResize')"
      :title="$t('lectures.transcriptResize')"
      tabindex="0"
      @pointerdown="onResizeStart"
      @dblclick="resetWidth"
      @keydown.left.prevent.stop="setWidth(currentWidth() + KEY_STEP)"
      @keydown.right.prevent.stop="setWidth(currentWidth() - KEY_STEP)"
    >
      <span class="side-resize-line" aria-hidden="true" />
    </div>
    <header class="transcript-head">
      <!-- Two sizes of text: they share a baseline, not a centre line. -->
      <span class="transcript-heading">
        <span class="transcript-title">{{ $t('lectures.transcript') }}</span>
        <span class="transcript-count">{{ cues.length }}</span>
      </span>
      <button
        type="button"
        class="transcript-close"
        :title="$t('lectures.transcriptClose')"
        :aria-label="$t('lectures.transcriptClose')"
        @click="emit('close')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </header>

    <!-- Rows are not tab stops: the keyboard stays the player's (Space, arrows). -->
    <div
      ref="scroller"
      class="transcript-rows custom-scrollbar"
      @pointerenter="reading = true"
      @pointerleave="reading = false"
    >
      <div
        v-for="(cue, index) in cues"
        :key="index"
        :class="['transcript-row', { current: index === currentIndex, spoken: index < currentIndex }]"
        role="button"
        tabindex="-1"
        @click="emit('seek', cue.begin)"
      >
        <span class="transcript-time">{{ formatTime(cue.begin) }}</span>
        <span class="transcript-text">{{ cue.text }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
// Follows the lecture as it plays. The pointer over the column means someone
// is looking for a line in it, so it stops following until the pointer leaves.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SubtitleCue } from '@common/srt'

const props = defineProps<{
  cues: SubtitleCue[]
  /** The row being spoken, or -1 before the first. */
  currentIndex: number
  formatTime: (seconds: number) => string
}>()

const emit = defineEmits<{
  (e: 'seek', seconds: number): void
  (e: 'close'): void
  /** The width the user dragged the column to, or null for the default share of the player. */
  (e: 'width', pixels: number | null): void
}>()

const rootEl = ref<HTMLElement | null>(null)

/**
 * The column's width is the player's `--transcript-width`, which the top bar
 * reads too, so this only reports the number and the player sets it. Nothing
 * stored means the default (a share of the player's width); a dragged width is
 * kept between launches, and re-clamped to the player it is shown in.
 */
const MIN_WIDTH = 260
const MAX_SHARE = 0.6
const KEY_STEP = 24
const WIDTH_STORAGE_KEY = 'autoslides.lectureTranscript.width'

const resizing = ref(false)
let chosenWidth: number | null = null

const currentWidth = () => rootEl.value?.offsetWidth ?? MIN_WIDTH

function maxWidth(): number {
  const stageWidth = rootEl.value?.parentElement?.clientWidth ?? 0
  return stageWidth > 0 ? Math.max(MIN_WIDTH, Math.floor(stageWidth * MAX_SHARE)) : Number.POSITIVE_INFINITY
}

function setWidth(width: number, persist = true): void {
  chosenWidth = Math.round(Math.max(MIN_WIDTH, Math.min(maxWidth(), width)))
  emit('width', chosenWidth)
  if (!persist) return
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(chosenWidth))
  } catch {
    /* per-viewer convenience only */
  }
}

function resetWidth(): void {
  chosenWidth = null
  emit('width', null)
  try {
    localStorage.removeItem(WIDTH_STORAGE_KEY)
  } catch {
    /* per-viewer convenience only */
  }
}

function onResizeStart(e: PointerEvent): void {
  if (e.button !== 0) return
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  const startX = e.clientX
  const startWidth = currentWidth()
  resizing.value = true
  handle.setPointerCapture(e.pointerId)

  // The column is on the right, so dragging left widens it.
  const onMove = (ev: PointerEvent) => setWidth(startWidth + (startX - ev.clientX), false)
  const onEnd = (ev: PointerEvent) => {
    handle.releasePointerCapture(ev.pointerId)
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onEnd)
    handle.removeEventListener('pointercancel', onEnd)
    resizing.value = false
    if (chosenWidth !== null) setWidth(chosenWidth)
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onEnd)
  handle.addEventListener('pointercancel', onEnd)
}

// Re-clamp a chosen width when the player changes size (window, fullscreen).
const reclamp = () => {
  if (chosenWidth !== null) setWidth(chosenWidth, false)
}

onMounted(() => {
  try {
    const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= MIN_WIDTH) setWidth(stored, false)
  } catch {
    /* default width */
  }
  window.addEventListener('resize', reclamp)
  document.addEventListener('fullscreenchange', reclamp)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', reclamp)
  document.removeEventListener('fullscreenchange', reclamp)
})

const scroller = ref<HTMLElement | null>(null)
const reading = ref(false)

/** The current row is kept about a third of the way down, with what led to it above. */
const follow = (smooth: boolean) => {
  const box = scroller.value
  const row = box?.children[props.currentIndex] as HTMLElement | undefined
  if (!box || !row) return
  // The column is the rows' offset parent (`position: relative`).
  const top = row.offsetTop - box.clientHeight / 3
  box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

onMounted(() => follow(false))
watch(() => props.currentIndex, () => {
  if (!reading.value) void nextTick(() => follow(true))
})
// Another episode's file: start from wherever that lecture is.
watch(() => props.cues, () => void nextTick(() => follow(false)))
</script>

<style scoped>
/* Fixed-dark player chrome: white ink and white alphas, never theme tokens,
   which flip with the app theme. */
.transcript-side {
  flex: 0 0 var(--transcript-width, clamp(260px, 30%, 380px));
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #0d0d0d;
  color: var(--text-on-fill);
  cursor: auto;
}

.transcript-side.is-resizing {
  user-select: none;
}

/* Same handle as the slides strip's, stood on end: a hairline that thickens. */
.side-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  z-index: var(--z-raised);
  display: flex;
  justify-content: center;
  width: 10px;
  cursor: ew-resize;
  touch-action: none;
  outline: none;
}

.side-resize-line {
  width: 1px;
  background: rgba(255, 255, 255, 0.14);
  transition: background-color 0.15s ease, width 0.15s ease;
}

.side-resize-handle:hover .side-resize-line,
.side-resize-handle:focus-visible .side-resize-line,
.transcript-side.is-resizing .side-resize-line {
  width: 2px;
  background: rgba(255, 255, 255, 0.6);
}

.transcript-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 10px 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.transcript-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.transcript-title {
  font-size: 13px;
  font-weight: 650;
}

.transcript-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
}

.transcript-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: none;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
}

.transcript-close:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text-on-fill);
}

.transcript-rows {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.transcript-row {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  outline: none;
}

.transcript-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* What has been said recedes; what is being said is the one marked row. */
.transcript-row.spoken {
  color: rgba(255, 255, 255, 0.55);
}

.transcript-row.current {
  background: rgba(255, 255, 255, 0.16);
  color: var(--text-on-fill);
  font-weight: 600;
}

.transcript-time {
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
  user-select: none;
}

.transcript-text {
  min-width: 0;
}
</style>
