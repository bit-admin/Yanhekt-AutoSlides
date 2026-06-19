import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { dialog } from 'electron';
import { ConfigService } from '@main/platform/configService';
import { sharpService } from '@main/infra/sharpService';
import { createLogger } from '@main/infra/logger';
const log = createLogger('QtExtractor');

export interface QtExtractorStatus {
  ok: boolean;
  path: string;
  resolvedPath: string;          // Path actually checked (after auto-detect fallback)
  version?: string;
  error?: string;
}

export interface QtExtractorRunParams {
  ssimThreshold: number;
  enableDownsampling: boolean;
  downsampleWidth: number;
  downsampleHeight: number;
  chunkSize?: number;            // default 100 per instruction
}

export interface QtExtractorEventHandlers {
  onProgress?: (percent: number) => void;
  onSlidesExtracted?: (slidesDir: string, count: number) => void;
  onCompleted?: (result: { slideCount: number; slidesDir: string }) => void;
  onError?: (message: string, category?: string) => void;
  onCancelled?: () => void;
}

interface NDJsonEvent {
  v?: number;
  event: string;
  ts?: string;
  [key: string]: unknown;
}

const DEFAULT_BINARY_PATHS: Record<NodeJS.Platform, string[]> = {
  darwin: [
    '/Applications/AutoSlides Extractor.app/Contents/MacOS/AutoSlidesExtractor'
  ],
  win32: [
    'C:\\Program Files\\AutoSlides Extractor\\AutoSlidesExtractor.exe',
    'C:\\Program Files (x86)\\AutoSlides Extractor\\AutoSlidesExtractor.exe'
  ],
  linux: [],
  aix: [],
  android: [],
  freebsd: [],
  haiku: [],
  openbsd: [],
  sunos: [],
  cygwin: [],
  netbsd: []
};

export class QtExtractorService {
  private configService: ConfigService;
  private active: Map<string, ChildProcess> = new Map();

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  resolveBinaryPath(): string {
    const userPath = (this.configService.getQtExtractorConfig().binaryPath || '').trim();
    log.debug('Checking AutoSlides Extractor executable');
    log.debug('Platform:', process.platform);
    log.debug('Resources path:', process.resourcesPath);
    log.debug('Configured AutoSlides Extractor path:', userPath || '(auto-detect)');

    if (userPath) {
      log.debug('Checking configured AutoSlides Extractor path:', userPath);
      if (fs.existsSync(userPath)) {
        log.debug('AutoSlides Extractor path (configured):', userPath);
        return userPath;
      }
      log.debug('Configured AutoSlides Extractor path does not exist');
    }

    const candidates = DEFAULT_BINARY_PATHS[process.platform] ?? [];
    if (candidates.length === 0) {
      log.debug('No default AutoSlides Extractor paths for platform:', process.platform);
    }
    for (const candidate of candidates) {
      log.debug('Checking default AutoSlides Extractor path:', candidate);
      if (fs.existsSync(candidate)) {
        log.debug('AutoSlides Extractor path (default):', candidate);
        return candidate;
      }
      log.debug('Default AutoSlides Extractor path does not exist:', candidate);
    }
    log.debug('No AutoSlides Extractor executable found');
    return userPath; // may be '' or a missing path; caller treats as "not found"
  }

