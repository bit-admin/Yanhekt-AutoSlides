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

export type CliDownloadStream = 'screen' | 'camera';

/**
 * The rows the command line sees: the two streams and the mic stem. Yanhe 2.0
 * rows (transcripts) are not listed or changed, since the command line covers
 * Yanhekt only while Yanhe 2.0 is in beta; `clearDownloads` is the panel's
 * button and clears them like any finished row.
 */
export type CliQueueKind = CliDownloadStream | 'audio';

/** One row of the Download panel, as `autoslides downloads` lists it. */
export interface CliQueueItem extends CliDownloadUpdate {
  kind: CliQueueKind;
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

export interface CliControlMethods {
  /** Waits for the launch-time sign-in (and auto sign-in) to finish. */
  signInState: { params: Record<string, never>; result: { signedIn: boolean } };
  /** Add one stream of a resolved session to the Download panel, as its session-id row does. */
  queueDownload: {
    params: { lecture: Pick<SessionDownloadInfo, 'session' | 'course'>; stream: CliDownloadStream };
    result: CliDownloadUpdate & { added: boolean };
  };
  /** The Download panel's Yanhekt rows, in order. */
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
}

export const isFinalDownloadState = (state: CliDownloadState): boolean =>
  state === 'completed' || state === 'error' || state === 'removed';
