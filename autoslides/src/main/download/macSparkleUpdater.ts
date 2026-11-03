// In-place updates for the macOS build, through Sparkle 2.
//
// Same shape as the Windows updater: updateIpc reads the latest GitHub release
// (direct, then the proxy) and shows the dialog. When that release carries
// `appcast.xml`, the download goes through here instead of the DMG download:
//
// - The feed is that release's `appcast.xml`, on GitHub or through the proxy.
//   It names its files relative to itself, so the user's source choice holds
//   for the archive too. Sparkle downloads a `.delta` against the installed
//   version when the release has one, else the full DMG.
// - Sparkle checks the archive's EdDSA signature against SUPublicEDKey, the
//   project's update signing key (forge.config.ts). It requires the new app's
//   code signature to be valid, not to match, so ad-hoc builds update.
// - Once extracted, Sparkle's installer waits and installs when the app
//   quits. "Restart to Update" asks it to install now and relaunch.
// - Sparkle's own windows never show: the bridge
//   (native/sparkle-bridge/sparkle_bridge.mm) is a user driver that reports
//   each step here.
//
// Sparkle.framework lives in Contents/Frameworks and the bridge in
// Contents/Resources (scripts/sparkle.mjs, forge.config.ts). Dev runs and
// builds without them keep the DMG download.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@main/infra/logger';
import { compareVersions } from './updateVersion';
import { MAC_APPCAST_NAME, releaseDownloadBase, sparkleErrorMessage, type UpdateSource } from './updateFeed';
import { UpdateCancelledError, type InPlaceUpdateEvents, type InPlaceUpdater } from './inPlaceUpdater';

const log = createLogger('MacUpdater');

interface SparkleBridge {
  start(onEvent: (type: string, json: string) => void): void;
  check(feedUrl: string, version: string, userAgent: string): void;
  cancel(): boolean;
  install(): boolean;
}

interface Session {
  version: string;
  events: InPlaceUpdateEvents;
  cancelled: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
}

function bridgePath(): string {
  return path.join(process.resourcesPath, 'sparkle_bridge.node');
}

function frameworkPath(): string {
  return path.join(process.resourcesPath, '..', 'Frameworks', 'Sparkle.framework');
}

export class MacSparkleUpdater implements InPlaceUpdater {
  private bridge: SparkleBridge | null = null;
  private session: Session | null = null;
  private readyVersion: string | null = null;

  /** Packaged macOS builds that ship Sparkle and the bridge. */
  static isSupported(): boolean {
    return process.platform === 'darwin' && app.isPackaged
      && fs.existsSync(bridgePath()) && fs.existsSync(frameworkPath());
  }

  private getBridge(): SparkleBridge {
    if (this.bridge) return this.bridge;
    const loaded = { exports: {} as SparkleBridge };
    process.dlopen(loaded, bridgePath());
    loaded.exports.start((type, json) => this.onEvent(type, json));
    this.bridge = loaded.exports;
    return this.bridge;
  }

  isDownloading(): boolean {
    return this.session !== null;
  }

  isReady(version: string): boolean {
    return this.readyVersion === version;
  }

  download(version: string, source: UpdateSource, events: InPlaceUpdateEvents): Promise<void> {
    if (this.session) return Promise.reject(new Error('An update download is already running'));
    if (compareVersions(version, app.getVersion()) <= 0) return Promise.reject(new Error('update-signature:not-newer'));
    if (this.readyVersion === version) return Promise.resolve();
    const feedUrl = releaseDownloadBase(version, source) + MAC_APPCAST_NAME;
    return new Promise<void>((resolve, reject) => {
      this.session = { version, events, cancelled: false, resolve, reject };
      try {
        log.info(`Checking ${feedUrl} for ${version}`);
        this.getBridge().check(feedUrl, version, `AutoSlides/${app.getVersion()} Sparkle`);
      } catch (error) {
        this.session = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private onEvent(type: string, json: string): void {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(json) as Record<string, unknown>; } catch { /* keep {} */ }
    const session = this.session;
    switch (type) {
      case 'progress': {
        const downloaded = Number(payload.received) || 0;
        const total = Number(payload.expected) || 0;
        session?.events.onProgress({
          downloaded,
          total,
          percent: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0,
        });
        return;
      }
      case 'found':
        log.info(`Sparkle found ${String(payload.version)} (stage ${String(payload.stage)})`);
        return;
      case 'ready':
        if (!session) return;
        log.info(`Update ${session.version} is ready; it installs on quit`);
        this.readyVersion = session.version;
        this.finish((s) => s.resolve());
        return;
      case 'error': {
        const message = sparkleErrorMessage(payload as { domain?: string; code?: number; message?: string });
        log.warn(`Sparkle: ${String(payload.domain)} ${String(payload.code)} ${String(payload.message)} ${String(payload.reason ?? '')}`);
        this.finish((s) => s.reject(s.cancelled ? new UpdateCancelledError() : new Error(message)));
        return;
      }
      case 'dismissed':
        // The end of every Sparkle session: after a cancel, an error, or an
        // install that was aborted.
        if (!payload.hadInstall && this.readyVersion && !session) {
          log.info('Sparkle dropped the waiting update');
          this.readyVersion = null;
        }
        this.finish((s) => s.reject(s.cancelled ? new UpdateCancelledError() : new Error('The update was stopped')));
        return;
      case 'installing':
        log.info(`Sparkle is installing (app terminated: ${String(payload.terminated)})`);
        return;
      default:
        log.debug(`Sparkle event ${type}`);
    }
  }

  private finish(settle: (session: Session) => void): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    settle(session);
  }

  cancel(): boolean {
    if (!this.session || !this.bridge) return false;
    this.session.cancelled = true;
    return this.bridge.cancel();
  }

  /** Sparkle quits the app, installs and relaunches. */
  restartToInstall(): boolean {
    if (!this.readyVersion || !this.bridge) return false;
    log.info(`Installing ${this.readyVersion} and relaunching`);
    return this.bridge.install();
  }
}

export const macSparkleUpdater = new MacSparkleUpdater();
