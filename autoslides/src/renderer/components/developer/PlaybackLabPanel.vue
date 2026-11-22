<template>
  <div class="playback-lab">
    <header class="playback-toolbar">
      <slot name="switcher" />
      <form class="playback-form" @submit.prevent="play">
        <input
          v-model="urlText"
          ref="urlEl"
          class="text-input media-url"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          :aria-label="t('developer.playback.url')"
          aria-describedby="dev-playback-hint"
          :placeholder="t('developer.playback.placeholder')"
        />
        <button class="btn btn--primary" type="submit" :disabled="!urlText.trim()">
          {{ t('developer.playback.play') }}
        </button>
      </form>
    </header>

    <div class="playback-body custom-scrollbar">
      <p id="dev-playback-hint" class="playback-hint">{{ t('developer.playback.hint') }}</p>
      <div class="playback-workspace">
      <div class="playback-main custom-scrollbar">
      <section class="playback-monitor" aria-labelledby="dev-playback-preview">
        <div class="monitor-strip">
          <h2 id="dev-playback-preview">{{ t('developer.playback.preview') }}</h2>
          <span v-if="source" class="source-label">
            {{ t(`developer.api.platforms.${source.platform}`) }} <span class="format-tag">{{ source.format.toUpperCase() }}</span>
          </span>
          <span class="playback-status" role="status">{{ state === 'idle' ? '' : t(`developer.playback.states.${state}`) }}</span>
          <button v-if="state !== 'idle'" type="button" class="btn btn--sm" @click="onStopClick">
            {{ t('developer.playback.stop') }}
          </button>
        </div>
        <div class="player-stage">
        <component
          :is="source?.format === 'aac' ? 'audio' : 'video'"
          :key="source?.clientId ?? 'idle'"
          ref="mediaEl"
          class="media-player"
          :aria-label="t('developer.playback.preview')"
          controls
          autoplay
          playsinline
          @loadedmetadata="onLoadedMetadata"
          @canplay="onCanPlay"
          @playing="onPlaying"
          @waiting="onWaiting"
          @seeked="addLog('info', `seeked to ${formatClock(mediaEl?.currentTime ?? 0)}`)"
          @pause="onPause"
          @ended="onEnded"
          @error="onMediaError"
        />
        <p v-if="!source && problem" class="stage-message" role="alert">{{ problem }}</p>
        </div>
      </section>
      <PlaybackDownloadPanel :url="urlText" />
      </div>

      <aside class="playback-side" :aria-label="t('developer.playback.diagnostics')">
        <section class="side-card">
          <h2 class="side-title">{{ t('developer.playback.diagnostics') }}</h2>
          <dl class="stat-list">
            <div v-for="row in statRows" :key="row.id" class="stat-row">
              <dt>{{ t(`developer.playback.stats.${row.id}`) }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </section>
        <section class="side-card log-card">
          <div class="log-head">
            <h2 class="side-title">{{ t('developer.playback.eventLog') }}</h2>
            <button type="button" class="btn btn--sm" :disabled="!logEntries.length" @click="copyLog">
              {{ copied ? t('developer.playback.copied') : t('developer.playback.copyLog') }}
            </button>
          </div>
          <ol v-if="logEntries.length" ref="logEl" class="event-log custom-scrollbar" role="log" tabindex="0">
            <li v-for="entry in logEntries" :key="entry.id" :class="`log-${entry.level}`">
              <time>{{ formatOffset(entry.at) }}</time><span>{{ entry.text }}</span>
            </li>
          </ol>
          <p v-else class="log-empty">{{ t('developer.playback.logEmpty') }}</p>
        </section>
      </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Hls, { Events } from 'hls.js'
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DevPlaybackSource } from '@common/devPlayback'
import { yanhe2ActiveBadge } from '@features/platform/yanhe2AccountUi'
import { getHlsConfig } from '@features/video/hlsConfig'
import { attachEmptyRecordingGuard } from '@features/video/useVideoErrorRecovery'
import { createLatest } from '@shared/utils/latest'
import PlaybackDownloadPanel from './PlaybackDownloadPanel.vue'

