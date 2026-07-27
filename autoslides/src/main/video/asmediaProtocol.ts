import { protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fromAsmediaUrl } from '@common/asmediaUrl';
import { parseHttpRange } from '@common/httpRange';
import { expandTilde, hasTraversalSegment, isPathInsideRoot } from '@main/infra/pathUtils';
import type { ConfigService } from '@main/platform/configService';
import { createLogger } from '@main/infra/logger';

const log = createLogger('AsmediaProtocol');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv']);

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
};

/**
 * Must run before app.ready so the renderer can treat asmedia as a standard
 * streamable secure scheme. Seeking requires real 206 + Accept-Ranges —
 * net.fetch(file://) is unreliable for Range on custom schemes, so we serve
 * bytes ourselves.
 */
export function registerAsmediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'asmedia',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        corsEnabled: true,
      },
    },
  ]);
}

function isBenignStreamAbort(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === 'AbortError') return true;
  if (e.code === 'ABORT_ERR') return true;
  if (e.code === 'ERR_STREAM_PREMATURE_CLOSE') return true;
  if (e.code === 'ERR_STREAM_DESTROYED') return true;
  // Node destroy() after cancel sometimes surfaces as this message only.
  if (typeof e.message === 'string' && /aborted|premature close/i.test(e.message)) {
    return true;
  }
  return false;
}

/**
 * Open a file (or byte range) as a Web ReadableStream.
 * Chromium aborts the previous range when seeking — that is normal; we destroy
 * the Node stream quietly instead of logging AbortError noise.
 */
function openFileWebStream(
  filePath: string,
  range: { start: number; end: number } | null,
  signal: AbortSignal | null | undefined,
): ReadableStream<Uint8Array> {
  const nodeStream =
    range != null
      ? fs.createReadStream(filePath, { start: range.start, end: range.end })
      : fs.createReadStream(filePath);

  const destroyQuietly = () => {
    if (!nodeStream.destroyed) {
      nodeStream.destroy();
    }
  };

  if (signal) {
    if (signal.aborted) {
      destroyQuietly();
    } else {
      signal.addEventListener('abort', destroyQuietly, { once: true });
    }
  }

  nodeStream.on('error', (err) => {
    // Seek cancels the previous Range body → AbortError. Not a failure.
    if (isBenignStreamAbort(err)) return;
    log.warn('asmedia stream error:', err);
  });

  // Readable.toWeb cancel path also destroys the Node stream and can emit
  // AbortError on the error channel — already filtered above.
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

function fileResponse(
  filePath: string,
  size: number,
  mime: string,
  request: Request,
): Response {
  const rangeHeader = request.headers.get('range') || request.headers.get('Range');
  const method = (request.method || 'GET').toUpperCase();
  const signal = request.signal;

  const commonHeaders: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    // Allow the media stack to keep range responses around briefly for scrubbing.
    'Cache-Control': 'private, max-age=0',
  };

  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Length': String(size),
      },
    });
  }

  const range = parseHttpRange(rangeHeader, size);

  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        'Content-Range': `bytes */${size}`,
      },
    });
  }

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    return new Response(openFileWebStream(filePath, { start, end }, signal), {
      status: 206,
      headers: {
        ...commonHeaders,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new Response(openFileWebStream(filePath, null, signal), {
    status: 200,
    headers: {
      ...commonHeaders,
      'Content-Length': String(size),
    },
  });
}

/**
 * Install the asmedia:// handler. Only paths under the configured
 * outputDirectory with .mp4/.mkv extensions are served.
 */
export function installAsmediaProtocol(configService: ConfigService): void {
  protocol.handle('asmedia', async (request) => {
    try {
      const filePath = fromAsmediaUrl(request.url);
      if (!filePath) {
        return new Response('Bad asmedia URL', { status: 400 });
      }
      if (hasTraversalSegment(filePath)) {
        return new Response('Traversal blocked', { status: 403 });
      }

      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      if (!isPathInsideRoot(outputDir, filePath)) {
        log.warn('Blocked asmedia path outside outputDirectory:', filePath);
        return new Response('Forbidden', { status: 403 });
      }

      const resolved = path.resolve(filePath);
      const ext = path.extname(resolved).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) {
        return new Response('Unsupported media type', { status: 415 });
      }

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(resolved);
      } catch {
        return new Response('Not found', { status: 404 });
      }
      if (!stat.isFile()) {
        return new Response('Not a file', { status: 404 });
      }

      const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
      return fileResponse(resolved, stat.size, mime, request);
    } catch (error) {
      if (isBenignStreamAbort(error)) {
        return new Response(null, { status: 499 });
      }
      log.error('asmedia handler failed:', error);
      return new Response('Internal error', { status: 500 });
    }
  });
}
