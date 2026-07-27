<template>
  <!--
    Emby-inspired immersive local player.
    Reuses dual-controls tokens from playerControlBar.css; layout is cinema-style
    (floating top bar + bottom overlay) rather than a separate app toolbar.
  -->
  <div
    class="lecture-player"
    tabindex="0"
    ref="rootEl"
    :class="{ 'controls-hidden': !controlsVisible && isPlaying }"
    @keydown="onKeydown"
    @mousemove="showControls"
    @mouseleave="onPointerLeave"
  >
    <!-- Floating top bar -->
    <div
      class="top-bar"
      :class="{ 'controls-hidden': !controlsVisible && isPlaying }"
      @mouseenter="pointerOverControls = true"
      @mouseleave="pointerOverControls = false"
    >
      <button type="button" class="top-back" @click="emit('back')" :title="$t('lectures.libraryBack')">
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="top-titles" :title="headerTitle">
        <div class="top-episode">{{ episodeLine }}</div>
        <div class="top-course">{{ course.title }}</div>
      </div>

      <div class="top-right">
        <div class="single-volume top-volume">
          <button
            class="dual-icon-button"
            type="button"
            @click="toggleMute"
            :title="isMuted || effectiveVolume <= 0 ? $t('playback.unmute') : $t('playback.mute')"
          >
            <svg v-if="!(isMuted || effectiveVolume <= 0)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>
          <input
            class="dual-seek single-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="effectiveVolume"
            :style="{ '--dual-progress': volumeProgress }"
            :aria-label="$t('playback.volume')"
            @input="onVolumeInput"
          />
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="player-error">
      <span>{{ errorMessage }}</span>
      <div class="player-error-actions">
        <button
          v-for="path in failedPaths"
          :key="path"
          type="button"
          class="btn btn--primary btn--sm"
          @click="openExternally(path)"
        >
          {{ $t('lectures.openExternally') }}
        </button>
        <button
          v-if="failedPaths[0]"
          type="button"
          class="btn btn--sm"
          @click="reveal(failedPaths[0])"
        >
          {{ $t('lectures.revealInFolder') }}
        </button>
      </div>
    </div>

    <!-- Stage -->
    <div ref="stageEl" class="stage">
      <!-- Dual -->
      <div v-if="isDualMode" class="dual-video-grid">
        <div class="dual-video-panel" :style="{ order: cameraOrder }">
          <div class="dual-video-label">{{ $t('playback.streamCamera') }}</div>
          <video
            :ref="setCameraRef"
            class="dual-video-player"
            preload="metadata"
            playsinline
            @timeupdate="onTimeUpdate"
            @play="onPlayStateChanged"
            @pause="onPlayStateChanged"
            @ended="onPlayStateChanged"
            @click="togglePlay"
          />
        </div>
        <div class="dual-video-panel" :style="{ order: screenOrder }">
          <div class="dual-video-label">{{ $t('playback.streamScreen') }}</div>
          <video
            :ref="setScreenRef"
            class="dual-video-player"
            preload="metadata"
            playsinline
            @timeupdate="onTimeUpdate"
            @play="onPlayStateChanged"
            @pause="onPlayStateChanged"
            @ended="onPlayStateChanged"
            @click="togglePlay"
          />
        </div>
      </div>

      <!-- Single -->
      <div v-else class="single-stage">
        <video
          :ref="setSingleRef"
          class="dual-video-player single-video-player"
          preload="metadata"
          playsinline
          @timeupdate="onTimeUpdate"
          @play="onPlayStateChanged"
          @pause="onPlayStateChanged"
          @ended="onPlayStateChanged"
          @click="togglePlay"
        />
      </div>

      <div v-if="isLoading" class="player-loading">
        <div class="spinner"></div>
      </div>

      <!-- Bottom overlay controls -->
      <div
        class="bottom-overlay"
        :class="{ 'controls-hidden': !controlsVisible && isPlaying }"
        @mouseenter="pointerOverControls = true"
        @mouseleave="pointerOverControls = false"
      >
        <div class="meta-row">
          <div class="meta-left">
            <div class="meta-episode">{{ episodeLine }}</div>
            <div class="meta-course">{{ course.title }}</div>
          </div>
          <div class="meta-time">
            {{ formatTime(currentTime) }}
            <span class="meta-time-sep">/</span>
            {{ canSeek ? formatTime(duration) : '—' }}
          </div>
        </div>

        <input
          class="dual-seek seek-bar"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.1"
          :value="currentTime"
          :style="{ '--dual-progress': seekProgress }"
          :disabled="!canSeek"
          @input="onSeekInput"
        />

        <div class="transport-row">
          <div class="transport-left">
            <button
              class="dual-icon-button skip-btn"
              type="button"
              @click="seek(currentTime - 10)"
              title="-10s"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11 18V6l-8.5 6L11 18zm.5-6l8.5 6V6l-8.5 6z"/>
              </svg>
            </button>

            <button
              class="dual-icon-button transport-play"
              type="button"
              @click="togglePlay"
              :title="isPlaying ? $t('playback.dual.pause') : $t('playback.dual.play')"
            >
              <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="8,5 19,12 8,19"/>
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14"/>
                <rect x="14" y="5" width="4" height="14"/>
              </svg>
            </button>

            <button
              class="dual-icon-button skip-btn"
              type="button"
              @click="seek(currentTime + 10)"
              title="+10s"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 6v12l8.5-6L13 6zM12.5 12L4 6v12l8.5-6z"/>
              </svg>
            </button>
          </div>

          <div class="transport-right">
            <!-- Stream mode (moved out of top bar) — icon matches current mode -->
            <div v-if="hasStreamChoices" class="dual-popover-anchor">
              <button
                class="dual-icon-button stream-mode-btn"
                type="button"
                @click="toggleStreamPanel"
                :title="streamModeTitle"
              >
                <!-- Dual: two side-by-side panes (Emby dual-view style) -->
                <svg v-if="streamMode === 'dual'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2.5" y="5" width="8.5" height="14" rx="1.5"/>
                  <rect x="13" y="5" width="8.5" height="14" rx="1.5"/>
                </svg>
                <!-- Screen -->
                <svg v-else-if="streamMode === 'screen'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="13" rx="2"/>
                  <path d="M8 21h8"/>
                  <path d="M12 17v4"/>
                </svg>
                <!-- Camera -->
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M23 7l-7 5 7 5V7z"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </button>
              <div v-if="showStreamPanel" class="dual-popover dual-speed-popover">
                <button
                  v-if="session.screen && session.camera"
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: streamMode === 'dual' }"
                  @click="pickStreamMode('dual')"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <rect x="2.5" y="5" width="8.5" height="14" rx="1.5"/>
                    <rect x="13" y="5" width="8.5" height="14" rx="1.5"/>
                  </svg>
                  <span>{{ $t('playback.bothStreams') }}</span>
                </button>
                <button
                  v-if="session.screen"
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: streamMode === 'screen' }"
                  @click="pickStreamMode('screen')"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="13" rx="2"/>
                    <path d="M8 21h8"/>
                    <path d="M12 17v4"/>
                  </svg>
                  <span>{{ $t('playback.streamScreen') }}</span>
                </button>
                <button
                  v-if="session.camera"
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: streamMode === 'camera' }"
                  @click="pickStreamMode('camera')"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="M23 7l-7 5 7 5V7z"/>
                    <rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                  <span>{{ $t('playback.streamCamera') }}</span>
                </button>
              </div>
            </div>

            <!-- Dual audio source -->
            <div v-if="isDualMode" class="dual-popover-anchor">
              <button
                class="dual-icon-button"
                type="button"
                @click="toggleAudioPanel"
                :title="$t('playback.dual.audioSource')"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 14v-2a8 8 0 0 1 16 0v2"/>
                  <rect x="3" y="14" width="4" height="6" rx="1.5"/>
                  <rect x="17" y="14" width="4" height="6" rx="1.5"/>
                </svg>
              </button>
              <div v-if="showAudioPanel" class="dual-popover dual-audio-popover">
                <button
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: dualAudioSource === 'screen' }"
                  @click="setAudio('screen')"
                >
                  <span>{{ $t('playback.dual.screenAudio') }}</span>
                </button>
                <button
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: dualAudioSource === 'camera' }"
                  @click="setAudio('camera')"
                >
                  <span>{{ $t('playback.dual.cameraAudio') }}</span>
                </button>
              </div>
            </div>

            <!-- Speed -->
            <div class="dual-popover-anchor">
              <button
                class="dual-speed-button"
                type="button"
                @click="toggleSpeedPanel"
                :title="$t('playback.playbackSpeed')"
              >
                {{ playbackRate }}x
              </button>
              <div v-if="showSpeedPanel" class="dual-popover dual-speed-popover custom-scrollbar">
                <button
                  v-for="rate in playbackRateOptions"
                  :key="rate"
                  type="button"
                  class="dual-popover-option"
                  :class="{ active: Number(playbackRate) === rate }"
                  @click="setRate(rate)"
                >
                  <span>{{ rate }}x</span>
                </button>
              </div>
            </div>

            <button
              v-if="isDualMode"
              class="dual-icon-button"
              type="button"
              @click="toggleOrder"
              :title="$t('playback.dual.swapOrder')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M7 7h11l-4-4"/>
                <path d="M17 17H6l4 4"/>
              </svg>
            </button>

            <button
              class="dual-icon-button"
              type="button"
              @click="toggleFullscreen"
              :title="$t('playback.dual.fullscreen')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
                <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  formatLibrarySemester,
  type LibraryCourse,
  type LibrarySession,
  type LocalStreamMode,
} from '@features/lectures/libraryModel'
import { formatEpisodeToken } from '@common/lectureVideoNaming'
import { useLocalLecturePlayer } from '@features/lectures/useLocalLecturePlayer'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LecturePlayerView')

