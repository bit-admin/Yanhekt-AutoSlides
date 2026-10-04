<template>
  <div class="playback-page" :class="{ 'cinema-mode': isCinemaMode }">
    <div class="header">
      <div class="header-main">
        <button @click="emit('back')" class="btn back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="title-info">
          <h2>{{ title || $t('playback.unknownCourse') }}</h2>
          <p v-if="subLine">{{ subLine }}</p>
          <div v-if="!isVisible && isPlaying" class="background-mode-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {{ $t('playback.playingInBackground') }}
          </div>
        </div>
        <button @click="load" class="btn refresh-btn" :disabled="loading" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button @click="showDetails = !showDetails" class="btn expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="course-details">
        <div class="course-detail-item" v-if="teacher">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ teacher }}</span>
        </div>
        <div class="course-detail-item" v-if="room">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ room }}</span>
        </div>
        <div class="course-detail-item" v-if="session.college">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ session.college }}</span>
        </div>
        <div class="course-detail-item" v-if="dateLine">
          <span class="detail-label">{{ $t('playback.sessionDate') }}</span>
          <span class="detail-value">{{ dateLine }}</span>
        </div>
        <div class="course-detail-item" v-if="playback?.duration">
          <span class="detail-label">{{ $t('playback.duration') }}</span>
          <span class="detail-value">{{ formatPlaybackTime(playback.duration) }}</span>
        </div>
        <div class="course-detail-item" v-if="currentStream">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span class="detail-value">{{ streamLabel(currentStream.type) }}</span>
        </div>
        <div class="course-detail-item" v-else-if="isDualSelected">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span class="detail-value">{{ $t('playback.bothStreams') }}</span>
        </div>
      </div>
    </div>

    <div class="content custom-scrollbar">
      <div v-if="loading" class="loading-state">
        <div class="spinner spinner--lg"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
      </div>

      <div v-else-if="problem" class="loading-state error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <div class="error-details">
          <p class="error-message">{{ problemMessage }}</p>
        </div>
        <button @click="load" class="btn btn--primary btn--lg">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playback" class="video-content" :data-playback-mode="mode">
        <div class="player-panel">
          <DualStreamControls
            :selected-stream="selected"
            :current-playback-rate="playbackRate"
            :streams="selectorStreams"
            :playback-rate-options="playbackRateOptions"
            :mode="mode"
            :is-dual-stream-selected="isDualSelected"
            :is-picture-in-picture="isPictureInPicture"
            :is-cinema-mode="isCinemaMode"
            :should-disable-controls="false"
            :video-player-ready="!!videoPlayer"
            :has-dual-streams="hasDualStreams"
            :dual-stream-key="YANHE2_BOTH_STREAMS"
            @update:selectedStream="onSelectStream"
            @update:currentPlaybackRate="setPlaybackRate"
            @toggle-picture-in-picture="togglePictureInPicture"
            @toggle-cinema-mode="toggleCinemaMode"
          />

          <div
            v-if="!isDualSelected"
            ref="videoContainer"
            class="video-container"
            :class="{ 'collapsed': isPictureInPicture, 'is-fullscreen': isFullscreen, 'controls-hidden': !controlsVisible }"
            :data-pip-message="$t('playback.videoPlayingInPiP')"
            @mousemove="showControls"
            @mouseleave="onPlayerPointerLeave"
          >
            <video
              ref="videoPlayer"
              class="video-player"
              preload="metadata"
              @error="onVideoError"
              @enterpictureinpicture="isPictureInPicture = true"
              @leavepictureinpicture="isPictureInPicture = false"
            >
              {{ $t('playback.browserNotSupported') }}
            </video>
            <BufferingOverlay v-if="isBuffering" />

            <SingleStreamControls
              v-if="!isPictureInPicture"
              :mode="mode"
              :is-playing="isPlaying"
              :controls-visible="controlsVisible"
              :should-disable-controls="false"
              :should-video-mute="false"
              mute-label-key="playback.mutedByApp"
              :current-time="currentTime"
              :duration="duration"
              :can-seek="canSeek"
              :seek-progress="seekProgress"
              :effective-volume="volume"
              :volume-progress="volumeProgress"
              :is-muted="volume <= 0"
              :current-playback-rate="playbackRate"
              :playback-rate-options="playbackRateOptions"
              :show-speed-panel="showSpeedPanel"
              :show-more-panel="showMorePanel"
              :has-mic-audio="false"
              :show-audio-panel="false"
              audio-source="video"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="isPictureInPicture"
              :video-player-ready="!!videoPlayer"
              :format-time="formatPlaybackTime"
              @toggle-playback="togglePlayback"
              @seek-input="onSeekInput"
              @volume-input="applyVolume"
              @toggle-mute="toggleMute"
              @toggle-speed-panel="toggleSpeedPanel"
              @set-playback-rate="setRateFromPanel"
              @toggle-fullscreen="toggleFullscreen"
              @toggle-more-panel="toggleMorePanel"
              @toggle-cinema="toggleCinemaFromMenu"
              @toggle-pip="togglePipFromMenu"
              @pointer-over-controls="pointerOverControls = $event"
            />
          </div>

          <!-- Both Streams: camera + screen side by side, the screen leading. -->
          <div
            v-else
            ref="dualContainer"
            class="dual-playback-shell"
            :class="{ 'is-fullscreen': isFullscreen, 'controls-hidden': !controlsVisible }"
            @mousemove="showControls"
            @mouseleave="onPlayerPointerLeave"
          >
            <div class="video-container dual-video-container">
              <div class="dual-video-grid">
                <div class="dual-video-panel" :style="{ order: isOrderSwapped ? 2 : 1 }">
                  <div class="dual-video-label">{{ $t('playback.streamCamera') }}</div>
                  <video ref="cameraVideoPlayer" class="dual-video-player" preload="metadata" playsinline @error="onVideoError">
                    {{ $t('playback.browserNotSupported') }}
                  </video>
                </div>
                <div class="dual-video-panel" :style="{ order: isOrderSwapped ? 1 : 2 }">
                  <div class="dual-video-label">{{ $t('playback.streamScreen') }}</div>
                  <video ref="screenVideoPlayer" class="dual-video-player" preload="metadata" playsinline @error="onVideoError">
                    {{ $t('playback.browserNotSupported') }}
                  </video>
                </div>
              </div>
              <BufferingOverlay v-if="isBuffering" />
            </div>

            <SingleStreamControls
              :mode="mode"
              :is-playing="isPlaying"
              :controls-visible="controlsVisible"
              :should-disable-controls="false"
              :should-video-mute="false"
              mute-label-key="playback.mutedByApp"
              :current-time="currentTime"
              :duration="duration"
              :can-seek="canSeek"
              :seek-progress="seekProgress"
              :effective-volume="volume"
              :volume-progress="volumeProgress"
              :is-muted="volume <= 0"
              :current-playback-rate="playbackRate"
              :playback-rate-options="playbackRateOptions"
              :show-speed-panel="showSpeedPanel"
              :show-more-panel="showMorePanel"
              :has-mic-audio="false"
              :show-audio-panel="showAudioPanel"
              audio-source="video"
              :audio-sources="dualAudioSources"
              :picked-audio="dualAudioSource"
              can-swap-order
              :pip-available="false"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="false"
              :video-player-ready="true"
              :format-time="formatPlaybackTime"
              @toggle-playback="togglePlayback"
              @seek-input="onSeekInput"
              @volume-input="applyVolume"
              @toggle-mute="toggleMute"
              @toggle-speed-panel="toggleSpeedPanel"
              @toggle-audio-panel="toggleAudioPanel"
              @pick-audio="pickDualAudio"
              @set-playback-rate="setRateFromPanel"
              @toggle-fullscreen="toggleFullscreen"
              @toggle-more-panel="toggleMorePanel"
              @toggle-cinema="toggleCinemaFromMenu"
              @swap-order="swapOrder"
              @pointer-over-controls="pointerOverControls = $event"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// A Yanhe 2.0 session opened from the Calendar. Looks like PlaybackPage and
