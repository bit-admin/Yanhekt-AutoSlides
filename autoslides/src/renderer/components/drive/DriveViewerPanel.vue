<template>
  <div class="drive-viewer">
    <form class="drive-viewer-bar" @submit.prevent="viewer.open()">
      <input
        v-model="viewer.link.value"
        type="text"
        class="input-field drive-viewer-input"
        :placeholder="$t('drive.viewerPlaceholder')"
        :disabled="viewer.resolving.value"
        spellcheck="false"
        autocomplete="off"
      />
      <button type="submit" class="btn" :disabled="viewer.resolving.value || !viewer.link.value.trim()">
        {{ viewer.resolving.value ? $t('drive.viewerOpening') : $t('drive.viewerOpen') }}
      </button>
      <button v-if="viewer.result.value || viewer.error.value" type="button" class="btn btn--ghost" @click="viewer.clear()">
        {{ $t('drive.viewerClear') }}
      </button>
    </form>

    <p v-if="viewer.error.value" class="drive-viewer-error" role="alert">{{ errorText(viewer.error.value) }}</p>

    <EmptySetState
      v-if="!viewer.result.value && !viewer.error.value && !viewer.resolving.value"
      :title="$t('drive.viewerEmptyTitle')"
      :hint="$t('drive.viewerEmptyHint')"
    />

    <template v-if="result">
      <div class="drive-viewer-head">
        <div class="drive-viewer-titles">
          <div class="drive-viewer-title">{{ lectureTitle }}</div>
          <div class="drive-viewer-sub">
            <span>{{ $t('drive.viewerSlides', { count: result.urls.length }) }}</span>
            <span v-if="result.missing > 0"> · {{ $t('drive.viewerMissing', { count: result.missing }) }}</span>
            <span v-if="result.timeline"> · {{ $t('drive.timelineBadge') }}</span>
            <span v-if="result.lectureMeta?.instructor"> · {{ result.lectureMeta.instructor }}</span>
          </div>
        </div>
        <div class="drive-viewer-actions">
          <button type="button" class="btn" @click="openInBrowser">{{ $t('drive.openInBrowser') }}</button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="saving || result.urls.length === 0"
            @click="viewer.save()"
          >
            {{ saveLabel }}
          </button>
        </div>
      </div>

      <div v-if="saveItem && saveItem.status === 'conflict'" class="drive-viewer-conflict" role="status">
        <span>{{ $t('cloudNotes.exportConflictHint') }}</span>
        <button class="btn btn--sm btn--ghost" @click="viewer.saver.openFolder()">{{ $t('cloudNotes.exportOpenFolder') }}</button>
        <button class="btn btn--sm" @click="viewer.saver.resolveConflict('create')">{{ $t('cloudNotes.exportCreateNew') }}</button>
        <button class="btn btn--sm" @click="viewer.saver.resolveConflict('replace')">{{ $t('cloudNotes.exportReplace') }}</button>
      </div>
      <p v-else-if="saveItem && saveItem.status === 'done'" class="drive-viewer-saved" role="status">
        {{ $t('drive.viewerSaved') }}
        <button class="btn btn--sm btn--ghost" @click="viewer.saver.openFolder()">{{ $t('cloudNotes.exportOpenFolder') }}</button>
      </p>
      <p v-else-if="saveItem && saveItem.status === 'error'" class="drive-viewer-error" role="alert">
        {{ $t('cloudNotes.exportError') }}
      </p>

      <div class="drive-viewer-grid">
        <figure v-for="slide in viewer.slides.value" :key="slide.index" class="drive-viewer-slide">
          <img :src="slide.url" :alt="$t('drive.viewerSlideAlt', { n: slide.index + 1 })" loading="lazy" />
          <figcaption>
            <span>{{ slide.index + 1 }}</span>
            <span v-if="slide.firstSeen !== null" class="drive-viewer-time">{{ formatClock(slide.firstSeen) }}</span>
          </figcaption>
        </figure>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatClock, useShareViewer } from '@features/cloudNotes/useShareViewer'
import EmptySetState from '../shell/EmptySetState.vue'

const { t } = useI18n()
const viewer = useShareViewer()

const result = computed(() => viewer.result.value)
const saveItem = computed(() => viewer.saver.item.value)
const saving = computed(() => viewer.saver.exporting.value)

const lectureTitle = computed(() => {
  const meta = result.value?.lectureMeta
  const titled = [meta?.courseTitle, meta?.sessionTitle].filter(Boolean).join(' · ')
  return titled || t('drive.viewerUntitled')
})

const saveLabel = computed(() => {
  const item = saveItem.value
  if (saving.value && item?.status === 'downloading') {
    return t('cloudNotes.exportDownloading', { done: item.downloaded, total: item.total })
  }
  return t('drive.viewerSave')
})

function errorText(code: string): string {
  if (code === 'invalid-share-link') return t('lectures.cloneInvalid')
  return t('drive.viewerFailed')
}

function openInBrowser(): void {
  const link = viewer.link.value.trim()
  if (/^https:\/\//.test(link)) void window.electronAPI.shell.openExternal(link)
}

/** Open a link from elsewhere on the Drive page (Shares → Open in Viewer). */
function openLink(link: string): void {
  void viewer.open(link)
}

defineExpose({ openLink })
</script>

<style scoped>
.drive-viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.drive-viewer-bar {
  display: flex;
  gap: 6px;
}

.drive-viewer-input {
  flex: 1;
  min-width: 0;
}

.drive-viewer-error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.drive-viewer-saved,
.drive-viewer-conflict {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.drive-viewer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.drive-viewer-titles {
  min-width: 0;
}

.drive-viewer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.drive-viewer-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.drive-viewer-actions {
  display: flex;
  gap: 6px;
}

.drive-viewer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.drive-viewer-slide {
  margin: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  overflow: hidden;
}

.drive-viewer-slide img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  background: var(--bg-subtle);
}

.drive-viewer-slide figcaption {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.drive-viewer-time {
  color: var(--text-muted);
}
</style>