  async verifyBinary(explicitPath?: string): Promise<QtExtractorStatus> {
    const explicit = explicitPath?.trim();
    if (explicit) {
      log.debug('Checking explicit AutoSlides Extractor path:', explicit);
    }
    const resolved = explicit || this.resolveBinaryPath();
    const userConfigured = (this.configService.getQtExtractorConfig().binaryPath || '').trim();
    log.debug('Verifying AutoSlides Extractor executable:', resolved || '(none)');

    if (!resolved) {
      log.debug('AutoSlides Extractor verification failed: executable path is not configured or detected');
      return {
        ok: false,
        path: userConfigured,
        resolvedPath: '',
        error: 'AutoSlides Extractor binary not found. Install it or pick a path manually.'
      };
    }

    if (!fs.existsSync(resolved)) {
      log.debug('AutoSlides Extractor verification failed: path does not exist:', resolved);
      return {
        ok: false,
        path: userConfigured,
        resolvedPath: resolved,
        error: `Path does not exist: ${resolved}`
      };
    }

    return await new Promise<QtExtractorStatus>((resolve) => {
      let stdoutBuf = '';
      let stderrBuf = '';
      let settled = false;

      log.debug('Testing AutoSlides Extractor executable:', resolved);
      log.debug('AutoSlides Extractor verify command: --help --json');
      const child = spawn(resolved, ['--help', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdoutBuf += chunk; });
      child.stderr.on('data', (chunk: string) => { stderrBuf += chunk; });

      const finish = (status: QtExtractorStatus) => {
        if (settled) return;
        settled = true;
        try { child.kill(); } catch { /* noop */ }
        resolve(status);
      };

      const timeout = setTimeout(() => {
        log.debug('AutoSlides Extractor verification timed out:', resolved);
        finish({
          ok: false,
          path: userConfigured,
          resolvedPath: resolved,
          error: 'Verification timed out'
        });
      }, 10000);

      child.on('error', (err) => {
        clearTimeout(timeout);
        log.debug('AutoSlides Extractor verification spawn failed:', err.message);
        finish({
          ok: false,
          path: userConfigured,
          resolvedPath: resolved,
          error: `Failed to spawn: ${err.message}`
        });
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        // Parse first line of stdout as a JSON event; tolerate help text on stderr
        const firstLine = stdoutBuf.split(/\r?\n/).find(l => l.trim().length > 0) || '';
        let evt: NDJsonEvent | null = null;
        try {
          evt = JSON.parse(firstLine);
        } catch {
          evt = null;
        }
        if (evt && (evt.event === 'help' || evt.event === 'version')) {
          // Try to also probe --version for an explicit version
          const versionFromHelp = this.extractVersionFromHelpText(typeof evt.text === 'string' ? evt.text : '');
          if (versionFromHelp) {
            log.debug('AutoSlides Extractor path (executable works):', resolved);
            log.debug('AutoSlides Extractor version:', versionFromHelp);
            finish({ ok: true, path: userConfigured, resolvedPath: resolved, version: versionFromHelp });
            return;
          }
          this.queryVersion(resolved).then((version) => {
            log.debug('AutoSlides Extractor path (executable works):', resolved);
            if (version) {
              log.debug('AutoSlides Extractor version:', version);
            } else {
              log.debug('AutoSlides Extractor version: unknown');
            }
            finish({ ok: true, path: userConfigured, resolvedPath: resolved, version });
          });
          return;
        }
        log.debug('AutoSlides Extractor verification failed:', stderrBuf.trim() || stdoutBuf.trim().split('\n').slice(0, 3).join('\n') || `Unexpected exit code ${code}`);
        finish({
          ok: false,
          path: userConfigured,
          resolvedPath: resolved,
          error: stderrBuf.trim() || stdoutBuf.trim().split('\n').slice(0, 3).join('\n') || `Unexpected exit code ${code}`
        });
      });
    });
  }

  private extractVersionFromHelpText(text: string): string | undefined {
    if (!text) return undefined;
    // The --help text doesn't include version; rely on --version probe
    const match = text.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : undefined;
  }