const props = defineProps<{
  course: LibraryCourse
  session: LibrarySession
  initialMode: LocalStreamMode
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const {
  streamMode,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  volume,
  isMuted,
  effectiveVolume,
  playbackRate,
  playbackRateOptions,
  dualAudioSource,
  isOrderSwapped,
  errorMessage,
  failedPaths,
  isDualMode,
  canSeek,
  seekProgress,
  volumeProgress,
  bindScreenEl,
  bindCameraEl,
  bindSingleEl,
  open,
  setStreamMode,
  togglePlay,
  seek,
  setVolume,
  toggleMute,
  setPlaybackRate,
  setDualAudioSource,
  toggleOrder,
  destroy,
  onTimeUpdate,
  onPlayStateChanged,
} = useLocalLecturePlayer()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)

const setScreenRef = (el: unknown) => {
  bindScreenEl((el as HTMLVideoElement | null) ?? null)
}
const setCameraRef = (el: unknown) => {
  bindCameraEl((el as HTMLVideoElement | null) ?? null)
}
const setSingleRef = (el: unknown) => {
  bindSingleEl((el as HTMLVideoElement | null) ?? null)
}

const seToken = computed(() => {
  const s = formatLibrarySemester(props.course.semester)
  const e = formatEpisodeToken(props.session.episode)
  return [s, e].filter(Boolean).join('')
})

