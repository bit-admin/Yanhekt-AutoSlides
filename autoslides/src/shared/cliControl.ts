// Command-line control of the running app: what main asks the renderer.
//
// An `autoslides` command reaches main over a local socket (`@main/cli/control`).
// Most of the answer is main's own work (lookups, file names), but two things
// only the renderer knows: whether the app is signed in once its launch-time
// sign-in has settled, and the Download panel's queue. Main sends one
// `CliControlRequest` per question and the renderer answers with a
// `CliControlResponse` of the same id; every item a command queued or asked to
// follow then reports its progress as `CliDownloadUpdate`s until it ends.
//
// Every payload here is plain JSON (it crosses IPC).
import type { SessionDownloadInfo } from './apiTypes';
import type { OutputFolderWork } from './outputFolderWork';
import type { Yanhe2DownloadKind, Yanhe2DownloadTarget } from './yanhe2Download';

export type CliDownloadStream = 'screen' | 'camera';

/**
 * The rows the command line sees: the two streams and the mic stem, from
 * Yanhekt or Yanhe 2.0. Transcripts and the Developer page's media are not
 * listed, followed or changed; `clearDownloads` is the panel's button and
 * clears them like any finished row.
 */
export type CliQueueKind = CliDownloadStream | 'audio';

/** One row of the Download panel, as `autoslides downloads` lists it. */
export interface CliQueueItem extends CliDownloadUpdate {
  kind: CliQueueKind;
  /** Where the media comes from. `sessionId` / `courseId` stay Yanhekt's either way. */
  source: 'yanhekt' | 'yanhe2';
  /** The Yanhe 2.0 ids of a `yanhe2` row; null on a Yanhekt one. */
  yanhe2: { courseId: string; sessionId: string } | null;
  /** The name it is queued under; the file name is built from it (`@common/downloadNaming`). */
  name: string;
  sessionId: string;
  courseId: string | null;
  courseTitle: string;
  sessionTitle: string;
  addedAt: number;
  completedAt: number | null;
  /** Slide extraction after the download, when auto-extraction took it. */
  extraction: { state: string; progress: number; error?: string } | null;
}

/** What `changeDownloads` did to one item. `changed: false` leaves `state` as it was. */
export interface CliQueueChange {
  itemId: string;
  changed: boolean;
  state: CliDownloadState;
}

/** One stream of a Yanhe 2.0 recording, after main prepared it. */
export interface CliYanhe2Queue {
  account: string;
  /** aita course id. */
  courseId: string;
  /** aita session id. */
  subId: string;
  kind: Yanhe2DownloadKind;
  target: Yanhe2DownloadTarget;
  courseNumber: string;
}

export interface CliControlMethods {
  /** Waits for the launch-time sign-in (and auto sign-in) to finish. */
  signInState: { params: Record<string, never>; result: { signedIn: boolean } };
  /** Add one stream of a resolved session to the Download panel, as its session-id row does. */
  queueDownload: {
    params: { lecture: Pick<SessionDownloadInfo, 'session' | 'course'>; stream: CliDownloadStream };
    /**
     * `blocked`: the panel already holds this lecture's stream as a row the
     * command line does not see, so nothing was added and nothing is followed.
     */
    result: (CliDownloadUpdate & { added: boolean }) | { blocked: true };
  };
  /** Waits for the launch-time Yanhe 2.0 check and renewal; main then reads the session itself. */
  yanhe2SignInState: { params: Record<string, never>; result: { settled: true } };
  /** Add one stream of a prepared Yanhe 2.0 recording to the Download panel, as its own buttons do. */
  queueYanhe2Download: {
    params: CliYanhe2Queue;
    /** `blocked`: as for `queueDownload`. */
    result: (CliDownloadUpdate & { added: boolean }) | { blocked: true };
  };
  /** The Download panel's recording rows, in order. */
  listDownloads: { params: Record<string, never>; result: { items: CliQueueItem[] } };
  /** Report these items' progress until they end, as for a queued one. Answers their state now. */
  followDownloads: { params: { itemIds: string[] }; result: CliDownloadUpdate[] };
  /**
   * The panel's per-row buttons. `cancel` stops an unfinished item (a waiting
   * one leaves the list); `retry` queues a failed one again.
   */
  changeDownloads: { params: { action: 'cancel' | 'retry'; itemIds: string[] }; result: CliQueueChange[] };
  /** The panel's Clear Completed: drop every finished and failed row. Answers how many went. */
  clearDownloads: { params: Record<string, never>; result: { removed: number } };
  /**
   * Work still writing into the output folder (`@common/outputFolderWork`).
   * Not a command of its own: main asks before any output folder change, from
   * the Settings page or `autoslides config output_dir`.
   */
  outputFolderWork: { params: Record<string, never>; result: OutputFolderWork };
}

export type CliControlMethod = keyof CliControlMethods;

export interface CliControlRequest<M extends CliControlMethod = CliControlMethod> {
  id: number;
  method: M;
  params: CliControlMethods[M]['params'];
}

export type CliControlResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; message: string };

/** A queue item's state. `removed`: taken off the list in the app before it finished. */
export type CliDownloadState = 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'removed';

export interface CliDownloadUpdate {
  itemId: string;
  state: CliDownloadState;
  /** 0–100, as the panel shows it (the merge is the last tenth). */
  progress: number;
  error?: string;
  /** The file a completed download wrote, as main reported it; absent until then. */
  filePath?: string;
}

export const isFinalDownloadState = (state: CliDownloadState): boolean =>
  state === 'completed' || state === 'error' || state === 'removed';