const props = defineProps<{ active: boolean }>()
const { t } = useI18n()
const latest = createLatest()
const urlText = ref('')
const urlEl = ref<HTMLInputElement | null>(null)
const source = shallowRef<DevPlaybackSource | null>(null)
const mediaEl = ref<HTMLMediaElement | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'ended'>('idle')
const problem = ref('')
let hls: Hls | null = null

// The log and stats outlive a failed stream, so the cause stays readable. They
// never hold a media URL: the local proxy URL carries the account's login token.
type LogLevel = 'info' | 'warn' | 'error'
const MAX_LOG_ENTRIES = 200
const logEl = ref<HTMLElement | null>(null)
const logEntries = shallowRef<Array<{ id: number; at: number; level: LogLevel; text: string }>>([])
const copied = ref(false)
let logId = 0
let startedAt = 0
let sampleTimer: ReturnType<typeof setInterval> | null = null
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const emptyStats = () => ({
  startupMs: null as number | null,
  width: 0,
  height: 0,
  bufferAhead: null as number | null,
  bandwidth: null as number | null,
  latency: null as number | null,
  segments: 0,
  segmentBytes: 0,
  segmentSeconds: 0,
  droppedFrames: null as number | null,
  totalFrames: 0,
  stalls: 0,
})
const stats = reactive(emptyStats())

const formatBits = (bits: number) => bits >= 1e6 ? `${(bits / 1e6).toFixed(2)} Mbps` : `${Math.round(bits / 1e3)} kbps`
const formatOffset = (seconds: number) => `+${seconds.toFixed(2)}s`
function formatClock(seconds: number) {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${tail}` : tail
}

const statRows = computed(() => {
  const none = '—'
  const rows = [
    { id: 'startup', value: stats.startupMs === null ? none : `${Math.round(stats.startupMs)} ms` },
    { id: 'resolution', value: stats.width ? `${stats.width} × ${stats.height}` : none },
    { id: 'bufferAhead', value: stats.bufferAhead === null ? none : `${stats.bufferAhead.toFixed(1)} s` },
    { id: 'bitrate', value: stats.segmentSeconds > 0 ? formatBits(stats.segmentBytes * 8 / stats.segmentSeconds) : none },
    { id: 'bandwidth', value: stats.bandwidth ? formatBits(stats.bandwidth) : none },
    { id: 'segments', value: stats.segments ? String(stats.segments) : none },
    { id: 'droppedFrames', value: stats.droppedFrames === null ? none : `${stats.droppedFrames} / ${stats.totalFrames}` },
    { id: 'stalls', value: String(stats.stalls) },
  ]
  if (stats.latency !== null) rows.splice(3, 0, { id: 'latency', value: `${stats.latency.toFixed(1)} s` })
  return rows
})

function addLog(level: LogLevel, text: string) {
  const el = logEl.value
  const pinned = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24
  const at = startedAt ? (performance.now() - startedAt) / 1000 : 0
  logEntries.value = [...logEntries.value, { id: ++logId, at, level, text }].slice(-MAX_LOG_ENTRIES)
  if (pinned) void nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
}

function sampleStats() {
  const media = mediaEl.value
  if (!media) return
  let ahead = 0
  for (let i = 0; i < media.buffered.length; i += 1) {
    if (media.buffered.start(i) <= media.currentTime && media.currentTime <= media.buffered.end(i)) {
      ahead = media.buffered.end(i) - media.currentTime
      break
    }
  }
  stats.bufferAhead = ahead
  if (media instanceof HTMLVideoElement) {
    const quality = media.getVideoPlaybackQuality()
    stats.droppedFrames = quality.droppedVideoFrames
    stats.totalFrames = quality.totalVideoFrames
  }
  if (hls) {
    stats.bandwidth = Number.isFinite(hls.bandwidthEstimate) ? hls.bandwidthEstimate : null
    if (source.value?.live && hls.latency > 0) stats.latency = hls.latency
  }
}

function stopSampling() {
  if (sampleTimer) clearInterval(sampleTimer)
  sampleTimer = null
}

async function copyLog() {
  const text = logEntries.value.map((entry) => `${formatOffset(entry.at)} [${entry.level}] ${entry.text}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch {
    copied.value = false
  }
}