// shares its player chrome, but only plays: no slide extraction, no notes, no
// task queue, no watch-position report. One stream, or camera + screen side by
// side (Both Streams), driven by the same control bar.
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, beijingDate, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2StreamType } from '@common/yanhe2Playback'
import { useYanhe2Player, YANHE2_BOTH_STREAMS, type Yanhe2StreamChoice } from '@features/yanhe2/useYanhe2Player'
import { useBufferingIndicator } from '@features/video/useBufferingIndicator'
import { useControlsVisibility } from '@features/video/useControlsVisibility'
import { useVideoKeyboard } from '@features/video/useVideoKeyboard'
import type { VideoStream } from '@features/video/useVideoPlayer'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { createLogger } from '@shared/utils/logger'
import BufferingOverlay from '../video/BufferingOverlay.vue'
import DualStreamControls from '../video/DualStreamControls.vue'
import SingleStreamControls from '../video/SingleStreamControls.vue'

const log = createLogger('Yanhe2PlaybackPage')

const props = defineProps<{
  /** The calendar row the tab was opened from. */
  session: Yanhe2CalendarSession
  /** The AutoSlides account (badge) whose Yanhe 2.0 session plays it. */
  account: string
  isVisible: boolean
}>()

const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const videoPlayer = ref<HTMLVideoElement | null>(null)
const cameraVideoPlayer = ref<HTMLVideoElement | null>(null)
const screenVideoPlayer = ref<HTMLVideoElement | null>(null)
const videoContainer = ref<HTMLElement | null>(null)
const dualContainer = ref<HTMLElement | null>(null)

