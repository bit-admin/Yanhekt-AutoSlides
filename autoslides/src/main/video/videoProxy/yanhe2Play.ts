/**
 * `/yanhe2` on the local proxy: Yanhe 2.0 recordings.
 *
 * aita's `/play/` tree wants a `t` signature on every playlist, segment and
 * MP4, plus a yanhekt.cn Referer. The signature is made from the account's
 * profile phone, which stays in main: the renderer only ever holds
 * `http://localhost:<port>/yanhe2?account=<badge>&u=<upstream url>` and this
 * handler signs that one path at the moment it is asked for.
 *
 * Not the Yanhekt recorded route: no URL encryption, no video token, no
 * intranet rewriting, and a 403 is not retried (it means a wrong clock or a
 * wrong phone, neither of which a second try fixes).
 */
import type * as http from 'http';
import { Readable } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { YANHE2_ORIGIN } from '@common/yanhe2';
import {
  isYanhe2PlayUrl,
  signYanhe2PlayUrl,
  type Yanhe2PlayIdentity,
} from '@main/platform/yanhe2/yanhe2Playback';
import { rewriteYanhe2Playlist } from './yanhe2PlayUrls';
import { applyNoStoreHeaders, shouldForwardUpstreamHeader } from './httpHeaders';
import { createLogger } from '@main/infra/logger';

const log = createLogger('Yanhe2Play');

const PLAYLIST_TIMEOUT_MS = 30_000;

const UPSTREAM_HEADERS = {
  Referer: `${YANHE2_ORIGIN}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3',
};

function fail(res: http.ServerResponse, status: number, message: string): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(message);
}

export interface Yanhe2PlayDeps {
  port: number;
  /** The signing values for that badge, or null when it has no live Yanhe 2.0 session. */
  identityFor: (account: string) => Yanhe2PlayIdentity | null;
}

export async function handleYanhe2PlayRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  query: Record<string, string | string[] | undefined>,
  deps: Yanhe2PlayDeps,
): Promise<void> {
  const account = typeof query.account === 'string' ? query.account : '';
  const upstream = typeof query.u === 'string' ? query.u : '';
  if (!account || !isYanhe2PlayUrl(upstream)) {
    fail(res, 400, 'Bad Yanhe 2.0 media request');
    return;
  }
  const identity = deps.identityFor(account);
  if (!identity) {
    fail(res, 401, 'No Yanhe 2.0 session for that account');
    return;
  }

  const isPlaylist = /\.m3u8$/i.test(new URL(upstream).pathname);
  const headers: Record<string, string> = { ...UPSTREAM_HEADERS };
  // The MP4s are progressive files the <video> element seeks by byte range.
  if (!isPlaylist && typeof req.headers.range === 'string') headers.Range = req.headers.range;

  // A closed tab or a seek drops the request; stop pulling the file then.
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  const signal = isPlaylist
    ? AbortSignal.any([abort.signal, AbortSignal.timeout(PLAYLIST_TIMEOUT_MS)])
    : abort.signal;

  let response: Response;
  try {
    // The signed URL carries the account's signature and is never logged.
    response = await fetch(signYanhe2PlayUrl(upstream, identity, Date.now()), {
      headers,
      redirect: 'manual',
      signal,
    });
  } catch (error) {
    if (abort.signal.aborted) return;
    log.warn('Yanhe 2.0 media request failed:', error instanceof Error ? error.message : String(error));
    fail(res, 502, 'Yanhe 2.0 media request failed');
    return;
  }

  if (response.status !== 200 && response.status !== 206) {
    void response.body?.cancel().catch(() => undefined);
    log.warn(`Yanhe 2.0 media answered ${response.status}`);
    fail(res, response.status >= 400 ? response.status : 502, `Yanhe 2.0 media answered ${response.status}`);
    return;
  }

  if (isPlaylist) {
    let content: string;
    try {
      content = await response.text();
    } catch {
      fail(res, 502, 'Yanhe 2.0 playlist could not be read');
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    applyNoStoreHeaders(res);
    res.writeHead(200);
    res.end(rewriteYanhe2Playlist(content, upstream, deps.port, account));
    return;
  }

  response.headers.forEach((value, name) => {
    // `fetch` already decoded the body, so its encoding header no longer applies.
    if (name === 'content-encoding') return;
    if (shouldForwardUpstreamHeader(name)) res.setHeader(name, value);
  });
  // Same reason as the Yanhekt routes: Chromium would otherwise write every
  // segment, or a 700 MB screen recording, into userData/Cache.
  applyNoStoreHeaders(res);
  res.writeHead(response.status);
  if (!response.body) {
    res.end();
    return;
  }
  const body = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
  body.on('error', () => res.destroy());
  body.pipe(res);
}
