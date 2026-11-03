// What updateIpc needs from a platform's in-place updater: Windows
// (windowsAutoUpdater.ts, electron-updater) and macOS (macSparkleUpdater.ts,
// Sparkle). Both download a release the app already chose, verify it against
// the project's ed25519 key, install when the app quits, and can quit and
// relaunch on request.
import type { UpdateSource } from './updateFeed';

export class UpdateCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'UpdateCancelledError';
  }
}

export interface InPlaceUpdateEvents {
  onProgress: (progress: { downloaded: number; total: number; percent: number }) => void;
}

export interface InPlaceUpdater {
  isDownloading(): boolean;
  isReady(version: string): boolean;
  /** Resolves once `version` is downloaded, verified and waiting to install. */
  download(version: string, source: UpdateSource, events: InPlaceUpdateEvents): Promise<void>;
  /** True if a running download was cancelled. */
  cancel(): boolean;
  /** Quits, installs and relaunches. False if nothing is ready. */
  restartToInstall(): boolean;
}
