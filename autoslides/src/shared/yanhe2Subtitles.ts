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

/** The Yanhekt lecture the subtitles are filed under. */
export interface Yanhe2SubtitleTarget {
  /** Yanhekt course id. */
  courseId: string;
  /** The canonical Chinese course title. */
  courseTitle: string;
  /** Yanhekt session id. */
  sessionId: string;
  /** e.g. `第4周 星期一 第1大节`. */
  sessionTitle: string;
}

/** Why a download was turned down. */
export type Yanhe2SubtitleRefusal =
  /** No live Yanhe 2.0 session for that account. */
  | 'signed_out'
  /** Not signed in to Yanhekt, so its session list cannot be read. */
  | 'yanhekt_signed_out'
  /** Yanhekt has no course with that number, or no session at that time. */
  | 'no_match'
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
