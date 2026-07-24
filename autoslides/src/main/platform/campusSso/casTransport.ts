/**
 * HTTP transport for the campus CAS flow.
 *
 * The single-shot password login this replaced could get away with joining
 * `Set-Cookie` prefixes into one string and sending that everywhere. The SMS
 * second factor cannot: it spans half a dozen requests across two hosts, and
 * the `/protected/` SMS APIs are stricter than `/cas/login` — they want a real
 * cookie jar, a browser-shaped header set, a tracked `Referer`, an `Origin` on
 * writes, and per-request guard headers.
 *
 * A `CasTransport` therefore owns one login attempt's worth of state: its jar,
 * its referer, and its user agent. Redirects are never auto-followed — the flow
 * inspects every hop's `Location` itself.
 *
 * Durable cookies (the ones CAS marks with an explicit lifetime, which is how
 * "trust this device" is remembered) can be exported for persistence and seeded
 * back on a later attempt. Session cookies are deliberately excluded.
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { buildGuardHeaders } from './casPayloads';

/** A cookie we are willing to persist between login attempts. */
export interface DurableCookie {
  name: string;
  value: string;
  host: string;
  path: string;
  /** Epoch ms. */
  expiresAt: number;
}

interface JarEntry {
  name: string;
  value: string;
  host: string;
  path: string;
  /** Epoch ms, or null for a session cookie. */
  expiresAt: number | null;
}

/**
 * One Chrome-ish identity for the whole attempt. CAS can bind a flow to the
 * client that started it, so every hop — including the plain password POST —
 * must present the same headers.
 */
const CLIENT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'sec-ch-ua': '"Chromium";v="139", "Not(A:Brand";v="24", "Google Chrome";v="139"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
};

export interface CasRequestOptions {
  method?: 'GET' | 'POST';
  /** Form-encoded body. Mutually exclusive with `json` and `raw`. */
  form?: URLSearchParams;
  /** JSON body, serialized here. */
  json?: unknown;
  /** Pre-serialized body (the sealed envelope), sent verbatim. */
  raw?: string;
  headers?: Record<string, string>;
  /**
   * Append a millisecond stamp to defeat caching, as the CAS page's own scripts
   * do. Opt-in: it is only safe on URLs whose query we fully control — a ticket
   * redirect, for instance, must be replayed exactly as issued.
   */
  cacheBust?: boolean;
}

export class CasTransport {
  private readonly http: AxiosInstance;
  private readonly jar = new Map<string, JarEntry>();
  private referer: string;

  constructor(initialReferer: string, timeoutMs = 15_000) {
    this.referer = initialReferer;
    this.http = axios.create({
      timeout: timeoutMs,
      maxRedirects: 0,
      // Redirects and CAS's own 4xx rejections are both data to inspect, not
      // exceptions; only transport failures should throw.
      validateStatus: (status) => status >= 200 && status < 500,
      // Cookies are managed here, so never let axios decompress-and-cache
      // anything about them.
      transformResponse: [(data: unknown) => data],
    });
  }

  get userAgent(): string {
    return CLIENT_HEADERS['User-Agent'];
  }

  /** Remember where the next request is coming "from". */
  setReferer(url: string): void {
    this.referer = url;
  }

  async request(url: string, options: CasRequestOptions = {}): Promise<AxiosResponse<string>> {
    const method = options.method ?? 'GET';
    const target = method === 'GET' && options.cacheBust ? appendCacheBuster(url) : url;

    const headers: Record<string, string> = {
      ...CLIENT_HEADERS,
      Referer: this.referer,
      ...options.headers,
    };

    const cookieHeader = this.cookieHeaderFor(target);
    if (cookieHeader) headers.Cookie = cookieHeader;

    if (method !== 'GET') {
      headers.Origin = new URL(target).origin;
    }

    // The SMS/captcha APIs sit behind a per-request guard-header check.
    if (isProtectedPath(target)) {
      Object.assign(headers, buildGuardHeaders());
      headers['Sid-Language'] ??= 'zh_CN';
    }

    let body: string | undefined;
    if (options.form) {
      body = options.form.toString();
      headers['Content-Type'] ??= 'application/x-www-form-urlencoded';
    } else if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers['Content-Type'] ??= 'application/json';
    } else if (options.raw !== undefined) {
      body = options.raw;
      headers['Content-Type'] ??= 'application/json';
    }

