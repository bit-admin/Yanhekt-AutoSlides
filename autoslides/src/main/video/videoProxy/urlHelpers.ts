import { createLogger } from '@main/infra/logger';
const log = createLogger('UrlHelpers');
export function fixUrlEscaping(url: string): string {
  return url.replace(/\\\//g, '/');
}

export function yanhektMediaProxyUrl(
  port: number, route: 'live' | 'recorded' | 'audio', originalUrl: string, loginToken?: string,
): string {
  const query = new URLSearchParams({ originalUrl: fixUrlEscaping(originalUrl) });
  if (loginToken) query.set('loginToken', loginToken);
  return `http://localhost:${port}/${route}?${query}`;
}

export function extractHostFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    log.error('Error extracting host from URL:', url, error);
    return 'localhost';
  }
}

export function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http')) {
    return relative;
  }

  const baseUrl = new URL(base);

  if (relative.startsWith('/')) {
    return `${baseUrl.protocol}//${baseUrl.host}${relative}`;
  }

  const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
  return `${baseUrl.protocol}//${baseUrl.host}${basePath}${relative}`;
}

export function rewriteM3u8TsUrls(
  content: string,
  proxyPort: number,
  baseUrl: string,
  routePrefix: 'live' | 'recorded',
  loginToken?: string,
): string {
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('#') && line.trim() !== '') {
      const tsFileName = line.trim();
      const segment = routePrefix === 'live' ? `live/${tsFileName}` : `recorded/${tsFileName}`;
      const query = new URLSearchParams({ baseUrl });
      // Only recorded segments are signed with the account that opened the stream.
      if (loginToken) query.set('loginToken', loginToken);
      result.push(`http://localhost:${proxyPort}/${segment}?${query}`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * True for an http(s) address on a Yanhekt host. The Yanhekt media routes are
 * handed public Yanhekt URLs only (the intranet route maps them later), so
 * anything else is refused rather than fetched: a signed recorded request
 * carries the account's video token.
 */
export function isYanhektMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    return (u.protocol === 'https:' || u.protocol === 'http:') && (host === 'yanhekt.cn' || host.endsWith('.yanhekt.cn'));
  } catch {
    return false;
  }
}

