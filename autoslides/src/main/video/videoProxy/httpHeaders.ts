/**
 * Response-header helpers for the local HLS proxy.
 *
 * Upstream CDNs attach long-lived Cache-Control / ETag / Last-Modified on
 * .ts segments. If those headers are forwarded, Chromium writes every
 * segment into userData/Cache (hundreds of MB per lecture). HLS.js already
 * buffers in memory, so the proxy must force no-store on everything it
 * serves to the renderer.
 */

const UPSTREAM_CACHE_HEADERS = new Set([
  'cache-control',
  'pragma',
  'expires',
  'etag',
  'last-modified',
  'age',
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

export const NO_STORE_CACHE_CONTROL = 'no-store';

export function shouldForwardUpstreamHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith('access-control-')) return false;
  if (HOP_BY_HOP_HEADERS.has(lower)) return false;
  if (UPSTREAM_CACHE_HEADERS.has(lower)) return false;
  return true;
}

export function applyNoStoreHeaders(res: { setHeader(name: string, value: string): void }): void {
  res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
}
