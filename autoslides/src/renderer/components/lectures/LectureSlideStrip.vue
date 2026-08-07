<template>
  <div class="lecture-slide-strip" role="region" :aria-label="$t('playback.slideChapters')">
    <div ref="scrollEl" class="slide-cards-scroll custom-scrollbar">
      <button
        v-for="chapter in chapters"
        :key="chapter.id"
        type="button"
        class="slide-card"
        :class="{ 'is-active': chapter.id === activeChapterId }"
        :data-chapter-id="chapter.id"
        :title="cardTitle(chapter)"
        @click="emit('seek', chapter.startTime)"
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

onMounted(() => {
  void nextTick(() => setupObserver())
})

onBeforeUnmount(() => {
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
  /* ~2× prior width so slide content is readable in the strip */
  flex: 0 0 240px;
  width: 240px;
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
  outline: 2px solid var(--accent, #3b82f6);
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
  border-color: var(--accent, #3b82f6);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent);
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
  color: #fff;
  background: color-mix(in srgb, var(--accent, #3b82f6) 88%, #000);
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
