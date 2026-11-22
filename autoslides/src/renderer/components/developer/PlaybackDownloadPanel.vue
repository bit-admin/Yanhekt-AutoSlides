<template>
  <section class="download-area" aria-labelledby="dev-playback-download">
    <div class="download-head">
      <div class="download-copy">
        <h2 id="dev-playback-download">{{ t('developer.playback.downloadArea.title') }}</h2>
        <p>{{ t('developer.playback.downloadArea.hint') }}</p>
      </div>
      <button type="button" class="btn" :disabled="!url.trim() || preparing" @click="download">
        {{ t('developer.playback.downloadArea.action') }}
      </button>
    </div>
    <p v-if="notice" class="download-notice" role="alert">{{ notice }}</p>
    <ul v-if="rows.length" class="download-rows">
      <li v-for="item in rows" :key="item.id" class="download-row">
        <div class="row-main">
          <span class="row-name" :title="item.name">{{ item.name }}{{ extensionOf(item) }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: `${item.progress}%` }" /></div>
          <span class="row-status" :class="{ 'row-error': item.status === 'error' }">{{ statusText(item) }}</span>
        </div>
        <button v-if="item.status === 'error'" type="button" class="btn btn--sm" @click="DownloadService.retryDownload(item.id)">
          {{ t('playback.retry') }}
        </button>
        <button v-else-if="item.status !== 'completed'" type="button" class="btn btn--sm" @click="DownloadService.removeFromQueue(item.id)">
          {{ t('advanced.cancel') }}
        </button>
        <button v-else-if="item.filePath" type="button" class="btn btn--sm" @click="reveal(item.filePath)">
          {{ t('developer.playback.downloadArea.reveal') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { queueErrorText } from '@common/recordingProblems'
import { yanhe2ActiveBadge } from '@features/platform/yanhe2AccountUi'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { downloadRowIsUnfinished } from '@shared/services/downloadRowState'

const props = defineProps<{ url: string }>()
const { t } = useI18n()
const preparing = ref(false)
const notice = ref('')
const rows = computed(() => DownloadService.downloadItems.filter((item) => item.devMedia).slice().reverse())

const extensionOf = (item: DownloadItem) => item.videoType === 'audio' ? '.aac' : '.mp4'

function statusText(item: DownloadItem) {
  if (item.status === 'queued') return t('downloads.queued')
  if (item.status === 'downloading') return `${t('downloads.downloading')} ${item.progress}%`
  if (item.status === 'processing') return `${t('downloads.processing')} ${item.progress}%`
  if (item.status === 'completed') return t('downloads.completed')
  return queueErrorText(item.error) || t('downloads.error')
}

async function download() {
  const url = props.url.trim()
  if (!url || preparing.value) return
  preparing.value = true
  notice.value = ''
  try {
    const prepared = await window.electronAPI.download.prepareDev(url, yanhe2ActiveBadge.value)
    if (prepared.kind === 'liveUnsupported') {
      notice.value = t('developer.playback.downloadArea.liveUnsupported')
    } else if (prepared.kind !== 'ok') {
      notice.value = t(`developer.playback.errors.${prepared.kind}`)
    } else if (DownloadService.downloadItems.some((item) => item.devMedia?.url === prepared.url && downloadRowIsUnfinished(item))) {
      notice.value = t('developer.playback.downloadArea.alreadyDownloading')
    } else {
      DownloadService.addToQueue({
        name: prepared.outputName,
        courseTitle: '',
        sessionTitle: '',
        sessionId: '',
        videoType: prepared.format === 'aac' ? 'audio' : 'camera',
        devMedia: { url: prepared.url, account: prepared.account, outputName: prepared.outputName },
      })
    }
  } catch {
    notice.value = t('developer.playback.downloadArea.failed')
  } finally {
    preparing.value = false
  }
}

async function reveal(filePath: string) {
  try {
    await window.electronAPI.lectures.reveal(filePath)
  } catch {
    notice.value = t('developer.playback.downloadArea.revealFailed')
  }
}
</script>

<style scoped>
.download-area {
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
}

.download-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
}

.download-copy {
  min-width: 0;
}

.download-copy h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.download-copy p {
  margin: 2px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.download-head > .btn {
  flex-shrink: 0;
}

.download-notice {
  margin: 0;
  padding: 0 12px 10px;
  color: var(--danger);
  font-size: 12px;
  line-height: 1.5;
}

.download-rows {
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border-color);
  list-style: none;
}

.download-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.download-row + .download-row {
  border-top: 1px solid var(--border-color);
}

.row-main {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  min-width: 0;
}

.row-name {
  overflow: hidden;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-status {
  max-width: 260px;
  color: var(--text-secondary);
  font-size: 12px;
  overflow-wrap: anywhere;
  text-align: end;
}

.row-error {
  color: var(--danger);
}

.row-main > .progress-bar {
  grid-column: 1 / -1;
  grid-row: 2;
}
</style>
