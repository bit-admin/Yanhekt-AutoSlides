import { ref, shallowRef, computed, nextTick, watch, type Ref } from "vue";
import Hls, { Events, ErrorDetails } from "hls.js";
import {
  attachNetworkErrorSniffer,
  createFatalErrorReporter,
  createSingleStreamHlsErrorHandler,
} from "./useVideoErrorRecovery";
import { useDualStreamPlayer } from "./useDualStreamPlayer";
import { createMediaSyncLoop, syncFollower } from "./mediaSync";
import { authStore } from "../../stores/authStore";
import { getRecordedPlaybackData, getLivePlaybackData, getRelayBase, type PlaybackData } from "../../lib/streamUrls";
import { ensureRuntimeConfig, runtimeConfigStore } from "../../stores/runtimeConfigStore";
import { probeRelayReach } from "../../lib/relayDiagnostics";
import { demoHooks } from "../../lib/demoRegistry";
import type { Course } from "../useCourseList";
import { getMicAudioUrl, type SessionData } from "../../lib/api";
import { createWatchProgressSync } from "./useWatchProgress";
import { configStore } from "../../stores/configStore";

// Trimmed port of the desktop app's features/video/useVideoPlayer.ts: the
// Electron proxy client, config store, mute policy, and slide-extraction
// plumbing are gone; stream URLs come from lib/streamUrls (relay for
// recorded, raw m3u8 for live) and a native-HLS fallback covers Safari/iOS.

export const DUAL_STREAM_KEY = "__dual__";
export type DualAudioSource = "screen" | "camera" | "mic";

export type { VideoStream, PlaybackData } from "../../lib/streamUrls";

export interface UseVideoPlayerOptions {
  mode: "live" | "recorded";
  course: Ref<Course | null>;
  session: Ref<SessionData | null>;
}

