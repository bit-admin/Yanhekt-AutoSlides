/**
 * Saving a Yanhe 2.0 recording's server slides into the output folder, as if
 * they had been extracted from the same lecture on Yanhekt.
 *
 * A Yanhe 2.0 session has ids of its own. The saved folder, its
 * `metadata.json` and the task row all carry the Yanhekt course and session
 * instead, found through the course number the two sites share and the
 * session's start time. What Yanhekt does not have is left out (Yanhe 2.0's
 * titles stand in) and the slides are saved anyway.
 */

export interface Yanhe2SlideSaveQuery {
  /** aita course id. */
  courseId: string;
  /** aita session id (`sub_id`). */
  subId: string;
}

/** The Yanhekt lecture a Yanhe 2.0 session is, and where its slides go. */
export interface Yanhe2SlideSaveTarget {
  /** Yanhekt course id; '' when Yanhekt has no such course. */
  courseId: string;
  /** The canonical Chinese course title. */
  courseTitle: string;
  /** Yanhekt session id; '' when Yanhekt has no such session. */
  sessionId: string;
  /** e.g. `第4周 星期一 第1大节`. */
  sessionTitle: string;
  /** The `slides_*` folder, written the way extraction writes it: `<output directory>/<folder name>`. */
  folderPath: string;
}

/** Why a save was turned down. */
export type Yanhe2SlideSaveRefusal =
  /** No live Yanhe 2.0 session for that account. */
  | 'signed_out'
  /** The lecture has no server slides. */
  | 'no_slides'
  /** The folder already holds slides of this lecture. */
  | 'folder_in_use'
  /** This lecture is being saved right now. */
  | 'busy'
  | 'network'
  | 'failed';

export type Yanhe2SlideSavePrepared =
  | { kind: 'ok'; target: Yanhe2SlideSaveTarget }
  | { kind: Yanhe2SlideSaveRefusal };

export type Yanhe2SlideSaveResult =
  | { kind: 'ok'; target: Yanhe2SlideSaveTarget; /** `Slide_*.png`, in slide order. */ files: string[] }
  | { kind: Yanhe2SlideSaveRefusal };

export interface Yanhe2SlideSaveProgress {
  subId: string;
  done: number;
  total: number;
}
