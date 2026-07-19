<template>
  <Transition name="viewer-fade">
    <div
      v-if="item"
      class="viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="item.name"
    >
      <!-- Top chrome: back · counter · quiet actions (iCloud Photos detail) -->
      <header class="viewer-top">
        <div class="viewer-top-left">
          <button type="button" class="viewer-icon-btn" :title="$t('trash.back')" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div class="viewer-top-center">
          <div class="viewer-meta-title">{{ slideLabel }}</div>
          <div class="viewer-meta-sub">
            <span v-if="indexLabel">{{ indexLabel }}</span>
            <span v-if="statusLabel" class="viewer-meta-dot">·</span>
            <span v-if="statusLabel">{{ statusLabel }}</span>
            <span v-if="reasonText" class="viewer-meta-dot">·</span>
            <span v-if="reasonText">{{ reasonText }}</span>
          </div>
        </div>

        <div class="viewer-top-right">
          <button
            v-if="item.status === 'removed'"
            type="button"
            class="viewer-text-btn"
            @click="$emit('restore', item)"
          >
            {{ $t('trash.restore') }}
          </button>
          <button
            v-else
            type="button"
            class="viewer-icon-btn viewer-icon-btn--danger"
            :title="$t('trash.delete')"
            @click="$emit('delete', item)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button type="button" class="viewer-icon-btn" :title="$t('playback.close')" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Stage -->
      <div class="viewer-stage" @click.self="$emit('close')">
        <button
          v-if="canPrev"
          type="button"
          class="viewer-nav viewer-nav--prev"
          :aria-label="$t('slides.prevSlide')"
          @click="go(-1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <img v-if="imageUrl" class="viewer-image" :src="imageUrl" :alt="item.name" />

        <button
          v-if="canNext"
          type="button"
          class="viewer-nav viewer-nav--next"
          :aria-label="$t('slides.nextSlide')"
          @click="go(1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <!-- Filmstrip -->
      <div v-if="items.length > 1" class="viewer-strip-wrap">
        <div ref="stripEl" class="viewer-strip custom-scrollbar">
          <button
            v-for="(entry, i) in items"
            :key="entry.id"
            type="button"
            class="viewer-thumb"
            :class="{ active: entry.id === item.id, removed: entry.status === 'removed' }"
            @click="$emit('navigate', entry)"
          >
            <img v-if="thumbUrl(entry)" :src="thumbUrl(entry)" :alt="entry.name" />
            <span v-else class="viewer-thumb-fallback">{{ i + 1 }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// Full-bleed iCloud Photos–style viewer: quiet chrome, prev/next, bottom filmstrip.
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ResultsItem } from '../../composables/resultsTypes'

const props = withDefaults(
  defineProps<{
    item: ResultsItem | null
    items?: ResultsItem[]
    thumbnails: Record<string, string>
  }>(),
  { items: () => [] },
)

const emit = defineEmits<{
  close: []
  restore: [item: ResultsItem]
  delete: [item: ResultsItem]
  navigate: [item: ResultsItem]
}>()

const { t } = useI18n()
const stripEl = ref<HTMLElement | null>(null)

// Path-keyed thumbs (see useResultsView) — never use trash-entry UUID as key.
function thumbUrl(item: ResultsItem): string {
  const key =
    item.status === 'removed'
      ? item.trashPath || item.originalPath
      : item.imagePath || item.originalPath || item.id
  return (key && props.thumbnails[key]) || ''
}

const imageUrl = computed(() => (props.item ? thumbUrl(props.item) : ''))

const currentIndex = computed(() => {
  if (!props.item) return -1
  return props.items.findIndex((x) => x.id === props.item!.id)
})

const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const indexLabel = computed(() => {
  if (currentIndex.value < 0 || props.items.length === 0) return ''
  return `${currentIndex.value + 1} / ${props.items.length}`
})

const slideLabel = computed(() => {
  if (!props.item) return ''
  if (currentIndex.value >= 0) return t('trash.slideNumber', { n: currentIndex.value + 1 })
  return props.item.name
})

const statusLabel = computed(() => {
  if (!props.item) return ''
  return props.item.status === 'active' ? t('trash.active') : t('trash.removed')
})

