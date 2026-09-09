/**
 * Yanhekt's own per-account watch position for one recorded session: read it
 * when a lecture opens, report it back while it plays.
 *
 * Ported from the desktop app's `renderer/shared/services/watchProgressService.ts`,
 * with one structural difference — **the heartbeat rides the segment requests
 * the browser is already making.**
 *
 * The desktop app PUTs the playhead on a 5-second wall-clock interval. Doing
 * that here would cost ~1000 Worker requests per 90-minute lecture, four times
 * what streaming it costs. So instead the hls.js fragment loader appends the
 * playhead to each `/segment` URL as `p=`, and the relay Worker forwards it to
 * Yanhekt as a subrequest — which Cloudflare does not bill as a request. The
 * relay cannot work the position out for itself: hls.js fetches up to a full
 * buffer (30s) ahead of the playhead, so a segment's own media offset would
 * resume the lecture roughly a minute late.
 *
 * **The heartbeat is free or it does not happen.** Where the piggyback cannot
 * run — native HLS has no loader to hook, and an older or LAN relay ignores
 * `sid` — we do *not* fall back to a billed wall-clock heartbeat. Progress is
 * simply recorded at the edges instead:
 *
 *  - **On pause**, detected from the play→pause edge in the local tick below
 *    rather than a listener, so it covers the button, the keyboard, media keys,
 *    Picture-in-Picture and `ended` alike, in single and dual mode.
 *  - **On close**, from `stop()` (teardown) and a `pagehide` handler.
 *
 * So a viewer on a browser that cannot piggyback still resumes where they left
 * off; what they lose is only granularity if the tab is killed outright
 * mid-play. That is the deliberate trade: never spend a Worker request per
 * lecture-minute to buy it back.
 *
 * Everything is best-effort: no token, no history, or a network failure all mean
 * "start at the beginning", never a visible error.
 */
import Hls, {
  type FragmentLoaderConstructor,
  type FragmentLoaderContext,
  type HlsConfig,
  type Loader,
  type LoaderCallbacks,
  type LoaderConfiguration,
} from "hls.js";
import { getResumePosition, reportWatchProgress } from "../../lib/api";
import { authStore } from "../../stores/authStore";
import { progressBucket } from "../../lib/watchProgress";

/**
 * Purely local tick — it never issues a request. It remembers where the viewer
 * is, so a final report survives a teardown that has already detached the
 * elements, and it spots the play→pause edge that triggers one.
 */
const OBSERVE_MS = 5000;

export interface WatchProgressOptions {
  /** Recorded session id, or undefined when there is nothing to sync against. */
  sessionId: () => string | undefined;
  /** The user's opt-in, re-read on every call. */
  enabled: () => boolean;
  /** Current playhead in seconds (covers single *and* dual playback). */
  getCurrentTime: () => number;
  /** False while paused, ended or not yet started — no heartbeat then. */
  isPlaying: () => boolean;
}

export interface WatchProgressSync {
  /** Server position to open at, or null for the beginning. Safe when disabled. */
  resume(): Promise<number | null>;
  /**
   * An hls.js `fLoader` that appends the playhead to relay segment URLs, or
   * undefined when there is nothing to report — in which case hls.js keeps its
   * own default loader.
   */
  fragmentLoader(): FragmentLoaderConstructor | undefined;
  /** Begin reporting. Idempotent. */
  start(): void;
  /** Stop reporting and send one last position. */
  stop(): void;
}

