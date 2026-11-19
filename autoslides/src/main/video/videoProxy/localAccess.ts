// Who may use the local player proxy (audit NET-09). The proxy signs Yanhekt
// and Yanhe 2.0 media with the user's credentials, so a page in an ordinary
// browser (port scan, DNS rebinding) or another program must not get answers
// from it. It is not a token in the URL (every player, playlist rewrite and
// cache key would carry it): main makes one secret per launch, the app's own
// pages get it added as a header by their session (`installLocalAccessHeader`),
// FFmpeg is given it with `-headers`, and the proxy refuses a request without
// it. A web page cannot set that header on someone else's behalf, and the
// session adds it only for pages of the app itself.
import crypto from 'node:crypto';
import type { Session } from 'electron';

export const LOCAL_ACCESS_HEADER = 'X-AutoSlides-Local';

export function createLocalAccessSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** True when the request carries this launch's secret. */
export function hasLocalAccess(headers: Record<string, string | string[] | undefined>, secret: string): boolean {
  const raw = headers[LOCAL_ACCESS_HEADER.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !secret) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The Host a request to `localhost:<port>` carries. Anything else is a
 * rebound name pointing a page's own origin at this port.
 */
export function isLoopbackHost(host: string | undefined, port: number): boolean {
  if (!host || !port) return false;
  return host === `localhost:${port}` || host === `127.0.0.1:${port}` || host === `[::1]:${port}`;
}

/** A URL on the proxy (any of its loopback spellings). */
export function isLocalProxyUrl(url: string, port: number): boolean {
  if (!port) return false;
  return (
    url.startsWith(`http://localhost:${port}/`) ||
    url.startsWith(`http://127.0.0.1:${port}/`) ||
    url.startsWith(`http://[::1]:${port}/`)
  );
}

/**
 * A page of the app itself: the packaged renderer (file://) or, in a dev
 * build, the main renderer's Vite origin. Anything else (a site in a frame) is not.
 */
export function isAppPageUrl(pageUrl: string, devServerUrls: readonly (string | undefined)[]): boolean {
  if (pageUrl.startsWith('file://')) return true;
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return false;
  }
  return devServerUrls.some((dev) => {
    if (!dev) return false;
    try {
      return new URL(dev).origin === origin;
    } catch {
      return false;
    }
  });
}

/**
 * Add the header to the app's own requests to the proxy. Electron keeps one
 * `onBeforeSendHeaders` listener per session, so this must be the only one on
 * `session` (the default session has none other).
 */
export function installLocalAccessHeader(
  session: Session,
  opts: { secret: string; port: () => number; devServerUrls: readonly (string | undefined)[] },
): void {
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (isLocalProxyUrl(details.url, opts.port())) {
      // The requesting frame; a worker's request has none, so its page.
      const pageUrl = details.frame?.url || details.webContents?.getURL() || '';
      if (isAppPageUrl(pageUrl, opts.devServerUrls)) {
        callback({ requestHeaders: { ...details.requestHeaders, [LOCAL_ACCESS_HEADER]: opts.secret } });
        return;
      }
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}