const reasonText = computed(() => {
  switch (props.item?.reason) {
    case 'duplicate':
      return t('trash.duplicate')
    case 'exclusion':
      return t('trash.exclusion')
    case 'ai_filtered':
      return t('trash.aiFilteredNotSlide')
    case 'ai_filtered_edit':
      return t('trash.aiFilteredEdit')
    case 'manual':
      return t('trash.manual')
    default:
      return ''
  }
})

function go(delta: number) {
  const i = currentIndex.value + delta
  if (i < 0 || i >= props.items.length) return
  emit('navigate', props.items[i])
}

function onKeydown(e: KeyboardEvent) {
  if (!props.item) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    go(-1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    go(1)
  }
}

async function scrollActiveThumbIntoView() {
  await nextTick()
  const root = stripEl.value
  if (!root) return
  const active = root.querySelector('.viewer-thumb.active') as HTMLElement | null
  active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
}

watch(
  () => props.item?.id,
  (id) => {
    if (id) {
      document.body.style.overflow = 'hidden'
      void scrollActiveThumbIntoView()
    } else {
      document.body.style.overflow = ''
    }
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1d1d1f;
}

html[data-theme='dark'] .viewer {
  background: #000000;
  color: #f5f5f7;
}

.viewer-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0.4rem 0.85rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  background: #fff;
}

html[data-theme='dark'] .viewer-top {
  background: #000;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.viewer-top-left,
.viewer-top-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.viewer-top-right {
  justify-content: flex-end;
}

.viewer-top-center {
  text-align: center;
  min-width: 0;
  padding: 0 0.5rem;
}

.viewer-meta-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-meta-sub {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: #6e6e73;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

html[data-theme='dark'] .viewer-meta-sub {
  color: #a1a1a6;
}

.viewer-meta-dot {
  margin: 0 0.25rem;
  opacity: 0.55;
}

.viewer-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #1d1d1f;
  cursor: pointer;
}

html[data-theme='dark'] .viewer-icon-btn {
  color: #f5f5f7;
}

.viewer-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

html[data-theme='dark'] .viewer-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.viewer-icon-btn--danger:hover {
  color: #ff3b30;
  background: color-mix(in srgb, #ff3b30 10%, transparent);
}

.viewer-text-btn {
  border: none;
  background: transparent;
  color: #0071e3;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  cursor: pointer;
}

.viewer-text-btn:hover {
  background: color-mix(in srgb, #0071e3 10%, transparent);
}

.viewer-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 3.5rem 0.75rem;
  background: #fafafa;
}

html[data-theme='dark'] .viewer-stage {
  background: #0a0a0a;
}

.viewer-image {
  max-width: min(1100px, 100%);
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 0.25rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #1d1d1f;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
}

html[data-theme='dark'] .viewer-nav {
  background: rgba(44, 44, 46, 0.92);
  color: #f5f5f7;
}

.viewer-nav:hover {
  background: #fff;
}

.viewer-nav--prev {
  left: 0.75rem;
}

.viewer-nav--next {
  right: 0.75rem;
}

.viewer-strip-wrap {
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  padding: 0.55rem 0.75rem 0.7rem;
}

html[data-theme='dark'] .viewer-strip-wrap {
  background: #000;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.viewer-strip {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scroll-snap-type: x proximity;
}

.viewer-thumb {
  flex: 0 0 auto;
  width: 72px;
  aspect-ratio: 16 / 9;
  border: 2px solid transparent;
  border-radius: 0.3rem;
  padding: 0;
  overflow: hidden;
  background: #f0f0f2;
  cursor: pointer;
  scroll-snap-align: center;
}

html[data-theme='dark'] .viewer-thumb {
  background: #1c1c1e;
}

.viewer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.viewer-thumb.active {
  border-color: #0071e3;
}

html[data-theme='dark'] .viewer-thumb.active {
  border-color: #0a84ff;
}

.viewer-thumb.removed {
  opacity: 0.55;
}

.viewer-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 0.7rem;
  color: #86868b;
}

.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.18s ease;
}

.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .viewer-stage {
    padding: 0.5rem 0.5rem 0.35rem;
  }

  .viewer-nav {
    display: none;
  }

  .viewer-thumb {
    width: 56px;
  }
}
</style>
