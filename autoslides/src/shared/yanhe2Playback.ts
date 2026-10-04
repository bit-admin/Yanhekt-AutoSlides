/**
 * Yanhe 2.0 playback — what main hands the renderer for one session.
 *
 * Recorded media sits behind a per-request signature whose secret stays in
 * main, so a recorded stream's `url` is always a local proxy URL. A live
 * stream's `url` is the unsigned live CDN playlist.
 */
import type { Yanhe2ReadResult, Yanhe2SessionStatus } from './yanhe2Calendar';

/** Teacher camera, screen, and the student-facing room camera (developer mode only). */
export type Yanhe2StreamType = 'camera' | 'screen' | 'room';

export interface Yanhe2PlaybackStream {
  type: Yanhe2StreamType;
  /** How to attach it: an HLS playlist needs hls.js, an MP4 plays in a bare `<video>`. */
  format: 'hls' | 'mp4';
  url: string;
}

export interface Yanhe2Playback {
  mode: 'live' | 'recorded';
  title: string;
  /** e.g. `2026-09-21第1-2节`. */
  subTitle: string;
  teacher: string;
  room: string;
  /** Epoch seconds; 0 when upstream gave none. */
  startAt: number;
  endAt: number;
  /** Recording length in seconds; 0 for live. */
  duration: number;
  streams: Yanhe2PlaybackStream[];
}

export interface Yanhe2PlaybackQuery {
  courseId: string;
  subId: string;
}

export type Yanhe2PlaybackResult =
  | Yanhe2ReadResult<Yanhe2Playback>
  /** The session exists but has nothing to play (not started, still processing, or no recording). */
  | { kind: 'not_playable'; status: Yanhe2SessionStatus };

/** Only a live or a finished session has media; the rest of the lifecycle has nothing to open. */
export function isYanhe2Playable(status: Yanhe2SessionStatus): boolean {
  return status === 'live' || status === 'playable';
}
