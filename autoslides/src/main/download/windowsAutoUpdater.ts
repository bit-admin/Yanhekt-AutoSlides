// In-place updates for the Windows NSIS build, through electron-updater.
//
// The app still decides what to offer: updateIpc reads the latest GitHub
// release (direct, then the proxy) and shows the dialog. When that release
// carries `latest.yml` and a signed installer, the Windows download goes
// through here instead of the plain file download:
//
// - The feed is that release's download folder, on GitHub or through the
//   proxy, so the user's choice of source still holds. electron-updater reads
//   `latest.yml` there, downloads only the changed blocks when the old
//   release has a .blockmap, and falls back to the full installer.
// - The project's ed25519 signature is checked through electron-updater's
//   code-signature hook. The hook runs only when the updater config names a
//   publisher, so the config written below names one. A failed check deletes
//   the download; nothing unverified is ever installable.
// - The installer runs silently when the app quits, into the folder the app
//   runs from (`/D=`). "Restart to Update" quits and starts the new version.
//   It is started from the `quit` event, after the close guard for running
//   tasks has had its say, never before the quit.
import { app, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
// Type-only: the module itself is loaded on first use, so macOS and Linux
// builds never evaluate it.
import type { NsisUpdater, CancellationToken, ProgressInfo } from 'electron-updater';
import { createLogger } from '@main/infra/logger';
import { verifyUpdateFile } from './updateSignature';
import { compareVersions } from './updateVersion';
import { releaseDownloadBase, windowsInstallerName, type UpdateSource } from './windowsUpdateFeed';

const log = createLogger('WindowsUpdater');

// Must match electron-builder's `updaterCacheDirName` for productName
// AutoSlides: the installer leaves a copy of itself there, which is the "old
// file" a differential download patches.
const UPDATER_CACHE_DIR = 'autoslides-updater';

// A marker, not a real certificate subject: it makes electron-updater call
// `verifyUpdateCodeSignature`, which checks our own signature instead.
const UPDATER_CONFIG = [
  'provider: generic',
  'url: https://github.com/bit-admin/Yanhekt-AutoSlides/releases/latest/download',
  `updaterCacheDirName: ${UPDATER_CACHE_DIR}`,
  'publisherName:',
  '  - AutoSlides release signature',
  '',
].join('\n');

export class UpdateCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'UpdateCancelledError';
  }
}

export interface WindowsUpdateEvents {
  onProgress: (progress: { downloaded: number; total: number; percent: number }) => void;
}

export class WindowsAutoUpdater {
  private updater: NsisUpdater | null = null;
  private cancellation: CancellationToken | null = null;
  private pending: { version: string; sigUrl: string } | null = null;
  private readyVersion: string | null = null;
  private restartAfterInstall = false;
  private quitHookInstalled = false;
  private events: WindowsUpdateEvents | null = null;
  private busy = false;

  /** Packaged Windows builds only; dev and other platforms keep the manual flow. */
  static isSupported(): boolean {
    return process.platform === 'win32' && app.isPackaged;
  }

  private updaterModule: typeof import('electron-updater') | null = null;

  private async getUpdater(): Promise<NsisUpdater> {
    if (this.updater) return this.updater;
    this.updaterModule ??= await import('electron-updater');
    const { NsisUpdater } = this.updaterModule;
    const configPath = path.join(app.getPath('userData'), 'updater-config.yml');
    fs.writeFileSync(configPath, UPDATER_CONFIG);

    const updater = new NsisUpdater();
    updater.updateConfigPath = configPath;
    updater.logger = {
      info: (message?: unknown) => log.info(String(message)),
      warn: (message?: unknown) => log.warn(String(message)),
      error: (message?: unknown) => log.error(String(message)),
      debug: (message: string) => log.debug(message),
    };
    updater.autoDownload = false;
    // Installed from our own quit hook below, so a quit the close guard
    // cancels never starts the installer.
    updater.autoInstallOnAppQuit = false;
    updater.disableWebInstaller = true;
    updater.allowDowngrade = false;
    updater.installDirectory = path.dirname(process.execPath);
    updater.verifyUpdateCodeSignature = (_publishers, file) => this.verifyDownloaded(file);
    // An EventEmitter with no 'error' listener throws; failures already
    // reject the download() promise, so this only logs.
    updater.on('error', (error: Error) => log.warn(`electron-updater: ${error.message}`));
    updater.on('download-progress', (info: ProgressInfo) => this.events?.onProgress({
      downloaded: info.transferred,
      total: info.total,
      percent: Math.round(info.percent),
    }));
    this.updater = updater;
    return updater;
  }