const episodeLine = computed(() => {
  const se = seToken.value
  const title = props.session.title || ''
  if (se && title) return `${se} · ${title}`
  if (se) return se
  return title || props.course.title
})

const headerTitle = computed(() => `${episodeLine.value} — ${props.course.title}`)
const hasStreamChoices = computed(() => Boolean(props.session.screen && props.session.camera))
const cameraOrder = computed(() => (isOrderSwapped.value ? 2 : 1))
const screenOrder = computed(() => (isOrderSwapped.value ? 1 : 2))

const { t } = useI18n()
const streamModeTitle = computed(() => {
  if (streamMode.value === 'dual') return t('playback.bothStreams')
  if (streamMode.value === 'camera') return t('playback.streamCamera')
  return t('playback.streamScreen')
})

// Controls auto-hide
const controlsVisible = ref(true)
const pointerOverControls = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const showControls = () => {
  controlsVisible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  if (!pointerOverControls.value && isPlaying.value) {
    hideTimer = setTimeout(() => {
      if (!pointerOverControls.value) controlsVisible.value = false
    }, 2500)
  }
}

const onPointerLeave = () => {
  if (isPlaying.value) controlsVisible.value = false
}

const showAudioPanel = ref(false)
const showSpeedPanel = ref(false)
const showStreamPanel = ref(false)

const closePanels = () => {
  showAudioPanel.value = false
  showSpeedPanel.value = false
  showStreamPanel.value = false
}

const toggleAudioPanel = () => {
  showAudioPanel.value = !showAudioPanel.value
  showSpeedPanel.value = false
  showStreamPanel.value = false
}
const toggleSpeedPanel = () => {
  showSpeedPanel.value = !showSpeedPanel.value
  showAudioPanel.value = false
  showStreamPanel.value = false
}
const toggleStreamPanel = () => {
  showStreamPanel.value = !showStreamPanel.value
  showAudioPanel.value = false
  showSpeedPanel.value = false
}
const setAudio = (source: 'screen' | 'camera') => {
  setDualAudioSource(source)
  showAudioPanel.value = false
}
const setRate = (rate: number) => {
  setPlaybackRate(rate)
  showSpeedPanel.value = false
}
const pickStreamMode = async (mode: LocalStreamMode) => {
  showStreamPanel.value = false
  await setStreamMode(mode)
  await nextTick()
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

onMounted(async () => {
  await nextTick()
  await open(props.session, props.initialMode, true)
  rootEl.value?.focus()
  showControls()
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  destroy()
})

watch(
  () => props.session.sessionId,
  async () => {
    await nextTick()
    await open(props.session, props.initialMode, true)
  },
)

watch(isPlaying, (playing) => {
  if (playing) showControls()
  else controlsVisible.value = true
})

const onSeekInput = (event: Event) => {
  seek(Number((event.target as HTMLInputElement).value))
}

const onVolumeInput = (event: Event) => {
  setVolume(Number((event.target as HTMLInputElement).value))
}

const openExternally = async (filePath: string) => {
  try {
    await window.electronAPI.lectures.openExternally(filePath)
  } catch (error) {
    log.error('openExternally failed', error)
  }
}

const reveal = async (filePath: string) => {
  try {
    await window.electronAPI.lectures.reveal(filePath)
  } catch (error) {
    log.error('reveal failed', error)
  }
}

const toggleFullscreen = async () => {
  const el = stageEl.value || rootEl.value
  if (!el) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  } catch (error) {
    log.warn('fullscreen failed', error)
  }
}

