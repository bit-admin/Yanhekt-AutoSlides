/**
 * Downloading a Yanhe 2.0 recording. The media comes from aita (along the
 * intranet route), but the files are named for the same lecture on Yanhekt,
 * exactly as a Yanhekt download of it would be
 * (`<stream>_<course>_<session>__c<id>s<id>.mp4`). So a lecture downloaded
 * from either site is one file, the subtitles' `.srt` sits beside the screen
 * recording, and auto extraction, Lectures and Slides treat it like any other.
 */
import type { Yanhe2SubtitleTarget } from './yanhe2Subtitles';

/** What can be downloaded: the two recordings and the classroom mic. The room camera is not offered. */
export type Yanhe2DownloadKind = 'camera' | 'screen' | 'audio';

export interface Yanhe2DownloadQuery {
  /** aita course id. */
  courseId: string;
  /** aita session id (`sub_id`). */
  subId: string;
}

/** The Yanhekt lecture a download is filed under (same shape as the subtitles'). */
export type Yanhe2DownloadTarget = Yanhe2SubtitleTarget;

/** Why a download was turned down. */
export type Yanhe2DownloadRefusal =
  /** No live Yanhe 2.0 session for that account. */
  | 'signed_out'
  /** Not signed in to Yanhekt, so its session list cannot be read. */
  | 'yanhekt_signed_out'
  /** Yanhekt has no course with that number, or no session at that time. */
  | 'no_match'
  /** Not a finished recording, or it has none of the streams asked for. */
  | 'no_recording'
  | 'network'
  | 'failed';

export type Yanhe2DownloadPrepared =
  | { kind: 'ok'; target: Yanhe2DownloadTarget; /** What this recording has. */ streams: Yanhe2DownloadKind[] }
  | { kind: Yanhe2DownloadRefusal };

export const YANHE2_DOWNLOAD_KINDS: readonly Yanhe2DownloadKind[] = ['camera', 'screen', 'audio'];
