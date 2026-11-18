import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';
import { FileDownloadService, DownloadProgress } from '@main/infra/fileDownloadService';
import { linuxAppImageInstallPath } from '@main/infra/extractorAppImagePath';

export interface ExtractorAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ExtractorReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  body_html?: string;
  html_url: string;
  published_at: string;
  assets: ExtractorAsset[];
}

export type ExtractorDownloadProgress = DownloadProgress;

const EXTRACTOR_PATTERNS = {
  win32:  /^AutoSlides\.Extractor-[\d.]+-Windows-x64-Setup\.exe$/i,
  darwin: /^AutoSlides\.Extractor-[\d.]+-macOS-arm64\.dmg$/i,
  // The portable .tar.gz is left out: it needs unpacking and a folder of the user's choosing.
  linuxDeb:      /^AutoSlides\.Extractor-[\d.]+-Linux-x86_64\.deb$/i,
  linuxAppImage: /^AutoSlides\.Extractor-[\d.]+-Linux-x86_64\.AppImage$/i,
};

export type ExtractorInstallResult =
  /** The installer (.exe / .dmg / .deb) was handed to the system to open. */
  | { kind: 'opened'; filePath: string }
  /** The AppImage was copied into place and made executable. */
  | { kind: 'appImage'; filePath: string; installedPath: string };

const VERSION_PATTERN = /[\d]+\.[\d]+\.[\d]+/;

export const EXTRACTOR_REPO_URL = 'https://github.com/bit-admin/AutoSlides-Extractor';

export class ExtractorInstallerService extends FileDownloadService {
  // The assets main last offered for this platform, by name. A download is
  // accepted only for one of these, from its own address or its proxy copy:
  // the renderer chooses among them, it does not name what to fetch.
  private offered = new Map<string, ExtractorAsset>();

  constructor() {
    super({ userAgent: 'AutoSlides-ExtractorInstaller' });
  }

  /** Remember what was offered (the platform's assets of the latest release). */
  rememberOffered(assets: readonly ExtractorAsset[]): void {
    this.offered = new Map(assets.map((asset) => [asset.name, asset]));
  }

  getAssetsForPlatform(assets: ExtractorAsset[]): ExtractorAsset[] {
    const platform = process.platform;
    const result: ExtractorAsset[] = [];
    for (const asset of assets) {
      if (platform === 'win32' && EXTRACTOR_PATTERNS.win32.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'darwin' && EXTRACTOR_PATTERNS.darwin.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'linux' && ExtractorInstallerService.isLinuxAsset(asset.name)) {
        result.push(asset);
      }
    }
    // Linux: the .deb first (Debian/Ubuntu), then the AppImage (everything else).
    return result.sort((a, b) => Number(/\.AppImage$/i.test(a.name)) - Number(/\.AppImage$/i.test(b.name)));
  }

  private static isLinuxAsset(name: string): boolean {
    return EXTRACTOR_PATTERNS.linuxDeb.test(name) || EXTRACTOR_PATTERNS.linuxAppImage.test(name);
  }

  private static isInstallerName(name: string): boolean {
    return path.basename(name) === name && (
      EXTRACTOR_PATTERNS.win32.test(name) || EXTRACTOR_PATTERNS.darwin.test(name)
      || ExtractorInstallerService.isLinuxAsset(name)
    );
  }

  /**
   * Download one of the offered installers. `url` must be that asset's GitHub
   * address or its proxy copy. The size must match what the release lists.
   * That catches a truncated or swapped file in transit; it is not proof the
   * file is genuine (the Extractor's releases are not signed yet).
   */
  async downloadInstaller(
    url: string,
    filename: string,
    progressCallback: (progress: ExtractorDownloadProgress) => void
  ): Promise<string> {
    const asset = this.offered.get(filename);
    if (!asset || !ExtractorInstallerService.isInstallerName(filename)) {
      throw new Error(`Not an offered AutoSlides Extractor installer: ${filename}`);
    }
    const allowed = [asset.browser_download_url, FileDownloadService.getProxyUrl(asset.browser_download_url)];
    if (!allowed.includes(url)) throw new Error('This address does not belong to the offered installer');
    const filePath = await this.downloadFile(url, filename, progressCallback);
    if (asset.size > 0) {
      const { size } = await fs.promises.stat(filePath);
      if (size !== asset.size) {
        await fs.promises.rm(filePath, { force: true });
        throw new Error(`The download is ${size} bytes, the release lists ${asset.size}`);
      }
    }
    return filePath;
  }

  async installInstaller(filename: string): Promise<ExtractorInstallResult> {
    if (!ExtractorInstallerService.isInstallerName(filename)) {
      throw new Error(`Not an AutoSlides Extractor installer: ${filename}`);
    }
    if (EXTRACTOR_PATTERNS.linuxAppImage.test(filename)) {
      return this.installAppImage(filename);
    }
    // .deb: the desktop's software installer opens it; the dialog also shows
    // the apt command for desktops without one.
    const filePath = await this.installFile(filename, 'Installer');
    return { kind: 'opened', filePath };
  }

  /**
   * Copies the AppImage to `linuxAppImageInstallPath()` and marks it
   * executable. The copy goes to a temp name first and is renamed over the
   * old one, which is safe even while the old AppImage is running.
   */
  private async installAppImage(filename: string): Promise<ExtractorInstallResult> {
    const filePath = path.join(this.updatesPath, filename);
    if (!fs.existsSync(filePath)) throw new Error(`Installer not found: ${filename}`);
    const installedPath = linuxAppImageInstallPath();
    const tempPath = `${installedPath}.download`;
    await fs.promises.mkdir(path.dirname(installedPath), { recursive: true });
    try {
      await fs.promises.copyFile(filePath, tempPath);
      await fs.promises.chmod(tempPath, 0o755);
      await fs.promises.rename(tempPath, installedPath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true });
      throw error;
    }
    return { kind: 'appImage', filePath, installedPath };
  }

  /** Shows the installed AppImage in the file manager. */
  revealInstalledAppImage(): void {
    shell.showItemInFolder(linuxAppImageInstallPath());
  }

  static getRepoUrl(): string {
    return EXTRACTOR_REPO_URL;
  }

  static parseVersionFromFilename(filename: string): string | null {
    const match = filename.match(VERSION_PATTERN);
    return match ? match[0] : null;
  }
}

export const extractorInstallerService = new ExtractorInstallerService();
