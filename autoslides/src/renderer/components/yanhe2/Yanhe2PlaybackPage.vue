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

          <!-- Classroom mic track. Outside the single/dual switch so a layout
               change does not remount it and refetch the file. -->
          <audio v-if="hasMicAudio" ref="micAudioPlayer" preload="auto"></audio>

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
            <div v-if="caption && !isPictureInPicture" class="caption-layer" :class="{ 'above-controls': controlsVisible }">
              <span class="caption-text">{{ caption }}</span>
            </div>

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
              :has-mic-audio="hasMicAudio"
              :show-audio-panel="showAudioPanel"
              :audio-source="micAudioOn ? 'mic' : 'video'"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="isPictureInPicture"
              :video-player-ready="!!videoPlayer"
              :captions-available="captionsAvailable"
              :captions-on="captionsOn"
              :format-time="formatPlaybackTime"
              @toggle-playback="togglePlayback"
              @seek-input="onSeekInput"
              @volume-input="applyVolume"
              @toggle-mute="toggleMute"
              @toggle-speed-panel="toggleSpeedPanel"
              @toggle-audio-panel="toggleAudioPanel"
              @set-audio-source="pickSingleAudio"
              @set-playback-rate="setRateFromPanel"
              @toggle-fullscreen="toggleFullscreen"
              @toggle-more-panel="toggleMorePanel"
              @toggle-cinema="toggleCinemaFromMenu"
              @toggle-captions="toggleCaptions"
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
            <div v-if="caption" class="caption-layer" :class="{ 'above-controls': controlsVisible }">
              <span class="caption-text">{{ caption }}</span>
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
              :picked-audio="micAudioOn ? 'mic' : dualAudioSource"
              can-swap-order
              :pip-available="false"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="false"
              :video-player-ready="true"
              :captions-available="captionsAvailable"
              :captions-on="captionsOn"
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
              @toggle-captions="toggleCaptions"
              @swap-order="swapOrder"
              @pointer-over-controls="pointerOverControls = $event"
            />
          </div>

          <!-- Server slides: what Yanhe 2.0 detected on the screen recording. Save hands them to the task queue. -->
          <div v-if="slidesState !== 'idle'" class="slide-gallery">
            <div class="gallery-header server-slides-header">
              <div class="server-slides-main">
                <span class="server-slides-title">{{ $t('yanhe2Playback.serverSlides') }}</span>
                <div v-if="slidesState === 'ready'" class="slide-counter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="counter-text">{{ serverSlides.length }} {{ $t('playback.slides') }}</span>
                </div>
                <span v-if="slidesNote" class="server-slides-note">{{ slidesNote }}</span>
              </div>
              <button v-if="slidesState === 'failed'" @click="loadSlides" class="btn">
                {{ $t('playback.retry') }}
              </button>
              <div v-else-if="serverSlides.length > 0" class="slide-actions">
                <button class="btn btn--primary" :disabled="savingSlides" @click="saveSlides">
                  <svg v-if="!savingSlides" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <div v-else class="processing-spinner"></div>
                  {{ savingSlides ? $t('yanhe2Playback.savingSlides') : $t('yanhe2Playback.saveSlides') }}
                </button>
              </div>
            </div>
            <SlideGallery
              v-if="gallerySlides.length > 0"
              :slides="gallerySlides"
              :format-slide-time="formatPlaybackTime"
              :deletable="false"
              @preview="openSlidePreview"
            />
          </div>
        </div>
      </div>
    </div>

    <PreviewModal
      :slide="previewedSlide"
      :format-slide-time="formatPlaybackTime"
      :deletable="false"
      :show-file-name="false"
      :time-label="$t('yanhe2Playback.slideShownAt')"
      @close="previewedId = null"
    />
  </div>
</template>

<script setup lang="ts">
// A Yanhe 2.0 session opened from the Calendar. Looks like PlaybackPage and
// shares its player chrome, but only plays: no slide extraction, no notes, no
// task queue, no watch-position report. One stream, or camera + screen side by
// side (Both Streams), driven by the same control bar. Under a recording it
// lists the slides Yanhe 2.0 detected itself, to look at and copy, and the
// control bar can caption it from Yanhe 2.0's transcript.
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, beijingDate, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2StreamType } from '@common/yanhe2Playback'
import { useYanhe2Player, YANHE2_BOTH_STREAMS, type Yanhe2StreamChoice } from '@features/yanhe2/useYanhe2Player'
import { useYanhe2Captions } from '@features/yanhe2/useYanhe2Captions'
import { useYanhe2Slides } from '@features/yanhe2/useYanhe2Slides'
import { isSavingYanhe2Slides, saveYanhe2Slides } from '@features/yanhe2/yanhe2SlideSave'
import type { GallerySlide } from '@features/video/gallerySlide'
import { useBufferingIndicator } from '@features/video/useBufferingIndicator'
import { useControlsVisibility } from '@features/video/useControlsVisibility'
import { useVideoKeyboard } from '@features/video/useVideoKeyboard'
import type { VideoStream } from '@features/video/useVideoPlayer'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { createLogger } from '@shared/utils/logger'
import BufferingOverlay from '../video/BufferingOverlay.vue'
import DualStreamControls from '../video/DualStreamControls.vue'
import PreviewModal from '../video/PreviewModal.vue'
import SlideGallery from '../video/SlideGallery.vue'
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
const micAudioPlayer = ref<HTMLAudioElement | null>(null)
const screenVideoPlayer = ref<HTMLVideoElement | null>(null)
const videoContainer = ref<HTMLElement | null>(null)
const dualContainer = ref<HTMLElement | null>(null)