export function createWatchProgressSync(opts: WatchProgressOptions): WatchProgressSync {
  let timer: ReturnType<typeof setInterval> | null = null;
  let onPageHide: (() => void) | null = null;
  // Keyed by session so a bucket carried over from a previously played lecture
  // cannot suppress the first report for the new one.
  let lastReported: { sessionId: string; bucket: number } | null = null;
  // Vue clears template refs before `onUnmounted`, so by the time the host calls
  // stop() the playhead may already read 0. This is what the final report falls
  // back to — at worst one observe-tick stale.
  let lastSeenSeconds = 0;
  // Previous tick's play state, for the pause edge.
  let wasPlaying = false;

  // A session id AND the opt-in AND a login token — the position is per account.
  const context = (): { sessionId: string; token: string } | null => {
    if (!opts.enabled()) return null;
    const sessionId = opts.sessionId();
    const token = authStore.token.value;
    if (!sessionId || !token) return null;
    return { sessionId, token };
  };

  /** Live playhead, or the last one seen if the player is already gone. */
  const observedSeconds = (): number => {
    const live = opts.getCurrentTime();
    if (live > 0) lastSeenSeconds = live;
    return live > 0 ? live : lastSeenSeconds;
  };

  /** The playhead to report right now, floored onto the official 5s grid. */
  const currentBucket = (): { sessionId: string; token: string; bucket: number } | null => {
    const ctx = context();
    if (!ctx) return null;
    const bucket = progressBucket(observedSeconds());
    return bucket > 0 ? { ...ctx, bucket } : null;
  };

  /** Report through the Worker proxy — the paths piggyback cannot reach. */
  const reportDirect = (): void => {
    const now = currentBucket();
    if (!now) return;
    if (lastReported?.sessionId === now.sessionId && lastReported.bucket === now.bucket) return;

    lastReported = { sessionId: now.sessionId, bucket: now.bucket };
    void reportWatchProgress(now.sessionId, now.bucket, now.token);
  };

  return {
    async resume() {
      const ctx = context();
      if (!ctx) return null;

      const position = await getResumePosition(ctx.sessionId, ctx.token);
      // The seek we are about to perform is already known to the server; a
      // fresh start clears the slate so the first report always lands.
      lastReported =
        position === null
          ? null
          : { sessionId: ctx.sessionId, bucket: progressBucket(position) };
      return position;
    },

    fragmentLoader() {
      if (!context()) return undefined;

      // hls.js calls `load()` with the URL straight out of the playlist, which
      // the relay already stamped with `sid=`. Appending the live playhead here
      // is what turns a segment fetch into a heartbeat.
      const Base = Hls.DefaultConfig.loader as unknown as {
        new (config: HlsConfig): Loader<FragmentLoaderContext>;
      };

      return class ProgressReportingLoader extends Base {
        load(
          context_: FragmentLoaderContext,
          config: LoaderConfiguration,
          callbacks: LoaderCallbacks<FragmentLoaderContext>,
        ): void {
          // Only while actually playing: hls.js prefetches the first fragments
          // on attach, and reporting those would push a lecture forward just
          // for having been opened.
          const now = opts.isPlaying() ? currentBucket() : null;
          if (now && context_.url.includes("sid=")) {
            context_.url = `${context_.url}&p=${now.bucket}`;
            lastReported = { sessionId: now.sessionId, bucket: now.bucket };
          }
          super.load(context_, config, callbacks);
        }
      };
    },

    start() {
      // Nothing to report for: don't leave an interval or a listener behind.
      // The relay was told at open time whether to report, so a mid-playback
      // opt-in could not take effect anyway.
      if (!context()) return;
      if (!onPageHide) {
        // A closed tab never reaches stop(); this is the only chance to record
        // where the viewer actually got to.
        onPageHide = () => reportDirect();
        window.addEventListener("pagehide", onPageHide);
      }
      if (timer) return;
      timer = setInterval(() => {
        const playing = opts.isPlaying();
        if (playing) {
          observedSeconds();
        } else if (wasPlaying) {
          // Just paused (or ended). The one moment worth a request, because
          // segment fetches — and with them the free heartbeat — have stopped.
          reportDirect();
        }
        wasPlaying = playing;
      }, OBSERVE_MS);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (onPageHide) {
        window.removeEventListener("pagehide", onPageHide);
        onPageHide = null;
      }
      // Final position, so closing a lecture mid-way is not rounded away.
      reportDirect();
    },
  };
}
