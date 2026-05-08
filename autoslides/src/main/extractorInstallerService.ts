import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

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

export interface ExtractorDownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

const EXTRACTOR_PATTERNS = {
  win32:  /^AutoSlides\.Extractor-[\d.]+-Windows-x64-Setup\.exe$/i,
  darwin: /^AutoSlides\.Extractor-[\d.]+-macOS-arm64\.dmg$/i,
};

const VERSION_PATTERN = /[\d]+\.[\d]+\.[\d]+/;

export const EXTRACTOR_REPO_URL = 'https://github.com/bit-admin/AutoSlides-Extractor';

export class ExtractorInstallerService {
  private readonly updatesPath: string;
  private activeDownload: { request: http.ClientRequest; filename: string } | null = null;

  constructor() {
    // Reuse the same updates folder as the app updater
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

  getAssetsForPlatform(assets: ExtractorAsset[]): ExtractorAsset[] {
    const platform = process.platform;
    const result: ExtractorAsset[] = [];
    for (const asset of assets) {
      if (platform === 'win32' && EXTRACTOR_PATTERNS.win32.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'darwin' && EXTRACTOR_PATTERNS.darwin.test(asset.name)) {
        result.push(asset);
      }
    }
    return result;
  }

  async downloadInstaller(
    url: string,
    filename: string,
    progressCallback: (progress: ExtractorDownloadProgress) => void
  ): Promise<string> {
    this.ensureUpdatesFolder();
    const filePath = path.join(this.updatesPath, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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
          { headers: { 'User-Agent': 'AutoSlides-ExtractorInstaller' }, timeout: 30000 },
          (response) => {
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
                percent: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
              });
            });
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              this.activeDownload = null;
              resolve(filePath);
            });
            fileStream.on('error', (err) => {
              try { fs.unlinkSync(filePath); } catch { /* noop */ }
              this.activeDownload = null;
              reject(err);
            });
          }
        );
        request.on('error', (err) => {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* noop */ }
          this.activeDownload = null;
          reject(err);
        });
        request.on('timeout', () => {
          request.destroy();
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* noop */ }
          this.activeDownload = null;
          reject(new Error('Download timeout'));
        });
        this.activeDownload = { request, filename };
      };
      makeRequest(url);
    });
  }

  cancelDownload(): boolean {
    if (this.activeDownload) {
      this.activeDownload.request.destroy();
      const partialFile = path.join(this.updatesPath, this.activeDownload.filename);
      try { if (fs.existsSync(partialFile)) fs.unlinkSync(partialFile); } catch { /* noop */ }
      this.activeDownload = null;
      return true;
    }
    return false;
  }

  isDownloading(): boolean {
    return this.activeDownload !== null;
  }

  async openUpdatesFolder(): Promise<void> {
    this.ensureUpdatesFolder();
    await shell.openPath(this.updatesPath);
  }

  async installInstaller(filename: string): Promise<string> {
    const filePath = path.join(this.updatesPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Installer not found: ${filename}`);
    }
    await shell.openPath(filePath);
    return filePath;
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  static getProxyUrl(githubUrl: string): string {
    return `https://gh-proxy.org/${githubUrl}`;
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