function release(clientId: string) {
  void window.electronAPI.video.unregisterClient(clientId).catch(() => undefined)
}

function stop() {
  latest.cancel()
  stopSampling()
  hls?.destroy()
  hls = null
  const media = mediaEl.value
  if (media?.hasAttribute('src')) {
    media.pause()
    media.removeAttribute('src')
    media.load()
  }
  if (source.value) release(source.value.clientId)
  source.value = null
  state.value = 'idle'
  problem.value = ''
}

function fail(message: string) {
  addLog('error', message)
  stop()
  problem.value = message
}

async function play() {
  const url = urlText.value.trim()
  if (!url || !props.active) return
  stop()
  Object.assign(stats, emptyStats())
  logEntries.value = []
  startedAt = performance.now()
  const current = latest.begin()
  state.value = 'loading'
  addLog('info', 'preparing proxy')
  try {
    const result = await window.electronAPI.video.prepareDevPlayback(url, yanhe2ActiveBadge.value)
    if (!current()) {
      if (result.kind === 'ok') release(result.clientId)
      return
    }
    if (result.kind !== 'ok') {
      fail(t(`developer.playback.errors.${result.kind}`))
      return
    }
    source.value = result
    addLog('info', `proxy ready: ${result.platform}, ${result.format}${result.live ? ', live' : ''}`)
    sampleTimer = setInterval(sampleStats, 500)
    await nextTick()
    if (!current()) return
    const media = mediaEl.value
    if (!media) throw new Error('No preview element')

    if (result.format !== 'hls') {
      media.src = result.url
    } else if (Hls.isSupported()) {
      hls = new Hls(getHlsConfig(result.live ? 'live' : 'recorded'))
      attachEmptyRecordingGuard(hls, () => {
        if (current()) fail(t('developer.playback.errors.emptyRecording'))
      })
      let levelLogged = false
      hls.on(Events.MANIFEST_PARSED, (_event, data) => {
        addLog('info', `manifest parsed: ${data.levels.length} level(s)`)
      })
      hls.on(Events.LEVEL_LOADED, (_event, data) => {
        if (levelLogged) return // A live playlist reloads every few seconds.
        levelLogged = true
        addLog('info', `playlist loaded: ${data.details.fragments.length} segments, ${formatClock(data.details.totalduration)}`)
      })
      hls.on(Events.FRAG_LOADED, (_event, data) => {
        stats.segments += 1
        stats.segmentBytes += data.frag.stats.loaded
        stats.segmentSeconds += data.frag.duration
      })
      hls.on(Events.ERROR, (_event, data) => {
        if (!current()) return
        const status = data.response?.code
        if (!data.fatal) {
          addLog('warn', `${data.details}${status ? ` (HTTP ${status})` : ''}`)
          return
        }
        fail(status && status >= 400
          ? t('developer.playback.errors.http', { status })
          : t('developer.playback.errors.hls', { detail: data.details }))
      })
      hls.loadSource(result.url)
      hls.attachMedia(media)
    } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
      media.src = result.url
    } else {
      fail(t('developer.playback.errors.hlsUnsupported'))
    }
  } catch {
    if (current()) fail(t('developer.playback.errors.proxyFailed'))
  }
}

function onStopClick() {
  addLog('info', 'stopped')
  stop()
  urlEl.value?.focus()
}