// Captions depend on whether the mic was live, so a lecture with a transcript
// has its mic track checked even when the audio menu's own check is off.
const micVerdictWanted = ref(false)

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
  hasMicAudio,
  micState,
  micAudioOn,
  setMicAudio,
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
  micAudioPlayer,
  preferMicAudio: toRef(configStore, 'preferMicAudioByDefault'),
  micVerdictWanted,
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

// Server slides. Shown as they come: Yanhe 2.0 neither filters nor
// deduplicates them, and their times are on the screen recording's clock.
const { slides: serverSlides, state: slidesState, load: loadSlides } = useYanhe2Slides({
  account: props.account,
  courseId: props.session.courseId,
  subId: props.session.subId,
  playback,
})
const gallerySlides = computed<GallerySlide[]>(() =>
  serverSlides.value.map((slide, index) => ({
    id: String(index),
    title: t('yanhe2Playback.slideTitle', { n: index + 1 }),
    timestamp: String(slide.seconds),
    dataUrl: slide.src,
  })),
)
// By id, not by object: the list is rebuilt as each image arrives, and an open
// preview must survive that. A reload empties the list, which closes it.
const previewedId = ref<string | null>(null)
const previewedSlide = computed(() => gallerySlides.value.find((slide) => slide.id === previewedId.value) ?? null)
const openSlidePreview = (slide: GallerySlide) => {
  if (slide.dataUrl) previewedId.value = slide.id
}
// Saving is the task queue's: the page only starts it. A refusal is a message box, the rest is the task row.
const savingSlides = computed(() => isSavingYanhe2Slides(props.session.subId))
const saveSlides = () =>
  void saveYanhe2Slides({ account: props.account, courseId: props.session.courseId, subId: props.session.subId })

const slidesNote = computed(() => {
  if (slidesState.value === 'loading') return t('yanhe2Playback.slidesLoading')
  if (slidesState.value === 'failed') return t('yanhe2Playback.slidesFailed')
  return serverSlides.value.length > 0 ? '' : t('yanhe2Playback.slidesEmpty')
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

// Captions, from Yanhe 2.0's own transcript of the recording.
const { hasTranscript, available: captionsAvailable, captionsOn, caption, toggle: toggleCaptions } = useYanhe2Captions({
  account: props.account,
  subId: props.session.subId,
  playback,
  currentTime,
  micState,
})
watch(hasTranscript, (has) => { micVerdictWanted.value = has }, { immediate: true })

const onSeekInput = (time: number) => {
  currentTime.value = time
  seekTo(time)
}

// Audio. One element is audible at a time: the single stream, in Both Streams
// whichever of the pair is picked, or the classroom mic when the recording has
// one and it is chosen. The others play at volume 0.
const dualAudioSource = ref<'screen' | 'camera'>('screen')
const dualAudioSources = computed(() => [
  { value: 'screen', label: t('playback.dual.screenAudio') },
  { value: 'camera', label: t('playback.dual.cameraAudio') },
  ...(hasMicAudio.value ? [{ value: 'mic', label: t('playback.dual.micAudio') }] : []),
])
const applyAudio = () => {
  const mic = micAudioOn.value
  const level = volume.value
  if (videoPlayer.value) videoPlayer.value.volume = mic ? 0 : level
  if (screenVideoPlayer.value) screenVideoPlayer.value.volume = !mic && dualAudioSource.value === 'screen' ? level : 0
  if (cameraVideoPlayer.value) cameraVideoPlayer.value.volume = !mic && dualAudioSource.value === 'camera' ? level : 0
  if (micAudioPlayer.value) micAudioPlayer.value.volume = mic ? level : 0
}
watch([videoPlayer, cameraVideoPlayer, screenVideoPlayer, micAudioPlayer, dualAudioSource, micAudioOn], applyAudio)

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
  setMicAudio(value === 'mic')
  if (value !== 'mic') dualAudioSource.value = value === 'camera' ? 'camera' : 'screen'
  showAudioPanel.value = false
}
const pickSingleAudio = (source: 'video' | 'mic') => {
  setMicAudio(source === 'mic')
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
  isModalOpen: () => !!previewedSlide.value,
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

<style scoped>
/* Captions sit over the picture, and step up out of the control bar's way. */
.caption-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  z-index: var(--z-sticky);
  display: flex;
  justify-content: center;
  padding: 0 5%;
  pointer-events: none;
  transition: bottom 0.2s ease;
}

.caption-layer.above-controls {
  bottom: 68px;
}

.caption-text {
  max-width: 100%;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.72);
  color: var(--text-on-fill);
  font-size: clamp(15px, 2.2cqw, 28px);
  line-height: 1.4;
  text-align: center;
}

.video-container,
.dual-playback-shell {
  container-type: inline-size;
}

/* Same band as the Yanhekt player's Slide Extraction row. */
.server-slides-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.slide-gallery:has(.gallery-grid) .server-slides-header {
  border-bottom: 1px solid var(--border-color);
}

.server-slides-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

.server-slides-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.server-slides-note {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 0;
}
</style>