  private async verifyDownloaded(file: string): Promise<string | null> {
    const pending = this.pending;
    if (!pending) return 'update-signature:missing';
    let sigText: string | null = null;
    try {
      const response = await net.fetch(pending.sigUrl);
      if (response.ok) sigText = await response.text();
      else if (response.status !== 404) return `could not download the signature (HTTP ${response.status})`;
    } catch (error) {
      return `could not download the signature (${error instanceof Error ? error.message : String(error)})`;
    }
    const result = await verifyUpdateFile(file, windowsInstallerName(pending.version), sigText);
    if (!result.ok) {
      log.warn(`Windows update ${pending.version} failed its signature check: ${result.reason}`);
      return `update-signature:${result.reason}`;
    }
    log.info(`Windows update ${pending.version} verified with key ${result.keyId}`);
    return null;
  }

  isDownloading(): boolean {
    return this.busy;
  }

  isReady(version: string): boolean {
    return this.readyVersion === version;
  }

  /**
   * Downloads and verifies `version` from the chosen source. Resolves once
   * the installer is ready to run; rejects with the reason otherwise.
   */
  async download(version: string, source: UpdateSource, events: WindowsUpdateEvents): Promise<void> {
    if (this.busy) throw new Error('An update download is already running');
    if (compareVersions(version, app.getVersion()) <= 0) throw new Error('update-signature:not-newer');
    this.busy = true;
    try {
      await this.runDownload(version, source, events);
    } finally {
      this.busy = false;
    }
  }

  private async runDownload(version: string, source: UpdateSource, events: WindowsUpdateEvents): Promise<void> {
    const updater = await this.getUpdater();
    const base = releaseDownloadBase(version, source);
    updater.setFeedURL({ provider: 'generic', url: base, useMultipleRangeRequest: false });
    this.pending = { version, sigUrl: base + windowsInstallerName(version) + '.sig' };
    this.events = events;
    this.readyVersion = null;
    const cancellation = new this.updaterModule!.CancellationToken();
    this.cancellation = cancellation;

    try {
      const check = await updater.checkForUpdates();
      const offered = check?.updateInfo.version;
      if (!check || !check.isUpdateAvailable || offered !== version) {
        throw new Error(`The release feed offers ${offered ?? 'nothing'}, not ${version}`);
      }
      await updater.downloadUpdate(cancellation);
      this.readyVersion = version;
      this.installQuitHook();
    } catch (error) {
      if (cancellation.cancelled) throw new UpdateCancelledError();
      throw error;
    } finally {
      this.cancellation = null;
      this.events = null;
    }
  }

  cancel(): boolean {
    if (!this.cancellation) return false;
    this.cancellation.cancel();
    return true;
  }

  /** Quits; the quit hook installs and starts the new version. */
  restartToInstall(): boolean {
    if (!this.readyVersion) return false;
    this.restartAfterInstall = true;
    app.quit();
    return true;
  }

  private installQuitHook(): void {
    if (this.quitHookInstalled) return;
    this.quitHookInstalled = true;
    // `quit` fires only once the quit can no longer be cancelled.
    app.once('quit', (_event, exitCode) => {
      if (!this.readyVersion || !this.updater || exitCode !== 0) return;
      log.info(`Installing ${this.readyVersion} on quit (restart: ${this.restartAfterInstall})`);
      this.updater.install(true, this.restartAfterInstall);
    });
  }
}

export const windowsAutoUpdater = new WindowsAutoUpdater();