function onLoadedMetadata() {
  const media = mediaEl.value
  if (media instanceof HTMLVideoElement) {
    stats.width = media.videoWidth
    stats.height = media.videoHeight
  }
  const length = media && Number.isFinite(media.duration) ? `, ${formatClock(media.duration)}` : ''
  addLog('info', `metadata${stats.width ? `: ${stats.width}×${stats.height}` : ''}${length}`)
}

function onCanPlay() {
  if (state.value === 'loading') addLog('info', 'can play')
  if (state.value === 'loading' || state.value === 'buffering') state.value = 'ready'
}

function onPlaying() {
  if (stats.startupMs === null) stats.startupMs = performance.now() - startedAt
  if (state.value !== 'playing') addLog('info', 'playing')
  state.value = 'playing'
}

function onWaiting() {
  // A seek also waits for data, but it is not a stall.
  if (stats.startupMs !== null && !mediaEl.value?.seeking) {
    stats.stalls += 1
    addLog('warn', 'stalled, buffering')
  }
  state.value = 'buffering'
}

function onPause() {
  if (source.value && !mediaEl.value?.ended) {
    state.value = 'paused'
    addLog('info', `paused at ${formatClock(mediaEl.value?.currentTime ?? 0)}`)
  }
}

function onEnded() {
  state.value = 'ended'
  addLog('info', 'ended')
}

function onMediaError() {
  const code = mediaEl.value?.error?.code
  if (source.value && code) fail(t('developer.playback.errors.media', { code }))
}

watch(() => props.active, (active) => { if (!active) stop() })
// Only Yanhe 2.0 playback belongs to an account. A request still preparing used the old badge.
watch(yanhe2ActiveBadge, () => {
  if (state.value !== 'idle' && (!source.value || source.value.platform === 'yanhe2')) stop()
})
onBeforeUnmount(() => {
  stop()
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.playback-lab {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.playback-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.playback-form {
  display: flex;
  flex: 1 1 260px;
  gap: 8px;
  min-width: 0;
}

.media-url {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

.playback-form > .btn {
  flex-shrink: 0;
}

.playback-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: 12px 20px 20px;
  container-type: inline-size;
}

.playback-workspace {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.playback-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.playback-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.side-card {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
}

.side-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.side-card > .side-title {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.stat-list {
  margin: 0;
  padding: 6px 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 12px;
}

.stat-row dt {
  color: var(--text-secondary);
}

.stat-row dd {
  margin: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.log-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 160px;
  overflow: hidden;
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--border-color);
}

.event-log {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 6px 12px;
  overflow-y: auto;
  list-style: none;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
}

.event-log li {
  display: flex;
  gap: 8px;
}

.event-log time {
  flex-shrink: 0;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.event-log span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.log-warn span {
  color: var(--warning);
}

.log-error span {
  color: var(--danger);
}

.log-empty {
  margin: 0;
  padding: 12px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

@container (max-width: 820px) {
  .playback-workspace {
    flex: none;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
  }

  .playback-main {
    overflow: visible;
  }

  .log-card {
    flex: none;
    height: 240px;
  }
}

.playback-hint {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.playback-monitor {
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
}

.monitor-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 12px;
  min-height: 32px;
  border-bottom: 1px solid var(--border-color);
}

.monitor-strip > h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.source-label,
.playback-status {
  color: var(--text-secondary);
  font-size: 12px;
}

.source-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.format-tag {
  padding: 1px 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 11px;
}

.playback-status {
  margin-inline-start: auto;
}

.player-stage {
  position: relative;
}

.stage-message {
  position: absolute;
  inset: 0 0 56px;
  z-index: var(--z-float);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 16px 24px;
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
  pointer-events: none;
}

.media-player {
  display: block;
  width: 100%;
}

video.media-player {
  aspect-ratio: 16 / 9;
  max-height: max(260px, calc(100vh - 390px));
  background: var(--bg-page-alt);
}

audio.media-player {
  box-sizing: border-box;
  height: 72px;
  padding: 8px 12px;
}
</style>