    const response = await this.http.request<string>({
      url: target,
      method,
      headers,
      data: body,
    });

    this.absorbCookies(response, target);
    return response;
  }

  /** Cookies for `url`, honouring host and path scope and dropping expired ones. */
  private cookieHeaderFor(url: string): string {
    const { hostname, pathname } = new URL(url);
    const now = Date.now();
    const parts: string[] = [];

    for (const [key, entry] of this.jar) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.jar.delete(key);
        continue;
      }
      if (!hostMatches(hostname, entry.host)) continue;
      if (!pathMatches(pathname, entry.path)) continue;
      parts.push(`${entry.name}=${entry.value}`);
    }

    return parts.join('; ');
  }

  private absorbCookies(response: AxiosResponse, requestUrl: string): void {
    const raw = response.headers['set-cookie'];
    if (!Array.isArray(raw)) return;

    const requestHost = new URL(requestUrl).hostname;
    for (const line of raw) {
      const parsed = parseSetCookie(line, requestHost);
      if (!parsed) continue;
      // Key on host too: sso and the yanhekt callback must not share a jar slot.
      this.jar.set(`${parsed.host}|${parsed.name}`, parsed);
    }
  }

  /**
   * Cookies worth keeping for the next login attempt: those CAS gave an
   * explicit future lifetime. Session cookies belong to this flow only and are
   * never persisted.
   */
  exportDurableCookies(): DurableCookie[] {
    const now = Date.now();
    const out: DurableCookie[] = [];
    for (const entry of this.jar.values()) {
      if (entry.expiresAt === null || entry.expiresAt <= now) continue;
      out.push({
        name: entry.name,
        value: entry.value,
        host: entry.host,
        path: entry.path,
        expiresAt: entry.expiresAt,
      });
    }
    return out;
  }

  /** Pre-load previously persisted durable cookies, skipping expired ones. */
  seedDurableCookies(cookies: readonly DurableCookie[]): void {
    const now = Date.now();
    for (const cookie of cookies) {
      if (!cookie?.name || !cookie.host || cookie.expiresAt <= now) continue;
      this.jar.set(`${cookie.host}|${cookie.name}`, {
        name: cookie.name,
        value: cookie.value,
        host: cookie.host,
        path: cookie.path || '/',
        expiresAt: cookie.expiresAt,
      });
    }
  }
}

function isProtectedPath(url: string): boolean {
  return url.includes('/protected/');
}

function appendCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${Date.now()}`;
}

function hostMatches(requestHost: string, cookieHost: string): boolean {
  if (requestHost === cookieHost) return true;
  return requestHost.endsWith(`.${cookieHost}`);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (cookiePath === '/' || requestPath === cookiePath) return true;
  return requestPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
}

interface ParsedCookie {
  name: string;
  value: string;
  host: string;
  path: string;
  expiresAt: number | null;
}

function parseSetCookie(line: string, requestHost: string): ParsedCookie | null {
  const [pair, ...attributes] = line.split(';');
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;

  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;

  let host = requestHost;
  let path = '/';
  let expiresAt: number | null = null;
  let maxAge: number | null = null;

  for (const attribute of attributes) {
    const separator = attribute.indexOf('=');
    const key = (separator === -1 ? attribute : attribute.slice(0, separator)).trim().toLowerCase();
    const attributeValue = separator === -1 ? '' : attribute.slice(separator + 1).trim();

    if (key === 'domain' && attributeValue) {
      host = attributeValue.replace(/^\./, '').toLowerCase();
    } else if (key === 'path' && attributeValue) {
      path = attributeValue;
    } else if (key === 'expires' && attributeValue) {
      const parsed = Date.parse(attributeValue);
      if (!Number.isNaN(parsed)) expiresAt = parsed;
    } else if (key === 'max-age' && attributeValue) {
      const seconds = Number(attributeValue);
      if (Number.isFinite(seconds)) maxAge = seconds;
    }
  }

  // Max-Age wins over Expires per RFC 6265, and a non-positive one is a delete.
  if (maxAge !== null) {
    expiresAt = maxAge <= 0 ? Date.now() - 1 : Date.now() + maxAge * 1000;
  }

  return { name, value, host, path, expiresAt };
}
