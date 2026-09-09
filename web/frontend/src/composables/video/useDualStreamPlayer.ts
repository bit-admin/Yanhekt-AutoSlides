import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from "vue";
import Hls, { Events, type FragmentLoaderConstructor } from "hls.js";
import { attachNetworkErrorSniffer, setupDualHlsErrorHandler } from "./useVideoErrorRecovery";
import { createMediaSyncLoop, syncFollower } from "./mediaSync";
import type { VideoStream, DualAudioSource } from "./useVideoPlayer";
import { demoHooks } from "../../lib/demoRegistry";

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
  /** Classroom mic stem, synced to the master video. Null until the element mounts. */
  micAudioPlayer: Ref<HTMLAudioElement | null>;
  /** Raw mic AAC URL, or null when this lecture has none. */
  micAudioUrl: ComputedRef<string | null>;
  currentPlaybackRate: Ref<number>;
  shouldVideoMute: ComputedRef<boolean>;
  isVideoMuted: Ref<boolean>;
  isPlaying: Ref<boolean>;
  /** Warm-up overlay flag, shared with the single-stream path. The dual player
   *  owns it while dual sources load so the overlay clears once both streams
   *  are playable (the single-stream `canplay` never fires in dual mode). */
  isVideoLoading: Ref<boolean>;
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
  /** Called on any network-type HLS error, so the host can diagnose the cause. */
  onNetworkError?: () => void;
  /**
   * hls.js fragment loader that turns segment fetches into watch-progress
   * heartbeats. Attached to the **master** instance only — both streams sit at
   * the same playhead, so letting each report would just double the traffic.
   */
  getProgressFragmentLoader?: () => FragmentLoaderConstructor | undefined;
}

export function useDualStreamPlayer(deps: DualStreamPlayerDeps) {
  const {
    mode,
    cameraVideoPlayer,
    screenVideoPlayer,
    micAudioPlayer,
    micAudioUrl,
    currentPlaybackRate,
    shouldVideoMute,
    isVideoMuted,
    isPlaying,
    isVideoLoading,
    isDualStreamSelected,
    cameraStreamData,
    screenStreamData,
    error,
    getHlsConfig,
    handleTaskError,
    cleanupSingleVideoSource,
    onEnded,
    onNetworkError,
    getProgressFragmentLoader,
  } = deps;

  const cameraHls = shallowRef<Hls | null>(null);
  const screenHls = shallowRef<Hls | null>(null);
  const dualAudioSource = ref<DualAudioSource>("screen");
  const dualVolume = ref(1);
  const dualCurrentTime = ref(0);
  const dualDuration = ref(0);

  const dualSyncLoop = createMediaSyncLoop(() => syncDualStreams());
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
    dualSyncLoop.stop();
  };

  const cleanupDualVideoSources = () => {
    stopDualSync();
    detachMicAudio();

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
      const micAudio = micAudioPlayer.value;

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
        if (micAudio) {
          micAudio.volume = 0;
          micAudio.muted = false;
          micAudio.setAttribute("data-muted-by-app", "true");
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

      if (micAudio) {
        micAudio.volume = dualAudioSource.value === "mic" ? dualVolume.value : 0;
        micAudio.muted = false;
        micAudio.removeAttribute("data-muted-by-app");
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
    if (cameraVideo.readyState < 2 || screenVideo.readyState < 2) {
      // Overlay is still up; don't let the already-buffered AAC run ahead.
      micAudioPlayer.value?.pause();
      return;
    }

    // Both streams now have enough data to play — dismiss the warm-up overlay.
    isVideoLoading.value = false;

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

    syncFollower(screenVideo, cameraVideo);
    const micAudio = micAudioPlayer.value;
    if (micAudio) {
      micAudio.playbackRate = screenVideo.playbackRate;
      syncFollower(screenVideo, micAudio);
    }

    updateDualPlaybackState();
  };

  const startDualSync = () => {
    stopDualSync();
    // Run once immediately so a warm re-load dismisses the overlay without
    // waiting a full interval, then poll for drift/readiness.
    syncDualStreams();
    dualSyncLoop.start();
  };

  /**
   * Point the mic element at the progressive `.aac`. No hls.js: a single file
   * with Range support is cheaper as a plain `src`. A mic that fails to load
   * must never take down video playback — the video's own audio is still there.
   */
  const attachMicAudio = (seekToTime?: number, shouldAutoPlay?: boolean) => {
    const micAudio = micAudioPlayer.value;
    const url = micAudioUrl.value;
    if (!micAudio || !url) return;

    if (micAudio.src !== url) {
      micAudio.src = url;
      micAudio.preload = "auto";
    }
    if (seekToTime !== undefined && Number.isFinite(seekToTime)) {
      micAudio.currentTime = seekToTime;
    }
    applyDualAudioState();
    // Never autoplay here: the AAC is ready long before HLS, so a play()
    // would start sound during the warming overlay. playDualStreams /
    // syncFollower start it once the master video is actually playable.
    if (
      shouldAutoPlay !== false &&
      screenVideoPlayer.value &&
      !screenVideoPlayer.value.paused &&
      screenVideoPlayer.value.readyState >= 2 &&
      cameraVideoPlayer.value &&
      cameraVideoPlayer.value.readyState >= 2
    ) {
      micAudio.play().catch(() => {
        /* Ignore mic autoplay error */
      });
    }
  };

  const detachMicAudio = () => {
    const micAudio = micAudioPlayer.value;
    if (!micAudio) return;
    micAudio.pause();
    micAudio.removeAttribute("src");
    micAudio.load();
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
    // getDualMasterVideo() prefers the screen element, so that is the instance
    // whose playhead the heartbeat should follow.
    const fLoader = label === "screen" ? getProgressFragmentLoader?.() : undefined;
    const hlsInstance = new Hls({
      ...getHlsConfig(mode),
      ...(fLoader ? { fLoader } : {}),
    });
    hlsRef.value = hlsInstance;

    hlsInstance.loadSource(stream.url);
    hlsInstance.attachMedia(video);

    hlsInstance.on(Events.MANIFEST_PARSED, () => {
      onSourceReady(video, label, seekToTime, shouldAutoPlay);
    });

    if (onNetworkError) attachNetworkErrorSniffer(hlsInstance, onNetworkError);

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

    // Demo build: both panes get a poster and a frozen clock — see
    // lib/demoRegistry.ts. No manifest is fetched, so nothing can fail.
    if (__DEMO__ && demoHooks.playback) {
      cleanupSingleVideoSource();
      cleanupDualVideoSources();
      demoHooks.playback.attach(cameraVideo, "camera");
      demoHooks.playback.attach(screenVideo, "screen");
      isVideoLoading.value = false;
      return;
    }

    // Own the warm-up overlay for the dual load; syncDualStreams clears it once
    // both streams are playable.
    isVideoLoading.value = true;

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
      attachMicAudio(seekToTime, shouldAutoPlay);
      startDualSync();
    } catch (err: unknown) {
      console.error("Failed to load dual video sources:", err);
      const errorMessage =
        "Failed to load dual video sources: " + (err instanceof Error ? err.message : String(err));
      error.value = errorMessage;
      isVideoLoading.value = false;
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
    micAudioPlayer.value?.pause();
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
    if (micAudioPlayer.value) {
      micAudioPlayer.value.currentTime = boundedTime;
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
