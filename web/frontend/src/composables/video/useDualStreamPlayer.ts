import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from "vue";
import Hls, { Events } from "hls.js";
import { setupDualHlsErrorHandler } from "./useVideoErrorRecovery";
import type { VideoStream, DualAudioSource } from "./useVideoPlayer";

/**
 * Dual-stream (camera + screen) playback subsystem — ported near-verbatim
 * from the desktop app's useDualStreamPlayer. Owns the two HLS instances,
 * drift-correction sync loop, audio routing, and the dual-specific event
 * handlers. Adds a native-HLS fallback (Safari/iOS) the desktop app doesn't
 * need.
 */
export interface DualStreamPlayerDeps {
  mode: "live" | "recorded";
  cameraVideoPlayer: Ref<HTMLVideoElement | null>;
  screenVideoPlayer: Ref<HTMLVideoElement | null>;
  currentPlaybackRate: Ref<number>;
  shouldVideoMute: ComputedRef<boolean>;
  isVideoMuted: Ref<boolean>;
  isPlaying: Ref<boolean>;
  isDualStreamSelected: ComputedRef<boolean>;
  cameraStreamData: ComputedRef<VideoStream | null>;
  screenStreamData: ComputedRef<VideoStream | null>;
  error: Ref<string | null>;
  getHlsConfig: (mode: "live" | "recorded") => object;
  handleTaskError: (message: string) => void;
  /** Tear down any single-stream HLS instance before dual sources load. */
  cleanupSingleVideoSource: () => void;
  /** Shared playback-ended handler. */
  onEnded: () => Promise<void>;
}