  private async queryVersion(binaryPath: string): Promise<string | undefined> {
    return await new Promise<string | undefined>((resolve) => {
      let buf = '';
      log.debug('AutoSlides Extractor version command: --version --json');
      const child = spawn(binaryPath, ['--version', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { buf += chunk; });
      const t = setTimeout(() => {
        try { child.kill(); } catch { /* noop */ }
        resolve(undefined);
      }, 5000);
      child.on('error', () => { clearTimeout(t); resolve(undefined); });
      child.on('exit', () => {
        clearTimeout(t);
        const line = buf.split(/\r?\n/).find(l => l.trim().length > 0) || '';
        try {
          const evt = JSON.parse(line) as NDJsonEvent;
          if (evt.event === 'version' && typeof evt.appVersion === 'string') {
            resolve(evt.appVersion);
            return;
          }
        } catch { /* fall-through */ }
        const match = buf.match(/(\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : undefined);
      });
    });
  }

  async selectBinaryViaDialog(): Promise<string | null> {
    const filters: Electron.FileFilter[] =
      process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe'] }]
        : process.platform === 'darwin'
        ? [{ name: 'Application or Binary', extensions: ['app', ''] }]
        : [{ name: 'All Files', extensions: ['*'] }];

    const result = await dialog.showOpenDialog({
      title: 'Select AutoSlides Extractor binary',
      properties: ['openFile'],
      filters
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    let chosen = result.filePaths[0];
    // If user picked a .app bundle on macOS, descend into Contents/MacOS/AutoSlidesExtractor
    if (process.platform === 'darwin' && chosen.endsWith('.app')) {
      const inner = path.join(chosen, 'Contents', 'MacOS', 'AutoSlidesExtractor');
      if (fs.existsSync(inner)) chosen = inner;
    }
    return chosen;
  }

  isExtractionActive(extractionId: string): boolean {
    return this.active.has(extractionId);
  }

  cancelExtraction(extractionId: string): boolean {
    const child = this.active.get(extractionId);
    if (!child) return false;
    try {
      child.kill('SIGTERM');
    } catch (err) {
      log.error('[QtExtractor] Failed to send SIGTERM:', err);
    }
    return true;
  }

  cancelAll(): void {
    for (const child of this.active.values()) {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    }
    this.active.clear();
  }

  async runExtraction(
    extractionId: string,
    videoPath: string,
    outputDir: string,
    params: QtExtractorRunParams,
    handlers: QtExtractorEventHandlers
  ): Promise<{ slidesDir: string; slideCount: number }> {
    const binary = this.resolveBinaryPath();
    if (!binary) throw new Error('AutoSlides Extractor binary is not configured.');
    if (!fs.existsSync(binary)) throw new Error(`AutoSlides Extractor binary not found at ${binary}`);
    if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
    log.debug('Running AutoSlides Extractor executable:', binary);
    log.debug('AutoSlides Extractor input video:', videoPath);
    log.debug('AutoSlides Extractor output directory:', outputDir);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const args = [
      '--json',
      '--compatible',
      '--video', videoPath,
      '--output', outputDir,
      '--ssim-threshold', String(params.ssimThreshold),
      '--enable-downsampling', params.enableDownsampling ? 'true' : 'false',
      '--downsample-width', String(Math.round(params.downsampleWidth)),
      '--downsample-height', String(Math.round(params.downsampleHeight)),
      '--chunk-size', String(params.chunkSize ?? 100)
    ];

    return await new Promise<{ slidesDir: string; slideCount: number }>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.active.set(extractionId, child);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      const stdout = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
      const stderr = readline.createInterface({ input: child.stderr, crlfDelay: Infinity });

      let result: { slidesDir: string; slideCount: number } | null = null;
      let lastError: { category: string; message: string } | null = null;
      let cancelled = false;

      const handle = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: NDJsonEvent;
        try {
          evt = JSON.parse(trimmed) as NDJsonEvent;
        } catch {
          log.warn('[QtExtractor] Non-JSON line:', trimmed);
          return;
        }
        switch (evt.event) {
          case 'frame_progress': {
            const percent = typeof evt.percent === 'number' ? evt.percent : 0;
            handlers.onProgress?.(Math.max(0, Math.min(100, percent)));
            break;
          }
          case 'slides_extracted': {
            const slidesDir = typeof evt.slidesDir === 'string' ? evt.slidesDir : '';
            const count = typeof evt.count === 'number' ? evt.count : 0;
            if (slidesDir) handlers.onSlidesExtracted?.(slidesDir, count);
            break;
          }
          case 'done': {
            const slidesDir = typeof evt.slidesDir === 'string' ? evt.slidesDir : '';
            const slideCount = typeof evt.slideCount === 'number' ? evt.slideCount : 0;
            result = { slidesDir, slideCount };
            break;
          }
          case 'error': {
            lastError = {
              category: typeof evt.category === 'string' ? evt.category : 'unknown',
              message: typeof evt.message === 'string' ? evt.message : 'Unknown error'
            };
            break;
          }
          case 'cancelled': {
            cancelled = true;
            break;
          }
          default:
            break;
        }
      };

      stdout.on('line', handle);
      stderr.on('line', handle);

      child.on('error', (err) => {
        this.active.delete(extractionId);
        reject(err);
      });

      child.on('exit', (code) => {
        this.active.delete(extractionId);
        if (cancelled || code === 130 || code === 143) {
          handlers.onCancelled?.();
          reject(new Error('cancelled'));
          return;
        }
        if (result && code === 0) {
          handlers.onCompleted?.(result);
          resolve(result);
          return;
        }
        const msg = lastError ? `${lastError.category}: ${lastError.message}` : `AutoSlidesExtractor exited with code ${code}`;
        handlers.onError?.(msg, lastError?.category);
        reject(new Error(msg));
      });
    });
  }

  /**
   * Apply PNG-8 palette quantization in place over the Qt extractor's PNG output
   * when the user has enabled "Enable PNG Color Reduction". Files are already
   * named `Slide_*.png` under `--compatible` mode, so no rename is required.
   */
  async applyPngColorReduction(
    slidesDir: string,
    options: { onProgress?: (current: number, total: number) => void } = {}
  ): Promise<{ processed: number }> {
    if (!fs.existsSync(slidesDir)) {
      throw new Error(`Slides directory not found: ${slidesDir}`);
    }
    const entries = fs
      .readdirSync(slidesDir)
      .filter(f => f.startsWith('Slide_') && f.toLowerCase().endsWith('.png'))
      .sort();

    let processed = 0;
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const file = entries[i];
      const filePath = path.join(slidesDir, file);
      try {
        const buffer = fs.readFileSync(filePath);
        const reduced = await sharpService.reducePngColors(new Uint8Array(buffer));
        if (reduced) {
          fs.writeFileSync(filePath, reduced);
          processed++;
        }
      } catch (err) {
        log.error(`[QtExtractor] Failed to reduce colors for ${file}:`, err);
      }
      options.onProgress?.(i + 1, total);
    }

    return { processed };
  }
}