const {
  loading,
  problem,
  sessionStatus,
  playback,
  mode,
  streams,
  selected,
  currentStream,
  hasDualStreams,
  isDualSelected,
  masterVideo,
  playbackRate,
  load,
  selectStream,
  setPlaybackRate,
  togglePlayback,
  seekTo,
  onVideoError,
} = useYanhe2Player({
  account: props.account,
  courseId: props.session.courseId,
  subId: props.session.subId,
  videoPlayer,
  cameraVideoPlayer,
  screenVideoPlayer,
  developerMode: toRef(configStore, 'developerMode'),
})

const { isBuffering } = useBufferingIndicator([videoPlayer, cameraVideoPlayer, screenVideoPlayer])

// Header. The calendar row is on hand before the session loads; the session's
// own answer replaces it where the two overlap.
const title = computed(() => playback.value?.title || props.session.title)
const teacher = computed(() => playback.value?.teacher || props.session.teacher)
const room = computed(() => playback.value?.room || props.session.room)
const subLine = computed(() => [teacher.value, room.value].filter(Boolean).join(' · '))
const dateLine = computed(() => {
  const startAt = playback.value?.startAt || props.session.startAt
  const endAt = playback.value?.endAt || props.session.endAt
  if (!startAt) return ''
  const end = beijingClock(endAt)
  return `${beijingDate(startAt * 1000)} ${beijingClock(startAt)}${end ? ` – ${end}` : ''}`
})
const showDetails = ref(false)

const streamLabel = (type: Yanhe2StreamType) => {
  if (type === 'screen') return t('playback.streamScreen')
  if (type === 'room') return t('playback.streamRoom')
  return t('playback.streamCamera')
}

// The selector component is the Yanhekt player's; give it the shape it lists.
const selectorStreams = computed(() => {
  const out: Record<string, VideoStream> = {}
  for (const stream of streams.value) {
    out[stream.type] = { type: stream.type, name: stream.type, url: stream.url, original_url: '' }
  }
  return out
})
const onSelectStream = (key: string) => selectStream(key as Yanhe2StreamChoice)

const problemMessage = computed(() => {
  switch (problem.value) {
    case 'signed_out': return t('yanhe2Playback.errorSignedOut')
    case 'network': return t('yanhe2Calendar.errorNetwork')
    case 'player': return t('yanhe2Playback.errorPlayer')
    case 'not_playable':
      if (sessionStatus.value === 'upcoming') return t('yanhe2Playback.notStarted')
      if (sessionStatus.value === 'processing') return t('yanhe2Playback.processing')
      return t('yanhe2Playback.noRecording')
    default: return t('yanhe2Playback.errorFailed')
  }
})