const onKeydown = (event: KeyboardEvent) => {
  const tag = (event.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

  if (event.code === 'Space') {
    event.preventDefault()
    void togglePlay()
  } else if (event.code === 'ArrowRight') {
    event.preventDefault()
    seek(currentTime.value + (event.shiftKey ? 10 : 5))
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault()
    seek(currentTime.value - (event.shiftKey ? 10 : 5))
  } else if (event.code === 'ArrowUp') {
    event.preventDefault()
    setVolume(volume.value + 0.05)
  } else if (event.code === 'ArrowDown') {
    event.preventDefault()
    setVolume(volume.value - 0.05)
  } else if (event.code === 'KeyM') {
    event.preventDefault()
    toggleMute()
  } else if (event.code === 'Escape') {
    if (showAudioPanel.value || showSpeedPanel.value || showStreamPanel.value) {
      closePanels()
      return
    }
    if (!document.fullscreenElement) emit('back')
  }
}
</script>

<style scoped src="../video/playerControlBar.css"></style>

<style scoped>
.lecture-player {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #000;
  color: #f5f5f5;
  outline: none;
  overflow: hidden;
}

.lecture-player.controls-hidden {
  cursor: none;
}

/* ── Top bar ─────────────────────────────────────────────────────── */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 28px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.28) 55%, transparent 100%);
  transition: opacity 0.2s ease;
}

.top-bar.controls-hidden {
  opacity: 0;
  pointer-events: none;
}

.top-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.top-back:hover {
  background: rgba(255, 255, 255, 0.18);
}

.top-titles {
  flex: 1;
  min-width: 0;
}

.top-episode {
  font-size: 14px;
  font-weight: 650;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}

.top-course {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.top-volume :deep(.dual-icon-button),
.top-volume .dual-icon-button {
  color: #f5f5f5;
}

/* ── Errors ──────────────────────────────────────────────────────── */
.player-error {
  position: absolute;
  top: 64px;
  left: 16px;
  right: 16px;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 22%, rgba(0, 0, 0, 0.75));
  border: 1px solid color-mix(in srgb, var(--danger) 50%, transparent);
  color: #fff;
  font-size: 12px;
}

.player-error-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Stage ───────────────────────────────────────────────────────── */
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #000;
}

.dual-video-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1px;
  background: #111;
}

.dual-video-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dual-video-label {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}

.dual-video-player {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  display: block;
  background: #000;
}

.single-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.single-video-player {
  width: 100%;
  height: 100%;
}

.player-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Bottom overlay ──────────────────────────────────────────────── */
.bottom-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 28px 16px 12px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.55) 35%, rgba(0, 0, 0, 0.88) 100%);
  transition: opacity 0.2s ease;
}

.bottom-overlay.controls-hidden {
  opacity: 0;
  pointer-events: none;
}

.meta-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 0 2px;
}

.meta-left {
  min-width: 0;
  flex: 1;
}

.meta-episode {
  font-size: 13px;
  font-weight: 650;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}

.meta-course {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.meta-time {
  flex-shrink: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.meta-time-sep {
  opacity: 0.55;
  margin: 0 2px;
}

.seek-bar {
  width: 100%;
}

.transport-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}

.transport-left,
.transport-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.transport-play {
  width: 36px !important;
  height: 36px !important;
}

.stream-mode-btn {
  /* icon-only — matches dual-icon-button sizing */
}

.stage:fullscreen {
  background: #000;
}

.stage:fullscreen .dual-video-grid,
.stage:fullscreen .single-stage {
  flex: 1;
}

@media (max-width: 800px) {
  .dual-video-grid {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .top-course {
    display: none;
  }
}
</style>
