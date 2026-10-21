/**
 * Downloading a Yanhe 2.0 recording's transcript as a subtitle file, named
 * for the same lecture on Yanhekt so it sits beside that lecture's downloaded
 * screen recording (`screen_<course>_<session>__c<id>s<id>.srt` next to the
 * `.mp4` of the same stem, which is how players pick a subtitle up by itself).
 */

export interface Yanhe2SubtitleQuery {
  /** aita course id. */
  courseId: string;
  /** aita session id (`sub_id`). */
  subId: string;
}

/** The Yanhekt lecture the subtitles are filed under, as far as Yanhekt has it. */
export interface Yanhe2SubtitleTarget {
  /** Yanhekt course id; '' when Yanhekt has no such course (the name then has no id block). */
  courseId: string;
  /** The canonical Chinese course title. */
  courseTitle: string;
  /** Yanhekt session id; '' when Yanhekt has no such session (the name then has no `s<id>`). */
  sessionId: string;
  /** e.g. `第4周 星期一 第1大节`; Yanhe 2.0's `2026-09-21 第8-10节` when Yanhekt has no such session. */
  sessionTitle: string;
}

/** Why a download was turned down. */
export type Yanhe2SubtitleRefusal =
  /** No live Yanhe 2.0 session for that account. */
  | 'signed_out'
  /** The lecture has no transcript. */
  | 'no_transcript'
  | 'network'
  | 'failed';

export type Yanhe2SubtitlePrepared =
  | { kind: 'ok'; target: Yanhe2SubtitleTarget }
  | { kind: Yanhe2SubtitleRefusal };

export type Yanhe2SubtitleResult =
  | { kind: 'ok'; /** The `.srt` that was written. */ filePath: string }
  | { kind: Yanhe2SubtitleRefusal };
