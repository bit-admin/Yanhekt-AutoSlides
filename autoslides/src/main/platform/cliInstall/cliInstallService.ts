// Installs the command line wrappers (Settings → Add-ons → Command Line).
//
// Where they go:
//   macOS / Linux  ~/.local/bin — the XDG user bin folder; no sudo, and many
//                  shells already have it on PATH.
//   Windows        %LOCALAPPDATA%\Microsoft\WindowsApps — a per-user folder
//                  Windows itself keeps on PATH, so nothing has to edit the
//                  PATH variable. Falls back to %LOCALAPPDATA%\AutoSlides\bin
//                  (with a PATH hint in Settings) if it is missing.
//
// The wrappers hold the absolute path of this app's executable, so they go
// stale when the app is moved; `getStatus` reports that as `outdated` and
// installing again rewrites them.
import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CLI_WRAPPERS,
  type CliInstallResult,
  type CliInstallStatus,
  type CliUnsupportedReason,
  type CliWrapper,
  type CliWrapperStatus,
} from '@common/cliCommands';
import { createLogger } from '@main/infra/logger';
import {
  buildPathCommand,
  buildWrapperScript,
  classifyWrapper,
  isDirOnPath,
  wrapperFileName,
  type WrapperPlatform,
} from './wrapperScript';

const log = createLogger('CliInstall');

const PLATFORM: WrapperPlatform = process.platform === 'win32' ? 'win32' : 'posix';
const PATH_PROBE_TIMEOUT_MS = 4000;

export class CliInstallService {
  getBinDir(): string {
    if (PLATFORM === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const windowsApps = path.join(localAppData, 'Microsoft', 'WindowsApps');
      return fs.existsSync(windowsApps) ? windowsApps : path.join(localAppData, 'AutoSlides', 'bin');
    }
    return path.join(os.homedir(), '.local', 'bin');
  }

  /** The path a wrapper should start. An AppImage's own `exe` is a temp mount. */
  private getExecutablePath(): string {
    if (process.platform === 'linux' && process.env.APPIMAGE) return process.env.APPIMAGE;
    return app.getPath('exe');
  }

  private getUnsupportedReason(): CliUnsupportedReason | undefined {
    if (!app.isPackaged) return 'dev';
    if (process.platform === 'darwin' && app.getPath('exe').includes('/AppTranslocation/')) return 'translocated';
    return undefined;
  }

  private readWrapper(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private wrapperStatus(wrapper: CliWrapper, binDir: string, exePath: string): CliWrapperStatus {
    const filePath = path.join(binDir, wrapperFileName(wrapper, PLATFORM));
    const expected = buildWrapperScript(wrapper, exePath, PLATFORM);
    return {
      name: wrapper.name,
      command: wrapper.command,
      path: filePath,
      state: classifyWrapper(this.readWrapper(filePath), expected),
    };
  }

  /**
   * Whether the bin folder is on the PATH a terminal would have. On macOS and
   * Linux the app's own PATH says nothing (a Finder launch gets the system
   * default), so the user's login shell is asked instead; `null` when it does
   * not answer.
   */
  private async isBinDirOnPath(binDir: string): Promise<boolean | null> {
    if (PLATFORM === 'win32') return isDirOnPath(binDir, process.env.PATH || '', PLATFORM);

    const shell = process.env.SHELL;
    if (!shell || !/\/(?:zsh|bash|sh|dash|ksh|fish)$/.test(shell)) return null;
    // fish keeps PATH as a list, so it has to be joined to compare.
    const printPath = shell.endsWith('/fish')
      ? 'printf "__AS_PATH__%s__AS_END__" (string join : $PATH)'
      : 'printf "__AS_PATH__%s__AS_END__" "$PATH"';
    return new Promise((resolve) => {
      execFile(
        shell,
        ['-ilc', printPath],
        { timeout: PATH_PROBE_TIMEOUT_MS, windowsHide: true },
        (error, stdout) => {
          const match = /__AS_PATH__(.*?)__AS_END__/s.exec(String(stdout ?? ''));
          if (!match) {
            if (error) log.debug('PATH probe failed:', error.message);
            resolve(null);
            return;
          }
          resolve(isDirOnPath(binDir, match[1], PLATFORM));
        }
      );
    });
  }

  async getStatus(): Promise<CliInstallStatus> {
    const binDir = this.getBinDir();
    const exePath = this.getExecutablePath();
    const reason = this.getUnsupportedReason();
    return {
      supported: !reason,
      reason,
      binDir,
      onPath: await this.isBinDirOnPath(binDir),
      pathCommand: buildPathCommand(
        process.env.SHELL,
        process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
        binDir
      ),
      wrappers: CLI_WRAPPERS.map((wrapper) => this.wrapperStatus(wrapper, binDir, exePath)),
    };
  }

  /** Write every wrapper. A file that is not ours is left alone and reported. */
  async install(): Promise<CliInstallResult> {
    const reason = this.getUnsupportedReason();
    if (reason) return { success: false, error: reason, status: await this.getStatus() };

    const binDir = this.getBinDir();
    const exePath = this.getExecutablePath();
    try {
      fs.mkdirSync(binDir, { recursive: true });
      for (const wrapper of CLI_WRAPPERS) {
        const current = this.wrapperStatus(wrapper, binDir, exePath);
        if (current.state === 'foreign' || current.state === 'installed') continue;
        fs.writeFileSync(current.path, buildWrapperScript(wrapper, exePath, PLATFORM), { mode: 0o755 });
        // `mode` only applies when the file is created; an outdated wrapper keeps its old bits.
        if (PLATFORM === 'posix') fs.chmodSync(current.path, 0o755);
      }
    } catch (error) {
      log.error('Failed to install command line wrappers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: await this.getStatus(),
      };
    }
    return { success: true, status: await this.getStatus() };
  }

  /** Remove our wrappers — including ones another copy of the app wrote. */
  async uninstall(): Promise<CliInstallResult> {
    const binDir = this.getBinDir();
    const exePath = this.getExecutablePath();
    try {
      for (const wrapper of CLI_WRAPPERS) {
        const current = this.wrapperStatus(wrapper, binDir, exePath);
        if (current.state === 'installed' || current.state === 'outdated') fs.unlinkSync(current.path);
      }
    } catch (error) {
      log.error('Failed to remove command line wrappers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: await this.getStatus(),
      };
    }
    return { success: true, status: await this.getStatus() };
  }
}
