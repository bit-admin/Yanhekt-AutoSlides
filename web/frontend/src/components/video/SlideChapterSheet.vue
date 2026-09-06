<template>
  <!-- Phone-only replacement for the in-player chapter strip. The player panel
       is ~220px tall on a phone, so a horizontal strip inside it leaves cards
       barely bigger than the seek bar; this lifts the same cards into a
       full-width sheet, the way YouTube shows chapters on mobile. -->
  <Teleport to="body">
    <div class="scs-root">
      <div class="scs-backdrop" @click="$emit('close')"></div>

      <div class="scs-sheet" role="dialog" aria-modal="true" :aria-label="$t('playback.slideChapters')">
        <div class="scs-grabber" @click="$emit('close')"></div>

        <div class="scs-head">
          <h2 class="scs-title">{{ $t('playback.slideChapters') }}</h2>
          <button type="button" class="scs-close" :aria-label="$t('playback.close')" @click="$emit('close')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div ref="listEl" class="scs-list custom-scrollbar">
          <button
            v-for="chapter in chapters"
            :key="chapter.id"
            type="button"
            class="scs-row"
            :class="{ 'is-active': chapter.id === activeChapterId }"
            :data-chapter-id="chapter.id"
            @click="onSeekChapter(chapter)"
          >
            <div class="scs-thumb-wrap">
              <img class="scs-thumb" :src="chapter.imageUrl" alt="" loading="lazy" draggable="false" />
            </div>
            <div class="scs-meta">
              <span class="scs-label">{{ $t('playback.slideOrdinal', { number: chapterOrdinal(chapter) }) }}</span>
              <div class="scs-meta-row">
                <span class="scs-time">{{ formatTime(chapter.startTime) }}</span>
                <span v-if="chapter.id === activeChapterId" class="scs-watching">
                  {{ $t('playback.watching') }}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  chapterOrdinal,
  chapterSeekTarget,
  formatChapterTime as formatTime,
  type SlideChapterCard,
} from '../../composables/video/useShareSlideOverlay'

const props = defineProps<{
  chapters: SlideChapterCard[]
  activeChapterId: string | null
}>()

const emit = defineEmits<{
  seek: [time: number]
  close: []
}>()

const listEl = ref<HTMLElement | null>(null)

// Tapping a chapter is a navigation, so the sheet gets out of the way — the
// point of the seek is to watch what it lands on.
const onSeekChapter = (chapter: SlideChapterCard): void => {
  emit('seek', chapterSeekTarget(chapter))
  emit('close')
}

function scrollActiveIntoView(): void {
  const root = listEl.value
  const id = props.activeChapterId
  if (!root || !id) return
  const safe = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const el = root.querySelector(`[data-chapter-id="${safe}"]`) as HTMLElement | null
  el?.scrollIntoView({ block: 'nearest' })
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void nextTick(() => scrollActiveIntoView())
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  () => props.activeChapterId,
  async () => {
    await nextTick()
    scrollActiveIntoView()
  },
)
</script>

<style scoped>
.scs-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  /* Above the mobile bottom bar, which the sheet covers. */
  z-index: var(--z-modal);
}

.scs-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-modal) + 1);
  display: flex;
  flex-direction: column;
  max-height: 72vh;
  max-height: 72dvh;
  background-color: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -8px 32px var(--shadow-lg);
  animation: scs-rise 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes scs-rise {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .scs-sheet { animation: none; }
}

.scs-grabber {
  flex-shrink: 0;
  width: 2.25rem;
  height: 0.25rem;
  margin: 0.625rem auto 0;
  border-radius: 6.25rem;
  background-color: var(--border-strong);
  cursor: pointer;
}

.scs-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.625rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.scs-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-primary);
}

.scs-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.scs-close:active {
  background-color: var(--bg-hover);
}

.scs-list {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom);
}

.scs-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.scs-row:active {
  background-color: var(--bg-hover);
}

.scs-row.is-active {
  background-color: var(--bg-elevated);
}

.scs-thumb-wrap {
  flex: 0 0 7.5rem;
  width: 7.5rem;
  aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
}

.scs-row.is-active .scs-thumb-wrap {
  border-color: var(--accent);
}

.scs-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
}

.scs-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  min-width: 0;
}

.scs-meta-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.scs-label {
  font-size: 0.9375rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.scs-time {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background-color: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.scs-watching {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background-color: var(--accent);
  color: var(--text-on-accent);
  font-size: 0.6875rem;
  font-weight: 650;
  letter-spacing: 0.02em;
}
</style>