export function useDualStreamPlayer(deps: DualStreamPlayerDeps) {
  const {
    mode,
    cameraVideoPlayer,
    screenVideoPlayer,
    currentPlaybackRate,
    shouldVideoMute,
    isVideoMuted,
    isPlaying,
    isDualStreamSelected,
    cameraStreamData,
    screenStreamData,
    error,
    getHlsConfig,
    handleTaskError,
    cleanupSingleVideoSource,
    onEnded,
  } = deps;

  const cameraHls = shallowRef<Hls | null>(null);
  const screenHls = shallowRef<Hls | null>(null);
  const dualAudioSource = ref<DualAudioSource>("screen");
  const dualVolume = ref(1);
  const dualCurrentTime = ref(0);
  const dualDuration = ref(0);

  let dualSyncInterval: ReturnType<typeof setInterval> | null = null;
  let isApplyingDualAudioState = false;
  // Tracks videos playing via native HLS (Safari) so cleanup clears their src.
  const nativeVideos = new Set<HTMLVideoElement>();

  const dualCanSeek = computed(() => {
    return Number.isFinite(dualDuration.value) && dualDuration.value > 0;
  });

  const getDualMasterVideo = () => {
    return screenVideoPlayer.value || cameraVideoPlayer.value;
  };

  const stopDualSync = () => {
    if (dualSyncInterval) {
      clearInterval(dualSyncInterval);
      dualSyncInterval = null;
    }
  };

  const cleanupDualVideoSources = () => {
    stopDualSync();

    if (cameraHls.value) {
      cameraHls.value.destroy();
      cameraHls.value = null;
    }

    if (screenHls.value) {
      screenHls.value.destroy();
      screenHls.value = null;
    }

    for (const video of nativeVideos) {
      video.removeAttribute("src");
      video.load();
    }
    nativeVideos.clear();
  };

  const applyDualAudioState = () => {
    if (isApplyingDualAudioState) return;

    isApplyingDualAudioState = true;
    try {
      const cameraVideo = cameraVideoPlayer.value;
      const screenVideo = screenVideoPlayer.value;

      if (shouldVideoMute.value) {
        if (cameraVideo) {
          cameraVideo.volume = 0;
          cameraVideo.muted = false;
          cameraVideo.setAttribute("data-muted-by-app", "true");
        }
        if (screenVideo) {
          screenVideo.volume = 0;
          screenVideo.muted = false;
          screenVideo.setAttribute("data-muted-by-app", "true");
        }
        isVideoMuted.value = true;
        return;
      }

      if (cameraVideo) {
        cameraVideo.volume = dualAudioSource.value === "camera" ? dualVolume.value : 0;
        cameraVideo.muted = false;
        cameraVideo.removeAttribute("data-muted-by-app");
      }

      if (screenVideo) {
        screenVideo.volume = dualAudioSource.value === "screen" ? dualVolume.value : 0;
        screenVideo.muted = false;
        screenVideo.removeAttribute("data-muted-by-app");
      }

      isVideoMuted.value = false;
    } finally {
      isApplyingDualAudioState = false;
    }
  };

  const setDualAudioSource = (source: DualAudioSource) => {
    dualAudioSource.value = source;
    applyDualAudioState();
  };

  const setDualVolume = (value: number) => {
    dualVolume.value = Math.min(1, Math.max(0, value));
    applyDualAudioState();
  };

  const updateDualPlaybackState = () => {
    const masterVideo = getDualMasterVideo();
    if (!masterVideo) {
      dualCurrentTime.value = 0;
      dualDuration.value = 0;
      isPlaying.value = false;
      return;
    }

    dualCurrentTime.value = masterVideo.currentTime || 0;
    dualDuration.value = Number.isFinite(masterVideo.duration) ? masterVideo.duration : 0;
    isPlaying.value = !masterVideo.paused && !masterVideo.ended;
  };

  const syncDualStreams = () => {
    if (!isDualStreamSelected.value) return;

    const cameraVideo = cameraVideoPlayer.value;
    const screenVideo = screenVideoPlayer.value;
    if (!cameraVideo || !screenVideo) return;
    if (cameraVideo.readyState < 2 || screenVideo.readyState < 2) return;

    if (mode === "recorded") {
      const playbackRateNumber = Number(currentPlaybackRate.value);
      cameraVideo.playbackRate = playbackRateNumber;
      screenVideo.playbackRate = playbackRateNumber;
    } else {
      cameraVideo.playbackRate = 1;
      screenVideo.playbackRate = 1;
      currentPlaybackRate.value = 1;
    }

    applyDualAudioState();

    if (!screenVideo.paused && cameraVideo.paused) {
      cameraVideo.play().catch(() => {
        /* Ignore sync play errors */
      });
    } else if (screenVideo.paused && !cameraVideo.paused) {
      cameraVideo.pause();
    }

    const drift = Math.abs(cameraVideo.currentTime - screenVideo.currentTime);
    if (!screenVideo.paused && Number.isFinite(drift) && drift > 0.75) {
      cameraVideo.currentTime = screenVideo.currentTime;
    }

    updateDualPlaybackState();
  };

  const startDualSync = () => {
    stopDualSync();
    dualSyncInterval = setInterval(syncDualStreams, 1500);
  };

  const onSourceReady = (
    video: HTMLVideoElement,
    label: string,
    seekToTime?: number,
    shouldAutoPlay?: boolean,
  ) => {
    setTimeout(() => {
      if (mode === "recorded") {
        video.playbackRate = Number(currentPlaybackRate.value);
      } else {
        video.playbackRate = 1;
        currentPlaybackRate.value = 1;
      }

      if (seekToTime !== undefined && seekToTime > 0 && Number.isFinite(seekToTime)) {
        try {
          video.currentTime = seekToTime;
        } catch (seekError) {
          console.warn(`Could not seek ${label} stream during dual load:`, seekError);
        }
      }

      applyDualAudioState();
      updateDualPlaybackState();

      if (shouldAutoPlay !== false) {
        video.play().catch(() => {
          /* Ignore dual autoplay error */
        });
      }
    }, 100);
  };

  const attachDualHls = (
    video: HTMLVideoElement,
    stream: VideoStream,
    hlsRef: ShallowRef<Hls | null>,
    label: string,
    seekToTime?: number,
    shouldAutoPlay?: boolean,
  ) => {
    const hlsInstance = new Hls(getHlsConfig(mode));
    hlsRef.value = hlsInstance;

    hlsInstance.loadSource(stream.url);
    hlsInstance.attachMedia(video);

    hlsInstance.on(Events.MANIFEST_PARSED, () => {
      onSourceReady(video, label, seekToTime, shouldAutoPlay);
    });

    setupDualHlsErrorHandler(hlsInstance, video, label, {
      mode,
      onFatal: (message) => {
        error.value = message;
        handleTaskError(message);
      },
    });
  };

  /** Safari/iOS: no MSE — hand the m3u8 straight to the media element. */
  const attachDualNative = (
    video: HTMLVideoElement,
    stream: VideoStream,
    label: string,
    seekToTime?: number,
    shouldAutoPlay?: boolean,
  ) => {
    nativeVideos.add(video);
    video.src = stream.url;
    video.addEventListener(
      "loadedmetadata",
      () => onSourceReady(video, label, seekToTime, shouldAutoPlay),
      { once: true },
    );
  };

  const loadDualVideoSources = async (seekToTime?: number, shouldAutoPlay?: boolean) => {
    const cameraVideo = cameraVideoPlayer.value;
    const screenVideo = screenVideoPlayer.value;
    const cameraStream = cameraStreamData.value;
    const screenStream = screenStreamData.value;

    if (!cameraVideo || !screenVideo || !cameraStream || !screenStream) {
      return;
    }

    try {
      cleanupSingleVideoSource();
      cleanupDualVideoSources();

      if (Hls.isSupported()) {
        attachDualHls(cameraVideo, cameraStream, cameraHls, "camera", seekToTime, shouldAutoPlay);
        attachDualHls(screenVideo, screenStream, screenHls, "screen", seekToTime, shouldAutoPlay);
      } else if (cameraVideo.canPlayType("application/vnd.apple.mpegurl")) {
        attachDualNative(cameraVideo, cameraStream, "camera", seekToTime, shouldAutoPlay);
        attachDualNative(screenVideo, screenStream, "screen", seekToTime, shouldAutoPlay);
      } else {
        throw new Error("HLS is not supported in this browser");
      }
      startDualSync();
    } catch (err: unknown) {
      console.error("Failed to load dual video sources:", err);
      const errorMessage =
        "Failed to load dual video sources: " + (err instanceof Error ? err.message : String(err));
      error.value = errorMessage;
      handleTaskError(errorMessage);
    }
  };

  const playDualStreams = async () => {
    const cameraVideo = cameraVideoPlayer.value;
    const screenVideo = screenVideoPlayer.value;

    if (!cameraVideo || !screenVideo) return;

    applyDualAudioState();

    try {
      await Promise.allSettled([cameraVideo.play(), screenVideo.play()]);
      isPlaying.value = true;
      startDualSync();
    } catch (playError) {
      console.warn("Could not start dual playback:", playError);
    }
  };

  const pauseDualStreams = () => {
    cameraVideoPlayer.value?.pause();
    screenVideoPlayer.value?.pause();
    isPlaying.value = false;
  };

  const toggleDualPlayback = async () => {
    const masterVideo = getDualMasterVideo();
    if (!masterVideo) return;

    if (masterVideo.paused) {
      await playDualStreams();
    } else {
      pauseDualStreams();
    }
  };

  const seekDualStreams = (time: number) => {
    if (!dualCanSeek.value || !Number.isFinite(time)) return;

    const boundedTime = Math.min(Math.max(time, 0), dualDuration.value);

    if (screenVideoPlayer.value) {
      screenVideoPlayer.value.currentTime = boundedTime;
    }
    if (cameraVideoPlayer.value) {
      cameraVideoPlayer.value.currentTime = boundedTime;
    }

    dualCurrentTime.value = boundedTime;
  };

  const onDualTimeUpdate = () => {
    updateDualPlaybackState();
  };

  const onDualPlayStateChanged = () => {
    updateDualPlaybackState();
    if (isPlaying.value) {
      startDualSync();
    }
  };

  const onDualEnded = async () => {
    pauseDualStreams();
    await onEnded();
  };

  const preventDualUnmute = (event: Event) => {
    if (isApplyingDualAudioState) return;

    const target = event.target as HTMLVideoElement;
    if (shouldVideoMute.value) {
      event.preventDefault();
      target.volume = 0;
      target.muted = false;
      return;
    }

    applyDualAudioState();
  };

  return {
    cameraHls,
    screenHls,
    dualAudioSource,
    dualVolume,
    dualCurrentTime,
    dualDuration,
    dualCanSeek,
    getDualMasterVideo,
    cleanupDualVideoSources,
    loadDualVideoSources,
    playDualStreams,
    pauseDualStreams,
    toggleDualPlayback,
    seekDualStreams,
    setDualAudioSource,
    setDualVolume,
    applyDualAudioState,
    startDualSync,
    onDualTimeUpdate,
    onDualPlayStateChanged,
    onDualEnded,
    preventDualUnmute,
  };
}