export function useVideoPlayer(options: UseVideoPlayerOptions) {
  const { mode, course, session } = options;

  // Reactive state
  const loading = ref(true);
  const error = ref<string | null>(null);
  // Set alongside `error` when the failure has a known cause worth explaining
  // rather than just reporting. Currently only one: this deployment streams
  // recorded video from the relay's own origin, and that origin would not
  // answer this browser.
  const errorKind = ref<"relay_offcampus" | null>(null);
  const playbackData = ref<PlaybackData | null>(null);
  const selectedStream = ref<string>("");
  const isPlaying = ref(false);
  // True from the moment an HLS source starts loading until the first frame is
  // playable — drives the "warming up" overlay for the (potentially slow) cold
  // relay open. Distinct from `loading` (the stream-metadata fetch).
  const isVideoLoading = ref(false);
  const videoPlayer = ref<HTMLVideoElement | null>(null);
  const cameraVideoPlayer = ref<HTMLVideoElement | null>(null);
  const screenVideoPlayer = ref<HTMLVideoElement | null>(null);
  const micAudioPlayer = ref<HTMLAudioElement | null>(null);
  const hls = shallowRef<Hls | null>(null);
  const currentPlaybackRate = ref(1);
  const isVideoMuted = ref(false);
  const isRetrying = ref(false);
  const retryMessage = ref("");
  const maxVideoErrorRetries = ref(5);

  // Error tracking state (non-reactive for performance)
  let videoErrorRetryCount = 0;
  let lastPlaybackPosition = 0;
  let wasPlayingBeforeError = false;
  let lastPlaybackRateBeforeError = 1;
  let consecutiveErrorsAtSamePosition = 0;
  let lastErrorPosition = -1;
  let isHlsRecovering = false;
  // Set when the browser lacks MSE and plays HLS natively (Safari/iOS).
  let usingNativeHls = false;

  // The web player has no app-level mute policy (the desktop app mutes
  // background/live playback via settings); keep the computed so ported
  // control code stays identical.
  const shouldVideoMute = computed(() => false);

  const isScreenRecordingSelected = computed(() => {
    if (!playbackData.value || !selectedStream.value) return false;
    if (selectedStream.value === DUAL_STREAM_KEY) return false;
    const currentStream = playbackData.value.streams[selectedStream.value];
    return currentStream?.type === "screen";
  });

  const cameraStreamData = computed(() => {
    if (!playbackData.value) return null;
    return Object.values(playbackData.value.streams).find((stream) => stream.type === "camera") || null;
  });

  const screenStreamData = computed(() => {
    if (!playbackData.value) return null;
    return Object.values(playbackData.value.streams).find((stream) => stream.type === "screen") || null;
  });

  /**
   * Classroom mic track for this lecture, or null when it has none.
   * Read off a sibling field rather than `streams` on purpose — `streams` is
   * the list of video feeds.
   */
  const micAudioUrl = computed(() => playbackData.value?.audioUrl || null);
  const hasMicAudio = computed(() => Boolean(micAudioUrl.value));

  const hasDualStreams = computed(() => {
    return Boolean(cameraStreamData.value && screenStreamData.value);
  });

  const isDualStreamSelected = computed(() => {
    return selectedStream.value === DUAL_STREAM_KEY && hasDualStreams.value;
  });

  const currentStreamData = computed(() => {
    if (!playbackData.value || !selectedStream.value) return null;
    if (selectedStream.value === DUAL_STREAM_KEY) return null;
    return playbackData.value.streams[selectedStream.value];
  });

  const getCurrentPlaybackTime = () => {
    if (videoPlayer.value) return videoPlayer.value.currentTime;

    const masterVideo = dual.getDualMasterVideo();
    if (masterVideo) return masterVideo.currentTime;

    return dual.dualCurrentTime.value;
  };

  const isAnyVideoPlaying = () => {
    if (videoPlayer.value) return !videoPlayer.value.paused;

    const masterVideo = dual.getDualMasterVideo();
    return Boolean(masterVideo && !masterVideo.paused);
  };

  /**
   * Yanhekt's own watch position for this recorded session. The two accessors
   * above already cover single *and* dual playback. Reporting rides the relay's
   * segment requests, so it costs nothing; where that is unavailable (native
   * HLS, or a relay that ignores `sid`) the position is recorded on pause and
   * close instead of falling back to a billed heartbeat.
   */
  const resumeProgressEnabled = () =>
    mode === "recorded" && configStore.resumeFromServerProgress === true;

  const progressSync = createWatchProgressSync({
    sessionId: () => (mode === "recorded" ? session.value?.session_id : undefined),
    enabled: resumeProgressEnabled,
    getCurrentTime: getCurrentPlaybackTime,
    isPlaying: isAnyVideoPlaying,
  });

  // Resolved once per open. A cold open loads the source more than once — the
  // stream-data watcher re-runs it — and each load tears the previous Hls
  // instance down, so this must survive until it has actually stuck. It is
  // dropped once the playhead has genuinely moved past it (the user seeking, or
  // a stream switch re-loading mid-lecture), so a later load never yanks anyone
  // back here.
  let pendingResumeSeconds: number | null = null;

  const resumeStartPosition = (): number | undefined => {
    if (pendingResumeSeconds === null) return undefined;
    if (getCurrentPlaybackTime() > pendingResumeSeconds + 2) {
      pendingResumeSeconds = null;
      return undefined;
    }
    return pendingResumeSeconds;
  };

  // Mode-specific HLS configuration — copied verbatim from the desktop app.
  const getHlsConfig = (hlsMode: "live" | "recorded") => {
    const baseConfig = {
      enableWorker: true,
      debug: false,
      startFragPrefetch: true,
      testBandwidth: false,
      progressive: false,
      maxBufferHole: 0.5,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 3,
      maxFragLookUpTolerance: 0.25,
      minAutoBitrate: 0,
    };

    if (hlsMode === "live") {
      return {
        ...baseConfig,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 20 * 1000 * 1000,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        liveDurationInfinity: true,
        fragLoadingTimeOut: 8000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 16000,
        levelLoadingTimeOut: 5000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        levelLoadingMaxRetryTimeout: 16000,
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 16000,
        highBufferWatchdogPeriod: 1,
        maxStarvationDelay: 2,
        maxLoadingDelay: 2,
      };
    } else {
      return {
        ...baseConfig,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000,
        // Recorded playback goes through the relay, whose first (cold) open of a
        // given video pays a mint + China round-trip that can take tens of
        // seconds. Keep a generous per-attempt timeout so a slow cold open isn't
        // aborted prematurely (which would re-trigger the cold work each retry).
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,
        highBufferWatchdogPeriod: 2,
        maxStarvationDelay: 4,
        maxLoadingDelay: 4,
      };
    }
  };

  const handleTaskError = (_message: string) => {
    // The desktop app forwards task-queue errors here; the web player has no
    // task queue, so errors surface only through the `error` ref.
  };

  // ── Single-stream mic audio ────────────────────────────────────────────────
  // Dual mode routes audio inside useDualStreamPlayer; single mode has no such
  // subsystem (and, before the mic track, no sync loop at all), so it lives here.

  /** In single-stream mode the choice is between the stream's own audio and the mic. */
  const singleAudioSource = ref<"video" | "mic">("video");
  /** Last volume applied by the UI slider, so routing changes can re-apply it. */
  const singleVolumeLevel = ref(1);

  /**
   * Route the audible track in single-stream mode. Uses the same
   * `muted = false` + `volume = 0` convention as everywhere else in the player.
   */
  const applySingleAudioState = (volume?: number) => {
    if (volume !== undefined) {
      singleVolumeLevel.value = Math.min(1, Math.max(0, volume));
    }
    const level = shouldVideoMute.value ? 0 : singleVolumeLevel.value;
    const video = videoPlayer.value;
    const micAudio = micAudioPlayer.value;
    const useMic = singleAudioSource.value === "mic" && hasMicAudio.value;

    if (video) {
      video.volume = useMic ? 0 : level;
      video.muted = false;
    }
    if (micAudio) {
      micAudio.volume = useMic ? level : 0;
      micAudio.muted = false;
    }
  };

  const syncSingleMic = () => {
    const video = videoPlayer.value;
    const micAudio = micAudioPlayer.value;
    if (!video || !micAudio) return;
    // Match the warming overlay: isVideoLoading is cleared on canplay, which
    // is slightly later than readyState >= 2.
    if (isVideoLoading.value) {
      if (!micAudio.paused) micAudio.pause();
      return;
    }
    micAudio.playbackRate = video.playbackRate;
    syncFollower(video, micAudio);
    applySingleAudioState();
  };

  const singleSyncLoop = createMediaSyncLoop(syncSingleMic);

  const attachSingleMicAudio = (seekToTime?: number) => {
    const micAudio = micAudioPlayer.value;
    const url = micAudioUrl.value;
    if (!micAudio || !url || singleAudioSource.value !== "mic") return;

    if (micAudio.src !== url) {
      micAudio.src = url;
      micAudio.preload = "auto";
    }
    if (seekToTime !== undefined && Number.isFinite(seekToTime)) {
      micAudio.currentTime = seekToTime;
    }
    applySingleAudioState();
    singleSyncLoop.start();
    syncSingleMic();
  };

  const detachSingleMicAudio = () => {
    singleSyncLoop.stop();
    const micAudio = micAudioPlayer.value;
    if (!micAudio) return;
    micAudio.pause();
    micAudio.removeAttribute("src");
    micAudio.load();
  };

  const setSingleAudioSource = (source: "video" | "mic") => {
    singleAudioSource.value = source;
    if (source === "mic") {
      attachSingleMicAudio(videoPlayer.value?.currentTime);
    } else {
      detachSingleMicAudio();
    }
    applySingleAudioState();
  };

  const cleanupSingleVideoSource = () => {
    if (hls.value) {
      hls.value.destroy();
      hls.value = null;
    }
    if (usingNativeHls && videoPlayer.value) {
      videoPlayer.value.removeAttribute("src");
      videoPlayer.value.load();
      usingNativeHls = false;
    }
    detachSingleMicAudio();
  };

  const onEnded = async () => {
    // Nothing to tear down on the web (the desktop app stops its local
    // signature loop here).
  };

  // Dual-stream (camera + screen) subsystem.
  const dual = useDualStreamPlayer({
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
    onEnded: () => onEnded(),
    // Lazy call: classifyRelayFailure is defined below this hook.
    onNetworkError: () => classifyRelayFailure(),
    getProgressFragmentLoader: () => progressSync.fragmentLoader(),
  });

  const loadVideoStreams = async () => {
    try {
      loading.value = true;
      error.value = null;

      const token = authStore.token.value;
      if (!token) {
        throw new Error("Authentication token not found");
      }

      let result: PlaybackData;

      // Recorded URLs depend on the deployment's relay policy; live doesn't.
      if (mode === "recorded") {
        await ensureRuntimeConfig();
      }

      if (mode === "live" && course.value) {
        result = getLivePlaybackData(course.value);
      } else if (mode === "recorded" && session.value) {
        // The mic URL is not on the session — only GET /v1/video carries it.
        // Memoised, so re-opening the same lecture costs nothing. Live has no
        // mic track at all. A failed resolve must not fail video playback.
        // Kicked off alongside the mic lookup so honoring the saved position
        // adds no serial latency to opening a lecture.
        const resumePromise = progressSync.resume();
        const resolvedMicUrl = await getMicAudioUrl(String(session.value.video_id), token);
        // `sid` is what opts the relay into reporting: without it the segment
        // requests stay exactly what they were.
        result = getRecordedPlaybackData(
          session.value,
          token,
          resolvedMicUrl,
          resumeProgressEnabled() ? String(session.value.session_id) : undefined,
        );
        pendingResumeSeconds = await resumePromise;
        progressSync.start();
      } else {
        throw new Error("Invalid playback parameters");
      }

      playbackData.value = result;

      // Warm the relay verdict while the player sets up: a blocked viewer's
      // first error then resolves immediately instead of after a round trip.
      const relayOrigin = relayPolicyOrigin();
      if (relayOrigin) void probeRelayReach(relayOrigin);

      const streamKeys = Object.keys(result.streams);
      if (streamKeys.length > 0) {
        const screenStream = streamKeys.find((key) => result.streams[key].type === "screen");
        selectedStream.value = screenStream || streamKeys[0];

        await nextTick();
        await loadVideoSource();
      } else {
        throw new Error("No video streams available");
      }
    } catch (err: unknown) {
      console.error("Failed to load video streams:", err);
      const errorMessage = (err instanceof Error && err.message) || "Failed to load video streams";
      error.value = errorMessage;
      isRetrying.value = false;
      retryMessage.value = "";
    } finally {
      loading.value = false;
    }
  };

  /**
   * The relay origin this playback depends on, when the deployment sends the
   * browser there itself. Null for live, for same-origin relaying, and when a
   * custom Settings endpoint is in play (that relay is the user's own).
   */
  const relayPolicyOrigin = (): string | null => {
    if (mode !== "recorded") return null;
    const relay = runtimeConfigStore.config.value.relay;
    if (relay.mode !== "direct" || !relay.origin) return null;
    return getRelayBase() === relay.origin ? relay.origin : null;
  };

  /**
   * Why did recorded playback fail? When the browser reaches the relay itself,
   * the likeliest answer is that the relay's edge did not admit this network —
   * and hls.js cannot tell us, because a challenge response is cross-origin
   * with no CORS headers, so the request fails opaquely. Probe the relay's
   * beacon (memoised per origin) and, when it is refusing us too, stop: the
   * retry ladder cannot fix a network the relay will not serve, and the viewer
   * would otherwise watch a spinner until every retry has been spent.
   */
  const classifyRelayFailure = (): void => {
    const origin = relayPolicyOrigin();
    if (!origin || errorKind.value) return;

    void probeRelayReach(origin).then((reach) => {
      // Only a definite refusal ends playback. A probe that timed out
      // ("unknown") says nothing, and the normal retry ladder deserves its
      // chance — as does a retry that got through while we were probing.
      if (reach !== "blocked" || errorKind.value) return;
      if (isPlaying.value || (videoPlayer.value?.readyState ?? 0) >= 2) return;

      errorKind.value = "relay_offcampus";
      // Stop the retry ladder; the message is now on screen.
      hls.value?.stopLoad();
      dual.cleanupDualVideoSources();
      isVideoLoading.value = false;
      isRetrying.value = false;
      retryMessage.value = "";
      if (!error.value) error.value = "Recorded playback could not be loaded from the relay";
    });
  };

  // Backstop for paths with no error sniffer (native HLS on Safari/iOS): once a
  // failure has surfaced, still say why.
  watch(error, (message) => {
    if (!message) {
      errorKind.value = null;
      return;
    }
    classifyRelayFailure();
  });

  // Shared HLS scaffold for the two single-stream load paths.
  type SingleStreamErrorConfig = Omit<
    Parameters<typeof createSingleStreamHlsErrorHandler>[0],
    "hls" | "reportFatal"
  >;

  const setupHlsSource = async (opts: {
    catchLogLabel: string;
    onManifestParsed: () => void;
    errorConfig: SingleStreamErrorConfig;
    /**
     * Seek target for a fresh open. Passed into hls.js rather than assigned to
     * the element: `currentTime` right after MANIFEST_PARSED is clamped back to
     * 0 while MSE still has no duration.
     */
    startPosition?: number;
  }) => {
    if (!videoPlayer.value || !currentStreamData.value) {
      return;
    }

    // Demo build: no media exists, so hand the element a poster and a frozen
    // clock instead of pointing hls.js at a manifest that would 404 and take
    // the retry ladder with it.
    if (__DEMO__ && demoHooks.playback) {
      dual.cleanupDualVideoSources();
      cleanupSingleVideoSource();
      demoHooks.playback.attach(
        videoPlayer.value,
        isScreenRecordingSelected.value ? "screen" : "camera",
      );
      isVideoLoading.value = false;
      return;
    }

    isVideoLoading.value = true;

    try {
      dual.cleanupDualVideoSources();
      cleanupSingleVideoSource();

      const videoUrl = currentStreamData.value.url;

      if (Hls.isSupported()) {
        // Turns every segment fetch into a watch-progress heartbeat; undefined
        // when there is nothing to report, leaving hls.js its own loader.
        const fLoader = progressSync.fragmentLoader();
        hls.value = new Hls({
          ...getHlsConfig(mode),
          ...(opts.startPosition !== undefined ? { startPosition: opts.startPosition } : {}),
          ...(fLoader ? { fLoader } : {}),
        });

        hls.value.loadSource(videoUrl);
        hls.value.attachMedia(videoPlayer.value);

        hls.value.on(Events.MANIFEST_PARSED, () => {
          setTimeout(opts.onManifestParsed, 100);
        });

        attachNetworkErrorSniffer(hls.value, classifyRelayFailure);

        const reportFatal = createFatalErrorReporter({ error, isRetrying, retryMessage, handleTaskError });

        hls.value.on(
          Events.ERROR,
          createSingleStreamHlsErrorHandler({
            hls,
            reportFatal,
            ...opts.errorConfig,
          }),
        );
      } else if (videoPlayer.value.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari/iOS: no MSE — native HLS playback straight off the m3u8 URL.
        usingNativeHls = true;
        videoPlayer.value.src = videoUrl;
        videoPlayer.value.addEventListener(
          "loadedmetadata",
          () => setTimeout(opts.onManifestParsed, 100),
          { once: true },
        );
      } else {
        throw new Error("HLS is not supported in this browser");
      }

      if (singleAudioSource.value === "mic") {
        attachSingleMicAudio(videoPlayer.value?.currentTime);
      }
    } catch (err: unknown) {
      console.error(opts.catchLogLabel, err);
      const errorMessage =
        "Failed to load video source: " + (err instanceof Error ? err.message : String(err));
      error.value = errorMessage;
      isRetrying.value = false;
      retryMessage.value = "";
      isVideoLoading.value = false;
    }
  };

  const loadVideoSourceWithPosition = (seekToTime?: number, shouldAutoPlay?: boolean) =>
    setupHlsSource({
      catchLogLabel: "Failed to load video source with position:",
      onManifestParsed: () => {
        if (!videoPlayer.value) return;
        const targetRate =
          mode === "recorded" && lastPlaybackRateBeforeError > 1
            ? lastPlaybackRateBeforeError
            : currentPlaybackRate.value;
        videoPlayer.value.playbackRate = mode === "recorded" ? targetRate : 1;
        currentPlaybackRate.value = mode === "recorded" ? targetRate : 1;

        if (seekToTime && seekToTime > 0) {
          videoPlayer.value.currentTime = seekToTime;
        }

        if (shouldAutoPlay !== false) {
          setTimeout(() => {
            if (videoPlayer.value) {
              videoPlayer.value.play().catch(() => {
                setTimeout(() => {
                  if (videoPlayer.value) {
                    videoPlayer.value.play().catch(() => {
                      /* Ignore retry play error */
                    });
                  }
                }, 500);
              });
            }
          }, 200);
        }
      },
      errorConfig: {
        logLabel: "HLS error during position restore:",
        defaultErrorLabel: "Other fatal error during restore:",
        recoverMediaError: (data, attempt) => {
          if (
            data.details === ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === ErrorDetails.BUFFER_FULL_ERROR ||
            data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE
          ) {
            setTimeout(() => {
              if (hls.value && videoPlayer.value) {
                const currentTime = videoPlayer.value.currentTime;
                videoPlayer.value.currentTime = currentTime + 0.1;
                hls.value.recoverMediaError();
              }
            }, 500);
          } else {
            setTimeout(() => {
              if (hls.value) {
                hls.value.recoverMediaError();
              }
            }, 1000 * attempt);
          }
        },
      },
    });

  const loadVideoSource = () =>
    setupHlsSource({
      catchLogLabel: "Failed to load video source:",
      startPosition: resumeStartPosition(),
      onManifestParsed: () => {
        if (!videoPlayer.value) return;
        videoPlayer.value.playbackRate = mode === "recorded" ? currentPlaybackRate.value : 1;
        if (mode !== "recorded") currentPlaybackRate.value = 1;

        // startPosition above already put hls.js at the resume point; this
        // covers native HLS (which has no such option) and a manifest that
        // parsed before the position was resolved.
        const resumeAt = resumeStartPosition();
        if (resumeAt !== undefined && Math.abs(videoPlayer.value.currentTime - resumeAt) > 1) {
          videoPlayer.value.currentTime = resumeAt;
        }

        videoPlayer.value.play().catch(() => {
          /* Ignore manifest parsed play error */
        });
      },
      errorConfig: {
        logLabel: "HLS error:",
        defaultErrorLabel: "Other fatal error:",
        onFatalStart: () => {
          isHlsRecovering = true;
        },
        onNonFatal: (data) => {
          console.warn("Non-fatal HLS error:", data.details, data);
        },
        recoverMediaError: (data, attempt) => {
          const currentPosition = videoPlayer.value?.currentTime || 0;
          const wasPlaying = videoPlayer.value ? !videoPlayer.value.paused : false;

          if (
            data.details === ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === ErrorDetails.BUFFER_FULL_ERROR ||
            data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE
          ) {
            setTimeout(() => {
              if (hls.value && videoPlayer.value) {
                const skipAmount = 0.5 + attempt * 0.5;
                videoPlayer.value.currentTime = currentPosition + skipAmount;
                hls.value.recoverMediaError();
              }
            }, 500);
          } else if (
            data.details === ErrorDetails.BUFFER_APPEND_ERROR ||
            data.details === ErrorDetails.BUFFER_APPENDING_ERROR
          ) {
            setTimeout(() => {
              if (hls.value && videoPlayer.value) {
                const skipAmount = 1 + attempt * 1;
                try {
                  hls.value.recoverMediaError();
                  setTimeout(() => {
                    if (videoPlayer.value) {
                      videoPlayer.value.currentTime = currentPosition + skipAmount;
                      if (wasPlaying) {
                        videoPlayer.value.play().catch(() => {
                          /* Ignore buffer recovery play error */
                        });
                      }
                    }
                    isHlsRecovering = false;
                  }, 500);
                } catch (e) {
                  console.error("Error during buffer append recovery:", e);
                  isHlsRecovering = false;
                }
              }
            }, 200);
          } else {
            setTimeout(() => {
              if (hls.value) {
                hls.value.recoverMediaError();
                setTimeout(() => {
                  if (videoPlayer.value && currentPosition > 0) {
                    videoPlayer.value.currentTime = currentPosition;
                    if (wasPlaying) {
                      videoPlayer.value.play().catch(() => {
                        /* Ignore media recovery play error */
                      });
                    }
                  }
                  isHlsRecovering = false;
                }, 1000);
              }
            }, 500 * attempt);
          }
        },
      },
    });

  const switchStream = async () => {
    const wasPlaying = isAnyVideoPlaying();
    const currentTime = getCurrentPlaybackTime();

    if (isDualStreamSelected.value) {
      cleanupSingleVideoSource();
      await nextTick();
      await dual.loadDualVideoSources(currentTime, true);
      return;
    }

    dual.cleanupDualVideoSources();
    await nextTick();

    if (videoPlayer.value) {
      await loadVideoSource();

      if (videoPlayer.value) {
        videoPlayer.value.currentTime = currentTime;
        videoPlayer.value.playbackRate = mode === "recorded" ? currentPlaybackRate.value : 1;

        if (singleAudioSource.value === "mic") {
          attachSingleMicAudio(currentTime);
        }

        try {
          await videoPlayer.value.play();
          syncSingleMic();
        } catch (err) {
          if (wasPlaying) {
            console.warn("Could not resume playback:", err);
          }
        }
      }
    }
  };

  const retryLoad = () => {
    error.value = null;
    lastPlaybackPosition = 0;
    dual.cleanupDualVideoSources();
    loadVideoStreams();
  };

  const changePlaybackRate = () => {
    if (isDualStreamSelected.value) {
      const playbackRateNumber = Number(currentPlaybackRate.value);
      if (cameraVideoPlayer.value) {
        cameraVideoPlayer.value.playbackRate = mode === "recorded" ? playbackRateNumber : 1;
      }
      if (screenVideoPlayer.value) {
        screenVideoPlayer.value.playbackRate = mode === "recorded" ? playbackRateNumber : 1;
      }
      if (micAudioPlayer.value) {
        micAudioPlayer.value.playbackRate = mode === "recorded" ? playbackRateNumber : 1;
      }
      if (mode !== "recorded") {
        currentPlaybackRate.value = 1;
      }
      return;
    }

    if (videoPlayer.value) {
      videoPlayer.value.playbackRate = Number(currentPlaybackRate.value);
    }
    if (micAudioPlayer.value) {
      micAudioPlayer.value.playbackRate = Number(currentPlaybackRate.value);
    }
  };

  const cleanup = () => {
    // Before the elements go: stop() sends the final position, and it can only
    // read it while there is still a player to read it from.
    progressSync.stop();
    cleanupSingleVideoSource();
    dual.cleanupDualVideoSources();
  };

  // Event handlers
  const onVideoError = async (event: Event) => {
    const target = event.target as HTMLVideoElement;
    const errorCode = target.error?.code;
    const errorMessage = target.error?.message;

    if (isHlsRecovering) {
      setTimeout(() => {
        if (isHlsRecovering) {
          isHlsRecovering = false;
          onVideoError(event);
        }
      }, 2000);
      return;
    }

    if (target.currentTime > 0) {
      lastPlaybackPosition = target.currentTime;
      wasPlayingBeforeError = !target.paused;
      lastPlaybackRateBeforeError = target.playbackRate;
    }

    if (Math.abs(lastPlaybackPosition - lastErrorPosition) < 4.5) {
      consecutiveErrorsAtSamePosition++;
    } else {
      consecutiveErrorsAtSamePosition = 1;
      lastErrorPosition = lastPlaybackPosition;
    }

    console.error("Video error:", {
      errorCode,
      errorMessage,
      retryCount: videoErrorRetryCount,
      currentTime: target.currentTime,
      wasPlaying: wasPlayingBeforeError,
      consecutiveErrors: consecutiveErrorsAtSamePosition,
      lastErrorPos: lastErrorPosition,
    });

    let userMessage = "Video playback error";
    let shouldRetry = false;

    switch (errorCode) {
      case 1:
        userMessage = "Video playback was aborted";
        break;
      case 2:
        userMessage = "Network error occurred while loading video";
        shouldRetry = true;
        break;
      case 3:
        userMessage = "Video decoding error";
        shouldRetry = true;
        break;
      case 4:
        userMessage = "Video format not supported";
        break;
    }

    if (shouldRetry && videoErrorRetryCount < maxVideoErrorRetries.value) {
      videoErrorRetryCount++;

      let skipAmount = 0;
      if (errorCode === 3) {
        if (consecutiveErrorsAtSamePosition === 1) {
          skipAmount = 1;
        } else if (consecutiveErrorsAtSamePosition === 2) {
          skipAmount = 3;
        } else {
          skipAmount = 5;
        }
      }

      const targetPosition = lastPlaybackPosition + skipAmount;

      isRetrying.value = true;
      retryMessage.value = `Recovering from playback error... (${videoErrorRetryCount}/${maxVideoErrorRetries.value})`;

      setTimeout(
        () => {
          if (videoPlayer.value && currentStreamData.value) {
            loadVideoSourceWithPosition(targetPosition, true);
          }
        },
        1000 + 500 * videoErrorRetryCount,
      );
    } else {
      if (videoErrorRetryCount >= maxVideoErrorRetries.value) {
        userMessage += ` (Failed after ${maxVideoErrorRetries.value} retry attempts)`;
      }
      error.value = userMessage;
      isRetrying.value = false;
      retryMessage.value = "";
      isVideoLoading.value = false;

      videoErrorRetryCount = 0;
      wasPlayingBeforeError = false;
      lastPlaybackRateBeforeError = 1;
      consecutiveErrorsAtSamePosition = 0;
      lastErrorPosition = -1;
    }
  };

  const onCanPlay = () => {
    isVideoLoading.value = false;
    syncSingleMic();
    if (isRetrying.value) {
      setTimeout(() => {
        isRetrying.value = false;
        retryMessage.value = "";
      }, 500);
    }

    setTimeout(() => {
      if (videoPlayer.value && !videoPlayer.value.paused && !videoPlayer.value.ended) {
        if (consecutiveErrorsAtSamePosition > 0) {
          consecutiveErrorsAtSamePosition = Math.max(0, consecutiveErrorsAtSamePosition - 1);
        }
        if (lastPlaybackRateBeforeError > 1) {
          lastPlaybackRateBeforeError = 1;
        }
      }
    }, 1500);
  };

  const preventUnmute = (event: Event) => {
    if (shouldVideoMute.value && videoPlayer.value) {
      event.preventDefault();
      videoPlayer.value.volume = 0;
      videoPlayer.value.muted = false;
    }
  };

  const resetErrorCounters = () => {
    videoErrorRetryCount = 0;
    consecutiveErrorsAtSamePosition = 0;
    lastErrorPosition = -1;
    lastPlaybackRateBeforeError = 1;
    lastPlaybackPosition = 0;
    wasPlayingBeforeError = false;
  };

  return {
    // State
    loading,
    error,
    playbackData,
    selectedStream,
    isPlaying,
    isVideoLoading,
    videoPlayer,
    cameraVideoPlayer,
    screenVideoPlayer,
    micAudioPlayer,
    hls,
    currentPlaybackRate,
    isVideoMuted,
    isRetrying,
    retryMessage,
    errorKind,
    maxVideoErrorRetries,
    dualAudioSource: dual.dualAudioSource,
    dualVolume: dual.dualVolume,
    dualCurrentTime: dual.dualCurrentTime,
    dualDuration: dual.dualDuration,

    // Computed
    shouldVideoMute,
    isScreenRecordingSelected,
    isDualStreamSelected,
    hasDualStreams,
    currentStreamData,
    cameraStreamData,
    screenStreamData,
    micAudioUrl,
    hasMicAudio,
    singleAudioSource,
    dualCanSeek: dual.dualCanSeek,

    // The one piece of error-tracking state read externally (the error
    // screen's resume hint).
    get lastPlaybackPosition() {
      return lastPlaybackPosition;
    },

    // Methods
    loadVideoStreams,
    loadVideoSource,
    loadVideoSourceWithPosition,
    loadDualVideoSources: dual.loadDualVideoSources,
    switchStream,
    retryLoad,
    changePlaybackRate,
    toggleDualPlayback: dual.toggleDualPlayback,
    playDualStreams: dual.playDualStreams,
    pauseDualStreams: dual.pauseDualStreams,
    seekDualStreams: dual.seekDualStreams,
    setDualAudioSource: dual.setDualAudioSource,
    setDualVolume: dual.setDualVolume,
    applyDualAudioState: dual.applyDualAudioState,
    setSingleAudioSource,
    applySingleAudioState,
    cleanup,
    getHlsConfig,

    // Event handlers
    onVideoError,
    onCanPlay,
    onEnded,
    preventUnmute,
    onDualTimeUpdate: dual.onDualTimeUpdate,
    onDualPlayStateChanged: dual.onDualPlayStateChanged,
    onDualEnded: dual.onDualEnded,
    preventDualUnmute: dual.preventDualUnmute,

    // Utility
    resetErrorCounters,
  };
}
