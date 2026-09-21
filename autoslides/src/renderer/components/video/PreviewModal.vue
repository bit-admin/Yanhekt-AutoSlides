<template>
  <div v-if="slide" ref="modalEl" class="slide-modal" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ slide.title }}</h3>
        <div class="modal-actions">
          <button @click="copySlide(slide)" class="modal-close-btn" :title="$t('playback.copySlideTip')">
            <svg v-if="copyState === 'copied'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {{ copyLabel }}
          </button>
          <button @click="$emit('delete', slide)" class="btn btn--danger modal-delete-btn" :title="$t('playback.moveToTrashTip')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            {{ $t('playback.moveToTrash') }}
          </button>
          <button @click="$emit('close')" class="modal-close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            {{ $t('playback.close') }}
          </button>
        </div>
      </div>
      <div class="modal-body">
        <img :src="slide.dataUrl" :alt="slide.title" class="modal-image" />
        <div class="slide-metadata">
          <p><strong>{{ $t('playback.extractedAt') }}</strong> {{ formatSlideTime(slide.timestamp) }}</p>
          <p><strong>{{ $t('playback.fileName') }}</strong> {{ slide.title }}.png</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExtractedSlide } from '@shared/processing'
import { createLogger } from '@shared/utils/logger'

const logger = createLogger('PreviewModal')

const props = defineProps<{
  slide: ExtractedSlide | null
  formatSlideTime: (timestamp: string) => string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'delete', slide: ExtractedSlide): void
}>()

const { t } = useI18n()

// Copy the slide as a PNG image, so it pastes straight into Word, Keynote,
// chat apps, etc. `dataUrl` is always a PNG (slideWriter's canvas.toDataURL).
const modalEl = ref<HTMLElement | null>(null)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const copyLabel = computed(() => {
  if (copyState.value === 'copied') return t('playback.slideCopied')
  if (copyState.value === 'failed') return t('playback.copySlideFailed')
  return t('playback.copySlide')
})

const setCopyState = (state: 'idle' | 'copied' | 'failed') => {
  copyState.value = state
  if (copyResetTimer) clearTimeout(copyResetTimer)
  copyResetTimer = state === 'idle' ? null : setTimeout(() => { copyState.value = 'idle' }, 1500)
}

const copySlide = async (slide: ExtractedSlide) => {
  try {
    const blob = await (await fetch(slide.dataUrl)).blob()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    setCopyState('copied')
  } catch (error) {
    logger.warn('Failed to copy slide image:', error)
    setCopyState('failed')
  }
}

// Cmd/Ctrl+C copies the previewed slide, unless the user has selected text
// (e.g. the file name) or is typing in a field — then the native copy wins.
// Every playback tab stays mounted, so a background tab can hold an open
// preview too: only the one actually on screen (has layout boxes) answers.
const onKeydown = (event: KeyboardEvent) => {
  if (!props.slide || !modalEl.value?.getClientRects().length) return
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  if (window.getSelection()?.toString()) return
  event.preventDefault()
  void copySlide(props.slide)
}

watch(() => props.slide, () => setCopyState('idle'))
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (copyResetTimer) clearTimeout(copyResetTimer)
})
</script>

<style scoped>
.slide-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-lightbox);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: var(--bg-modal);
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  gap: 8px;
}

.modal-delete-btn {
  font-size: 13px;
}

.modal-close-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-sm);
}

.slide-metadata {
  padding: 12px;
  background-color: var(--bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.slide-metadata p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.slide-metadata strong {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 95vw;
    max-height: 95vh;
  }

  .modal-header {
    padding: 12px 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-image {
    max-height: 60vh;
  }
}
</style>
