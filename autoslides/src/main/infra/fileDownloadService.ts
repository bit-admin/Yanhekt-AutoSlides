import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { httpClient, isHttpError } from './http';

function removeQuietly(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* noop */ }
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface FileDownloadServiceOptions {
  userAgent: string;
  timeoutMs?: number;
  maxRedirects?: number;
}

export class FileDownloadService {
  protected readonly updatesPath: string;
  protected activeDownload: { controller: AbortController; filename: string } | null = null;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly maxRedirects: number;

  constructor(options: FileDownloadServiceOptions) {
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRedirects = options.maxRedirects ?? 10;
    this.updatesPath = path.join(app.getPath('userData'), 'updates');
    this.ensureUpdatesFolder();
  }

  protected ensureUpdatesFolder(): void {
    if (!fs.existsSync(this.updatesPath)) {
      fs.mkdirSync(this.updatesPath, { recursive: true });
    }
  }

  getUpdatesPath(): string {
    return this.updatesPath;
  }

  async downloadFile(
    url: string,
    filename: string,
    progressCallback: (progress: DownloadProgress) => void
  ): Promise<string> {
    this.ensureUpdatesFolder();
    const filePath = path.join(this.updatesPath, filename);
    removeQuietly(filePath);

    const controller = new AbortController();
    this.activeDownload = { controller, filename };
    try {
      const response = await httpClient.get<Readable>(url, {
        responseType: 'stream',
        headers: { 'User-Agent': this.userAgent },
        // axios times socket inactivity, the same as the old request timeout.
        timeout: this.timeoutMs,
        maxRedirects: this.maxRedirects,
        signal: controller.signal,
        validateStatus: () => true,
      });
      if (response.status !== 200) {
        response.data.destroy();
        throw new Error(`HTTP error: ${response.status}`);
      }
      const totalSize = parseInt(String(response.headers['content-length'] ?? '0'), 10) || 0;
      let downloadedSize = 0;
      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        progressCallback({
          downloaded: downloadedSize,
          total: totalSize,
          percent: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
        });
      });
      await pipeline(response.data, fs.createWriteStream(filePath));
      return filePath;
    } catch (error) {
      removeQuietly(filePath);
      if (isHttpError(error) && error.code === 'ECONNABORTED') throw new Error('Download timeout');
      if (isHttpError(error) && error.code === 'ERR_FR_TOO_MANY_REDIRECTS') throw new Error('Too many redirects');
      throw error;
    } finally {
      if (this.activeDownload?.controller === controller) this.activeDownload = null;
    }
  }

  cancelDownload(): boolean {
    if (this.activeDownload) {
      this.activeDownload.controller.abort();
      removeQuietly(path.join(this.updatesPath, this.activeDownload.filename));
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

  async installFile(filename: string, notFoundLabel = 'File'): Promise<string> {
    const filePath = path.join(this.updatesPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${notFoundLabel} not found: ${filename}`);
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
}
