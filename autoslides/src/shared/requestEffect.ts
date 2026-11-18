// Whether a request to a Yanhekt host changes something, decided by what the
// request is, not by its HTTP verb: Yanhe 2.0 (aita.yanhekt.cn) has GETs that
// write. The network layer retries a read freely but never resends a write
// that may have arrived, and the Developer API page labels requests with this.

export type RequestEffect = 'read' | 'write';

/**
 * GETs known to change the account. Path prefixes on aita.yanhekt.cn; the
 * reads the app itself makes are on `YANHE2_READ_PATHS` and none is here.
 */
const YANHE2_GET_WRITES: readonly string[] = [
  // Adds a course bookmark; `cancel=1` removes it.
  '/courseapi/v3/course-collect/down',
  // The site's search box: every call appends to the search history.
  '/pptnote/v1/searchlist',
  // Records a watch position.
  '/courseapi/v2/learn-record/',
];

const YANHE2_HOST = 'aita.yanhekt.cn';

export function requestEffect(method: string, url: string): RequestEffect {
  if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') return 'write';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'read';
  }
  if (parsed.hostname.toLowerCase() !== YANHE2_HOST) return 'read';
  const path = parsed.pathname.replace(/\/{2,}/g, '/');
  // A prefix ending in `/` covers everything under it; otherwise the path itself
  // (and anything under it as a folder), never a longer name that starts alike.
  const writes = YANHE2_GET_WRITES.some((prefix) =>
    prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)
  );
  return writes ? 'write' : 'read';
}
