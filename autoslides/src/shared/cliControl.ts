// Command-line control of the running app: what main asks the renderer.
//
// An `autoslides` command reaches main over a local socket (`@main/cli/control`).
// Most of the answer is main's own work (lookups, file names), but two things
// only the renderer knows: whether the app is signed in once its launch-time
// sign-in has settled, and the Download panel's queue. Main sends one
// `CliControlRequest` per question and the renderer answers with a
// `CliControlResponse` of the same id; every item the renderer queued for a
// command then reports its progress as `CliDownloadUpdate`s until it ends.
//
// Every payload here is plain JSON (it crosses IPC).
import type { SessionDownloadInfo } from './apiTypes';

export type CliDownloadStream = 'screen' | 'camera';

export interface CliControlMethods {
  /** Waits for the launch-time sign-in (and auto sign-in) to finish. */
  signInState: { params: Record<string, never>; result: { signedIn: boolean } };
  /** Add one stream of a resolved session to the Download panel, as its session-id row does. */
  queueDownload: {
    params: { lecture: Pick<SessionDownloadInfo, 'session' | 'course'>; stream: CliDownloadStream };
    result: CliDownloadUpdate & { added: boolean };
  };
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
