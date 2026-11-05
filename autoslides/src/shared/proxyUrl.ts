// The custom proxy address (Settings → Network → Proxy), checked the same way
// by the Settings page and by main's request routing.

const PROXY_SCHEMES = new Set(['http:', 'https:', 'socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:']);

/**
 * A usable proxy URL, or null. `host:port` alone means an http proxy. Only a
 * scheme, credentials, host and port are allowed: no path, query or fragment.
 */
export function parseProxyUrl(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    if (!PROXY_SCHEMES.has(url.protocol) || !url.hostname) return null;
    if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

/** The proxy URL in the form the request layer and Chromium take: no trailing slash. */
export function normalizeProxyUrl(raw: string): string | null {
  const url = parseProxyUrl(raw);
  return url ? url.href.replace(/\/$/, '') : null;
}