// Playback speed (recorded only; the bars hide it for live).
const defaultPlaybackRates = [1, 1.25, 1.5, 2, 5, 10, 16]
const allPlaybackRates = [0.5, 0.75, 0.8, 0.9, 1, 1.1, 1.15, 1.2, 1.25, 1.5, 1.75, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const playbackRateOptions = computed(() => (configStore.showMorePlaybackSpeed ? allPlaybackRates : defaultPlaybackRates))

const stepPlaybackRate = (dir: 1 | -1) => {
  const options = playbackRateOptions.value
  const current = Number(playbackRate.value)
  let idx = options.indexOf(current)
  if (idx === -1) {
    idx = options.reduce(
      (best, val, i) => (Math.abs(val - current) < Math.abs(options[best] - current) ? i : best),
      0,
    )
  }
  const next = Math.min(options.length - 1, Math.max(0, idx + dir))
  if (next !== idx) setPlaybackRate(options[next])
}

// Control-bar state, mirrored off the element that owns the clock (the screen
// in Both Streams).
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const lastNonZeroVolume = ref(1)
const canSeek = computed(() => Number.isFinite(duration.value) && duration.value > 0)
const seekProgress = computed(() => {
  if (!canSeek.value) return '0%'
  return `${Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))}%`
})
const volumeProgress = computed(() => `${Math.min(100, Math.max(0, volume.value * 100))}%`)

let detachVideoListeners: (() => void) | null = null
watch(masterVideo, (video) => {
  detachVideoListeners?.()
  detachVideoListeners = null
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  if (!video) return

  const onPlayState = () => { isPlaying.value = !video.paused && !video.ended }
  const onTime = () => { currentTime.value = video.currentTime }
  const onDuration = () => {
    duration.value = Number.isFinite(video.duration) ? video.duration : 0
    currentTime.value = video.currentTime
  }
  const listeners: [string, () => void][] = [
    ['play', onPlayState],
    ['pause', onPlayState],
    ['ended', onPlayState],
    ['emptied', onDuration],
    ['timeupdate', onTime],
    ['loadedmetadata', onDuration],
    ['durationchange', onDuration],
  ]
  listeners.forEach(([name, handler]) => video.addEventListener(name, handler))
  detachVideoListeners = () => listeners.forEach(([name, handler]) => video.removeEventListener(name, handler))
})

const onSeekInput = (time: number) => {
  currentTime.value = time
  seekTo(time)
}

// Audio. One element is audible at a time: the single stream, or in Both
// Streams whichever of the pair is picked (the other plays at volume 0).
const dualAudioSource = ref<'screen' | 'camera'>('screen')
const dualAudioSources = computed(() => [
  { value: 'screen', label: t('playback.dual.screenAudio') },
  { value: 'camera', label: t('playback.dual.cameraAudio') },
])
const applyAudio = () => {
  if (videoPlayer.value) videoPlayer.value.volume = volume.value
  if (screenVideoPlayer.value) screenVideoPlayer.value.volume = dualAudioSource.value === 'screen' ? volume.value : 0
  if (cameraVideoPlayer.value) cameraVideoPlayer.value.volume = dualAudioSource.value === 'camera' ? volume.value : 0
}
watch([videoPlayer, cameraVideoPlayer, screenVideoPlayer, dualAudioSource], applyAudio)

const applyVolume = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value))
  volume.value = clamped
  if (clamped > 0) lastNonZeroVolume.value = clamped
  applyAudio()
}

const toggleMute = () => applyVolume(volume.value > 0 ? 0 : lastNonZeroVolume.value || 1)

// Popovers: one open at a time, and any of them keeps the bar pinned.
const showSpeedPanel = ref(false)
const showMorePanel = ref(false)
const showAudioPanel = ref(false)
const openOnly = (panel: typeof showSpeedPanel) => {
  const next = !panel.value
  showSpeedPanel.value = showMorePanel.value = showAudioPanel.value = false
  panel.value = next
}
const toggleSpeedPanel = () => openOnly(showSpeedPanel)
const toggleMorePanel = () => openOnly(showMorePanel)
const toggleAudioPanel = () => openOnly(showAudioPanel)
const pickDualAudio = (value: string) => {
  dualAudioSource.value = value === 'camera' ? 'camera' : 'screen'
  showAudioPanel.value = false
}

