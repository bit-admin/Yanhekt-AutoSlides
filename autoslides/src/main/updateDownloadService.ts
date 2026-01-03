import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

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

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

// Asset filename patterns for each platform
const ASSET_PATTERNS = {
  win32: /^AutoSlides-Setup-[\d.]+-Windows-x64\.exe$/i,
  darwin: /^AutoSlides-[\d.]+-macOS-arm64\.dmg$/i,
  linux_appimage: /^AutoSlides-[\d.]+-Linux-x86_64\.AppImage$/i,
  linux_deb: /^autoslides_[\d.]+_amd64\.deb$/i,
};

// Pattern to extract version from filename
const VERSION_PATTERN = /[\d]+\.[\d]+\.[\d]+/;

export class UpdateDownloadService {
  private readonly updatesPath: string;
  private activeDownload: {
    request: http.ClientRequest;
    filename: string;
  } | null = null;

  constructor() {
    this.updatesPath = path.join(app.getPath('userData'), 'updates');
    this.ensureUpdatesFolder();
  }

  private ensureUpdatesFolder(): void {
    if (!fs.existsSync(this.updatesPath)) {
      fs.mkdirSync(this.updatesPath, { recursive: true });
    }
  }

  getUpdatesPath(): string {
    return this.updatesPath;
  }

  /**
   * Get the appropriate asset(s) for the current platform
   */
  getAssetsForPlatform(assets: UpdateAsset[]): UpdateAsset[] {
    const platform = process.platform;
    const result: UpdateAsset[] = [];

    for (const asset of assets) {
      if (platform === 'win32' && ASSET_PATTERNS.win32.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'darwin' && ASSET_PATTERNS.darwin.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'linux') {
        // For Linux, include both AppImage and deb
        if (ASSET_PATTERNS.linux_appimage.test(asset.name) || ASSET_PATTERNS.linux_deb.test(asset.name)) {
          result.push(asset);
        }
      }
    }

    return result;
  }

  /**
   * Download an update file with progress callback
   */
  async downloadUpdate(
    url: string,
    filename: string,
    progressCallback: (progress: DownloadProgress) => void
  ): Promise<string> {
    this.ensureUpdatesFolder();

    const filePath = path.join(this.updatesPath, filename);

    // Remove partial file if exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 10) {
          reject(new Error('Too many redirects'));
          return;
        }

        const parsedUrl = new URL(requestUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const request = protocol.get(
          requestUrl,
          {
            headers: {
              'User-Agent': 'AutoSlides-Updater',
            },
            timeout: 30000,
          },
          (response) => {
            // Handle redirects
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              request.destroy();
              makeRequest(response.headers.location, redirectCount + 1);
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`HTTP error: ${response.statusCode}`));
              return;
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;

            const fileStream = fs.createWriteStream(filePath);

            response.on('data', (chunk: Buffer) => {
              downloadedSize += chunk.length;
              progressCallback({
                downloaded: downloadedSize,
                total: totalSize,
                percent: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0,
              });
            });

            response.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close();
              this.activeDownload = null;
              resolve(filePath);
            });

            fileStream.on('error', (err) => {
              fs.unlinkSync(filePath);
              this.activeDownload = null;
              reject(err);
            });
          }
        );

        request.on('error', (err) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          this.activeDownload = null;
          reject(err);
        });

        request.on('timeout', () => {
          request.destroy();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          this.activeDownload = null;
          reject(new Error('Download timeout'));
        });

        this.activeDownload = { request, filename };
      };

      makeRequest(url);
    });
  }

  /**
   * Cancel the current download
   */
  cancelDownload(): boolean {
    if (this.activeDownload) {
      this.activeDownload.request.destroy();
      const partialFile = path.join(this.updatesPath, this.activeDownload.filename);
      if (fs.existsSync(partialFile)) {
        fs.unlinkSync(partialFile);
      }
      this.activeDownload = null;
      return true;
    }
    return false;
  }

  /**
   * Check if a download is in progress
   */
  isDownloading(): boolean {
    return this.activeDownload !== null;
  }

  /**
   * List all downloaded update files
   */
  listDownloadedUpdates(): { filename: string; size: number; version: string | null }[] {
    this.ensureUpdatesFolder();

    const files = fs.readdirSync(this.updatesPath);
    const updates: { filename: string; size: number; version: string | null }[] = [];

    for (const file of files) {
      // Check if file matches any of our asset patterns
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

  /**
   * Find old update files (not matching current version)
   */
  findOldUpdates(currentVersion: string): string[] {
    const updates = this.listDownloadedUpdates();
    return updates
      .filter((u) => u.version && u.version !== currentVersion)
      .map((u) => u.filename);
  }

  /**
   * Delete specified update files (move to system trash)
   */
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

  /**
   * Open the updates folder in file explorer
   */
  async openUpdatesFolder(): Promise<void> {
    this.ensureUpdatesFolder();
    await shell.openPath(this.updatesPath);
  }

  /**
   * Install update by opening the file
   * Returns the file path that was opened
   */
  async installUpdate(filename: string): Promise<string> {
    const filePath = path.join(this.updatesPath, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Update file not found: ${filename}`);
    }

    await shell.openPath(filePath);
    return filePath;
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Construct proxy URL from GitHub URL
   */
  static getProxyUrl(githubUrl: string): string {
    return `https://gh-proxy.org/${githubUrl}`;
  }
}

// Export singleton instance
export const updateDownloadService = new UpdateDownloadService();
