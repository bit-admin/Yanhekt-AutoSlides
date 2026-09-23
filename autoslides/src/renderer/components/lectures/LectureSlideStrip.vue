<template>
  <div
    ref="rootEl"
    class="lecture-slide-strip"
    :class="{ 'is-resizing': resizing }"
    role="region"
    :aria-label="$t('playback.slideChapters')"
    :style="{ '--slide-card-width': `${cardWidth}px` }"
  >
    <div
      class="strip-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      :aria-label="$t('playback.resizeSlideChapters')"
      :aria-valuemin="MIN_CARD_WIDTH"
      :aria-valuemax="maxCardWidth()"
      :aria-valuenow="cardWidth"
      :title="$t('playback.resizeSlideChapters')"
      tabindex="0"
      @pointerdown="onResizeStart"
      @dblclick="setCardWidth(MIN_CARD_WIDTH)"
      @keydown.up.prevent="setCardWidth(cardWidth + KEY_STEP)"
      @keydown.down.prevent="setCardWidth(cardWidth - KEY_STEP)"
    >
      <span class="strip-resize-line" aria-hidden="true" />
    </div>
    <div ref="scrollEl" class="slide-cards-scroll custom-scrollbar">
      <button
        v-for="chapter in chapters"
        :key="chapter.id"
        type="button"
        class="slide-card"
        :class="{ 'is-active': chapter.id === activeChapterId }"
        :data-chapter-id="chapter.id"
        :title="cardTitle(chapter)"
        @click="onSeekChapter(chapter)"
      >
        <div class="card-thumb-wrap">
          <img
            v-if="thumbnailMap.get(chapter.imagePath)"
            class="card-thumb"
            :src="thumbnailMap.get(chapter.imagePath)"
            alt=""
            draggable="false"
          />
          <div v-else class="card-thumb-placeholder" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M8 9h8M8 12h5" />
            </svg>
          </div>
          <span v-if="chapter.id === activeChapterId" class="card-watching">
            {{ $t('playback.watching') }}
          </span>
          <span class="card-time">{{ formatTime(chapter.startTime) }}</span>
        </div>
        <div class="card-label">
          {{
            $t('playback.slideOrdinal', {
              number: String(chapter.index + 1).padStart(2, '0'),
            })
          }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SlideChapterCard } from '@features/lectures/useLectureSlideChapters'

const props = defineProps<{
  chapters: SlideChapterCard[]
  activeChapterId: string | null
  thumbnailMap: Map<string, string>
}>()

const emit = defineEmits<{
  (e: 'seek', time: number): void
  (e: 'load-thumbnail', imagePath: string): void
}>()

const rootEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

const cardTitle = (chapter: SlideChapterCard): string =>
  `${formatTime(chapter.startTime)}`

/**
 * Seek slightly into the chapter when startTime > 0 so media keyframe
 * quantization does not land just under the boundary and leave Watching
 * on the previous card.
 */
const SEEK_INSET_SEC = 0.05
const onSeekChapter = (chapter: SlideChapterCard): void => {
  const t = chapter.startTime
  const target =
    Number.isFinite(t) && t > 0 ? t + SEEK_INSET_SEC : Math.max(0, t || 0)
  emit('seek', target)
}

function setupObserver(): void {
  observer?.disconnect()
  const root = scrollEl.value
  if (!root) return

  observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.chapterId
        const chapter = props.chapters.find(c => c.id === id)
        if (chapter) emit('load-thumbnail', chapter.imagePath)
      }
    },
    { root, rootMargin: '80px', threshold: 0.01 }
  )

  for (const child of Array.from(root.querySelectorAll('.slide-card'))) {
    observer.observe(child)
  }
}

function scrollActiveIntoView(): void {
  const root = scrollEl.value
  const id = props.activeChapterId
  if (!root || !id) return
  // Avoid CSS.escape dependency; chapter ids are our evt_* tokens (safe subset).
  const safe = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const el = root.querySelector(`[data-chapter-id="${safe}"]`) as HTMLElement | null
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

/**
 * Card size is driven by width (thumbs are 16:9). The original fixed 240px is
 * the floor; dragging the line above the strip grows the row upward. The
 * ceiling keeps the thumb row under half the player's height.
 */
const MIN_CARD_WIDTH = 240
const ABS_MAX_CARD_WIDTH = 640
const KEY_STEP = 24
const WIDTH_STORAGE_KEY = 'autoslides.lectureSlideStrip.cardWidth'

function maxCardWidth(): number {
  const playerHeight = rootEl.value?.closest<HTMLElement>('.lecture-player')?.clientHeight ?? 0
  if (playerHeight <= 0) return ABS_MAX_CARD_WIDTH
  const byHeight = Math.floor(((playerHeight * 0.5) * 16) / 9)
  return Math.max(MIN_CARD_WIDTH, Math.min(ABS_MAX_CARD_WIDTH, byHeight))
}

function readStoredWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    return Number.isFinite(n) && n >= MIN_CARD_WIDTH ? n : MIN_CARD_WIDTH
  } catch {
    return MIN_CARD_WIDTH
  }
}

