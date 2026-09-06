<template>
  <!-- Named stand-in for the control bar's chapter icon: a 36px glyph in a row
       of six says nothing and is a poor tap target. Desktop sits it inline
       after the duration readout; mobile stacks it above the bar, where it
       gets a full-width row's worth of reach. -->
  <button
    type="button"
    class="chapter-trigger"
    :class="{ 'chapter-trigger--inline': inline, 'is-open': open }"
    :aria-expanded="open"
    :title="$t('playback.slideChapters')"
    @click="$emit('toggle')"
  >
    <svg class="chapter-trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2"/>
      <path d="M7 20h10"/>
      <path d="M8 8h5M8 11h8"/>
    </svg>
    <span class="chapter-trigger-label">{{ label }}</span>
    <svg class="chapter-trigger-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { chapterOrdinal, type SlideChapterCard } from '../../composables/video/useShareSlideOverlay'

const props = withDefaults(defineProps<{
  chapters: SlideChapterCard[]
  activeChapterId: string | null
  open: boolean
  /** Sits in the control row rather than on its own line above it. */
  inline?: boolean
}>(), { inline: false })

defineEmits<{ toggle: [] }>()

const { t } = useI18n()

// Name the chapter you're in, like YouTube's; before the first one resolves
// there is nothing to name, so fall back to the generic label.
const label = computed(() => {
  const active = props.chapters.find((c) => c.id === props.activeChapterId)
  return active
    ? t('playback.slideOrdinal', { number: chapterOrdinal(active) })
    : t('playback.slideChapters')
})
</script>

<style scoped>
.chapter-trigger {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 100%;
  min-height: 2rem;
  margin-bottom: 0.25rem;
  padding: 0.25rem 0.5rem 0.25rem 0.625rem;
  flex-shrink: 1;
  border: none;
  border-radius: 6.25rem;
  background-color: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.chapter-trigger:active {
  background-color: rgba(0, 0, 0, 0.75);
}

/* In-row variant: no line of its own to claim, and it reads against the bar's
   own scrim rather than the video, so it stays quieter until hovered. */
.chapter-trigger--inline {
  align-self: center;
  min-height: 1.75rem;
  margin-bottom: 0;
  background-color: rgba(255, 255, 255, 0.12);
}

.chapter-trigger--inline:hover {
  background-color: rgba(255, 255, 255, 0.22);
}

/* Open state has to stay legible as a state AND still answer a hover, so it
   sits a step above the resting fill and lifts again on its own hover. */
.chapter-trigger--inline.is-open {
  background-color: rgba(255, 255, 255, 0.26);
}

.chapter-trigger--inline.is-open:hover {
  background-color: rgba(255, 255, 255, 0.38);
}

.chapter-trigger-icon,
.chapter-trigger-chevron {
  flex-shrink: 0;
}

.chapter-trigger-chevron {
  opacity: 0.7;
  transition: transform 0.18s ease;
}

/* Points down while the panel it discloses is showing. */
.chapter-trigger.is-open .chapter-trigger-chevron {
  transform: rotate(90deg);
}

.chapter-trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