const isOrderSwapped = ref(false)
const swapOrder = () => {
  isOrderSwapped.value = !isOrderSwapped.value
  showMorePanel.value = false
}
const setRateFromPanel = (rate: number) => {
  setPlaybackRate(rate)
  showSpeedPanel.value = false
}

const { controlsVisible, pointerOverControls, showControls, onPlayerPointerLeave } = useControlsVisibility({
  isPlaying,
  persistSources: [showSpeedPanel, showMorePanel, showAudioPanel],
})

// Fullscreen: whichever frame is on screen, the single one or the pair.
const isFullscreen = ref(false)
const playerContainer = () => (isDualSelected.value ? dualContainer.value : videoContainer.value)
const toggleFullscreen = async () => {
  const container = playerContainer()
  if (!container) return
  try {
    if (document.fullscreenElement === container) await document.exitFullscreen()
    else await container.requestFullscreen()
  } catch (error) {
    log.error('Error toggling fullscreen:', error)
  }
}
const onFullscreenChange = () => {
  const container = playerContainer()
  isFullscreen.value = !!container && document.fullscreenElement === container
}

// Picture in Picture. The API is document-global, so compare against this
// tab's own element rather than "is anything in PiP".
const isPictureInPicture = ref(false)
const togglePictureInPicture = async () => {
  const video = videoPlayer.value
  if (!video) return
  try {
    if (document.pictureInPictureElement === video) await document.exitPictureInPicture()
    else await video.requestPictureInPicture()
  } catch (error) {
    log.error('Error toggling Picture in Picture:', error)
  }
}

// Cinema mode: collapse both side panels and hide the header, restoring the
// panels to what they were on the way out.
const isCinemaMode = ref(false)
let preCinemaLeftCollapsed = false
let preCinemaRightCollapsed = false
const toggleCinemaMode = () => {
  if (isCinemaMode.value) {
    layoutStore.leftCollapsed = preCinemaLeftCollapsed
    layoutStore.rightCollapsed = preCinemaRightCollapsed
    isCinemaMode.value = false
  } else {
    preCinemaLeftCollapsed = layoutStore.leftCollapsed
    preCinemaRightCollapsed = layoutStore.rightCollapsed
    layoutStore.leftCollapsed = true
    layoutStore.rightCollapsed = true
    isCinemaMode.value = true
  }
}
const toggleCinemaFromMenu = () => {
  toggleCinemaMode()
  showMorePanel.value = false
}
const togglePipFromMenu = () => {
  void togglePictureInPicture()
  showMorePanel.value = false
}

const formatPlaybackTime = (value: string | number): string => {
  const total = Math.max(0, Math.floor(typeof value === 'string' ? parseInt(value) : value))
  if (isNaN(total)) return '0:00'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Same keymap as the Yanhekt player. The listener is window-wide, so it only
// acts while this tab is the one on screen.
const videoKeyboard = useVideoKeyboard({
  mode: props.session.status === 'live' ? 'live' : 'recorded',
  seekSeconds: 5,
  volumeStep: 0.05,
  isModalOpen: () => false,
  isDisabled: () => !props.isVisible || !masterVideo.value,
  isAnyFullscreen: () => isFullscreen.value,
  seekBy: (delta) => seekTo(currentTime.value + delta),
  togglePlayback,
  stepPlaybackRate,
  toggleMute,
  toggleFullscreen: () => void toggleFullscreen(),
  adjustVolume: (delta) => applyVolume(volume.value + delta),
})

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  videoKeyboard.attach()
  void load()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  videoKeyboard.detach()
  detachVideoListeners?.()
  if (isCinemaMode.value) toggleCinemaMode()
})
</script>

<style scoped src="../video/playbackPageChrome.css"></style>
