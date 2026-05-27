import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { FileDownloadService, DownloadProgress } from '@main/infra/fileDownloadService';

export interface UpdateAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: UpdateAsset[];
}

export type { DownloadProgress };

// Asset filename patterns for each platform
const ASSET_PATTERNS = {
  win32: /^AutoSlides-Setup-[\d.]+-Windows-x64\.exe$/i,
  darwin: /^AutoSlides-[\d.]+-macOS-arm64\.dmg$/i,
  linux_appimage: /^AutoSlides-[\d.]+-Linux-x86_64\.AppImage$/i,
  linux_deb: /^autoslides_[\d.]+_amd64\.deb$/i,
};

// Pattern to extract version from filename
const VERSION_PATTERN = /[\d]+\.[\d]+\.[\d]+/;

export class UpdateDownloadService extends FileDownloadService {
  constructor() {
    super({ userAgent: 'AutoSlides-Updater' });
  }

  getAssetsForPlatform(assets: UpdateAsset[]): UpdateAsset[] {
    const platform = process.platform;
    const result: UpdateAsset[] = [];

    for (const asset of assets) {
      if (platform === 'win32' && ASSET_PATTERNS.win32.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'darwin' && ASSET_PATTERNS.darwin.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'linux') {
        if (ASSET_PATTERNS.linux_appimage.test(asset.name) || ASSET_PATTERNS.linux_deb.test(asset.name)) {
          result.push(asset);
        }
      }
    }

    return result;
  }

  async downloadUpdate(
    url: string,
    filename: string,
    progressCallback: (progress: DownloadProgress) => void
  ): Promise<string> {
    return this.downloadFile(url, filename, progressCallback);
  }

  listDownloadedUpdates(): { filename: string; size: number; version: string | null }[] {
    this.ensureUpdatesFolder();
    const files = fs.readdirSync(this.updatesPath);
    const updates: { filename: string; size: number; version: string | null }[] = [];

    for (const file of files) {
      const isUpdateFile =
        ASSET_PATTERNS.win32.test(file) ||
        ASSET_PATTERNS.darwin.test(file) ||
        ASSET_PATTERNS.linux_appimage.test(file) ||
        ASSET_PATTERNS.linux_deb.test(file);

      if (isUpdateFile) {
        const filePath = path.join(this.updatesPath, file);
        const stats = fs.statSync(filePath);
        const versionMatch = file.match(VERSION_PATTERN);
        updates.push({
          filename: file,
          size: stats.size,
          version: versionMatch ? versionMatch[0] : null,
        });
      }
    }

    return updates;
  }

  findOldUpdates(currentVersion: string): string[] {
    const updates = this.listDownloadedUpdates();
    return updates
      .filter((u) => u.version && u.version !== currentVersion)
      .map((u) => u.filename);
  }

  async deleteUpdates(filenames: string[]): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const filename of filenames) {
      const filePath = path.join(this.updatesPath, filename);
      if (fs.existsSync(filePath)) {
        try {
          await shell.trashItem(filePath);
        } catch (err) {
          errors.push(`Failed to delete ${filename}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  async installUpdate(filename: string): Promise<string> {
    return this.installFile(filename, 'Update file');
  }
}

export const updateDownloadService = new UpdateDownloadService();
