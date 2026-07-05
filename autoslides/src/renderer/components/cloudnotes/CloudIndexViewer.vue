<template>
  <section class="ci-viewer">
    <div v-if="loading" class="ci-viewer-status">{{ $t('cloudIndex.loading') }}</div>
    <div v-else-if="error" class="ci-viewer-status ci-viewer-status--error">{{ $t('cloudIndex.loadError') }}</div>
    <div v-else-if="!detail" class="ci-viewer-status ci-viewer-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <p>{{ $t('cloudIndex.selectFile') }}</p>
    </div>

    <template v-else>
      <div class="ci-viewer-head">
        <h1 class="ci-viewer-title">{{ detail.courseTitle }}</h1>
        <p v-if="detail.sessionTitle" class="ci-viewer-session">{{ detail.sessionTitle }}</p>
        <p class="ci-viewer-meta">{{ $t('cloudIndex.slideCountShared', { n: detail.imageCount }) }}</p>
      </div>
      <div class="ci-viewer-scroll custom-scrollbar">
        <div class="ci-viewer-stack">
          <img
            v-for="(url, i) in detail.urls"
            :key="i"
            :src="url"
            :alt="`Slide ${i + 1}`"
            loading="lazy"
            @click="zoomUrl = url"
          />
        </div>
      </div>
    </template>

    <!-- Anchored to the page root (.cloud-notes-tab, the nearest positioned
         ancestor) so the zoom overlay covers the whole Cloud Notes page — all
         three panels — but not the window chrome or app sidebar. -->
    <div v-if="zoomUrl" class="ci-lightbox" @click="zoomUrl = null">
      <img class="ci-lightbox-img" :src="zoomUrl" alt="" @click.stop />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { IndexViewerDetail } from '@features/cloudNotes/useCloudIndexBrowse'

defineProps<{
  detail: IndexViewerDetail | null
  loading: boolean
  error: boolean
}>()

const zoomUrl = ref<string | null>(null)

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && zoomUrl.value) zoomUrl.value = null
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* Deliberately NOT position:relative — the lightbox inside must anchor to the
   page root (.cloud-notes-tab) so it spans all three panels. */
.ci-viewer {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  overflow: hidden;
}

.ci-viewer-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
}

.ci-viewer-status--error {
  color: var(--danger);
}

.ci-viewer-empty svg {
  color: var(--text-muted);
  opacity: 0.7;
}

.ci-viewer-head {
  flex-shrink: 0;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--border-color);
}

.ci-viewer-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  word-break: break-word;
  color: var(--text-primary);
}

.ci-viewer-session {
  margin: 6px 0 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.ci-viewer-meta {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.ci-viewer-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px 32px;
}

.ci-viewer-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
}

.ci-viewer-stack img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  display: block;
  cursor: zoom-in;
  background: var(--bg-elevated);
}

.ci-lightbox {
  position: absolute;
  inset: 0;
  background: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-super-modal);
  cursor: zoom-out;
  padding: 48px;
}

.ci-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  cursor: default;
}
</style>
