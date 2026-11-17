import { app, shell } from 'electron';
import * as fs from 'fs';
import * as net from 'net';
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

/**
 * True for a name that can only mean a file directly in the updates folder:
 * no separators of either platform, not `.`/`..`, not absolute.
 */
export function isBareFileName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !/[\\/]/.test(name) &&
    !name.includes('\0') &&
    path.basename(name) === name
  );
}

function isPrivateAddress(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare === 'localhost' || bare.endsWith('.localhost')) return true;
  const kind = net.isIP(bare);
  if (kind === 4) {
    const [a, b] = bare.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (kind === 6) {
    const lower = bare.toLowerCase();
    return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:');
  }
  return false;
}

/**
 * Where an installer may come from, checked on the first address and on every
 * redirect: https only, and never this machine or a private network. This is
 * about where a request may go, not about whether the file is genuine.
 */
export function checkDownloadHop(url: URL): void {
  if (url.protocol !== 'https:' || isPrivateAddress(url.hostname)) {
    throw new Error(`Refusing to download from this address: ${url.protocol}//${url.hostname}`);
  }
}

let partialCounter = 0;

export class FileDownloadService {
  protected readonly updatesPath: string;
  // One download at a time; each has its own partial file, so cancelling or
  // failing an old one can only ever remove that file.
  protected activeDownload: { controller: AbortController; filename: string; partialPath: string } | null = null;
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

  /**
   * Download `url` to `<updates>/<filename>`. The file is written under a
   * partial name and renamed into place once complete, so the name only ever
   * holds a whole download. Refuses a second download while one is running.
   */
  async downloadFile(
    url: string,
    filename: string,
    progressCallback: (progress: DownloadProgress) => void
  ): Promise<string> {
    if (!isBareFileName(filename)) throw new Error(`Not a plain file name: ${filename}`);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Refusing to download from this address: not a URL');
    }
    checkDownloadHop(parsed);
    if (this.activeDownload) throw new Error('A download is already running');

    this.ensureUpdatesFolder();
    const filePath = path.join(this.updatesPath, filename);
    partialCounter += 1;
    const partialPath = path.join(this.updatesPath, `.${filename}.${process.pid}-${partialCounter}.part`);

    const controller = new AbortController();
    const job = { controller, filename, partialPath };
    this.activeDownload = job;
    try {
      const response = await httpClient.get<Readable>(url, {
        responseType: 'stream',
        headers: { 'User-Agent': this.userAgent },
        // axios times socket inactivity, the same as the old request timeout.
        timeout: this.timeoutMs,
        maxRedirects: this.maxRedirects,
        beforeRedirect: (options: Record<string, unknown>) => {
          const href = typeof options.href === 'string'
            ? options.href
            : `${String(options.protocol)}//${String(options.hostname)}`;
          checkDownloadHop(new URL(href));
        },
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
      await pipeline(response.data, fs.createWriteStream(partialPath), { signal: controller.signal });
      if (controller.signal.aborted) throw new Error('Download cancelled');
      await fs.promises.rename(partialPath, filePath);
      return filePath;
    } catch (error) {
      removeQuietly(partialPath);
      if (controller.signal.aborted) throw new Error('Download cancelled');
      if (isHttpError(error) && error.code === 'ECONNABORTED') throw new Error('Download timeout');
      if (isHttpError(error) && error.code === 'ERR_FR_TOO_MANY_REDIRECTS') throw new Error('Too many redirects');
      throw error;
    } finally {
      if (this.activeDownload === job) this.activeDownload = null;
    }
  }

  cancelDownload(): boolean {
    const job = this.activeDownload;
    if (!job) return false;
    job.controller.abort();
    removeQuietly(job.partialPath);
    this.activeDownload = null;
    return true;
  }

  isDownloading(): boolean {
    return this.activeDownload !== null;
  }

  async openUpdatesFolder(): Promise<void> {
    this.ensureUpdatesFolder();
    const problem = await shell.openPath(this.updatesPath);
    if (problem) throw new Error(problem);
  }

  /**
   * Hand a downloaded file to the system to open. Resolves once the system
   * accepted it (which is not the same as installed); a refusal is an error.
   */
  async installFile(filename: string, notFoundLabel = 'File'): Promise<string> {
    if (!isBareFileName(filename)) throw new Error(`Not a plain file name: ${filename}`);
    const filePath = path.join(this.updatesPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${notFoundLabel} not found: ${filename}`);
    }
    const problem = await shell.openPath(filePath);
    if (problem) throw new Error(problem);
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