const cardWidth = ref(readStoredWidth())
const resizing = ref(false)

function setCardWidth(width: number, persist = true): void {
  cardWidth.value = Math.round(Math.max(MIN_CARD_WIDTH, Math.min(maxCardWidth(), width)))
  if (!persist) return
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(cardWidth.value))
  } catch {
    /* per-viewer convenience only */
  }
}

function onResizeStart(e: PointerEvent): void {
  if (e.button !== 0) return
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  const startY = e.clientY
  const startWidth = cardWidth.value
  resizing.value = true
  handle.setPointerCapture(e.pointerId)

  // Dragging up grows the thumb height; width follows the 16:9 ratio.
  const onMove = (ev: PointerEvent) => {
    setCardWidth(startWidth + ((startY - ev.clientY) * 16) / 9, false)
  }
  const onEnd = (ev: PointerEvent) => {
    handle.releasePointerCapture(ev.pointerId)
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onEnd)
    handle.removeEventListener('pointercancel', onEnd)
    resizing.value = false
    setCardWidth(cardWidth.value)
    void nextTick(() => scrollActiveIntoView())
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onEnd)
  handle.addEventListener('pointercancel', onEnd)
}

// Re-clamp a stored width against the current player size.
const onWindowResize = () => setCardWidth(cardWidth.value, false)

onMounted(() => {
  setCardWidth(cardWidth.value, false)
  window.addEventListener('resize', onWindowResize)
  void nextTick(() => setupObserver())
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  observer?.disconnect()
  observer = null
})

watch(
  () => props.chapters.map(c => c.id).join('|'),
  async () => {
    await nextTick()
    setupObserver()
  }
)

watch(
  () => props.activeChapterId,
  async () => {
    await nextTick()
    scrollActiveIntoView()
  }
)
</script>

<style scoped>
.lecture-slide-strip {
  min-width: 0;
  margin: 0 0 4px;
}

.strip-resize-handle {
  display: flex;
  align-items: center;
  height: 10px;
  margin: -4px 0 2px;
  cursor: ns-resize;
  touch-action: none;
  outline: none;
}

.strip-resize-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.14);
  transition: background-color 0.15s ease, height 0.15s ease;
}

.strip-resize-handle:hover .strip-resize-line,
.strip-resize-handle:focus-visible .strip-resize-line,
.lecture-slide-strip.is-resizing .strip-resize-line {
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
}

.lecture-slide-strip.is-resizing {
  user-select: none;
}

.lecture-slide-strip.is-resizing .slide-cards-scroll {
  scroll-behavior: auto;
}

.slide-cards-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding: 2px 2px 8px;
  /* Keep scrollbar thin; custom-scrollbar still applies */
  scrollbar-width: thin;
}

.slide-card {
  /* 240px floor; user-resizable via the line above the strip */
  flex: 0 0 var(--slide-card-width, 240px);
  width: var(--slide-card-width, 240px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  text-align: left;
  border-radius: 10px;
}

.slide-card:focus-visible {
  outline: 2px solid var(--text-on-fill);
  outline-offset: 2px;
}

.card-thumb-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.55);
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.slide-card:hover .card-thumb-wrap {
  border-color: rgba(255, 255, 255, 0.28);
}

.slide-card.is-active .card-thumb-wrap {
  border-color: var(--text-on-fill);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55);
}

.card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
}

.card-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
  background: linear-gradient(145deg, rgba(30, 30, 30, 0.95), rgba(10, 10, 10, 0.95));
}

.card-watching {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: #111114;
  background: var(--text-on-fill);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.card-time {
  position: absolute;
  right: 8px;
  bottom: 7px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.62);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 2px;
}

.slide-card.is-active .card-label {
  color: #fff;
}
</style>
