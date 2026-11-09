/**
 * Developer → API: a request console for the Yanhekt API (cbiz) and the
 * Yanhe 2.0 API (aita). The renderer builds the request; main signs and sends
 * it along the app's own route (intranet or public), so what you see is what
 * the app sees.
 */

/** `yanhekt`: cbiz.yanhekt.cn. `yanhe2`: aita.yanhekt.cn. */
export type DevApiPlatform = 'yanhekt' | 'yanhe2';

export const YANHE2_API_HOST = 'aita.yanhekt.cn';

export type DevApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const DEV_API_METHODS: readonly DevApiMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

export interface DevApiHeader {
  key: string;
  value: string;
}

export interface DevApiRequest {
  /** Which site's client headers to add. Missing means `yanhekt`. */
  platform?: DevApiPlatform;
  method: DevApiMethod;
  /** Full https URL on a `yanhekt.cn` host, query included. */
  url: string;
  /** Extra headers; they override the client headers of the same name. */
  headers: DevApiHeader[];
  /** Raw body text, sent as JSON when it parses as JSON. Ignored on GET. */
  body?: string;
  /** Login token sent as `Authorization: Bearer`. Empty or null sends none. */
  token?: string | null;
  /**
   * Yanhe 2.0 only: send this account's stored Yanhe 2.0 token (by badge).
   * Main reads it, so the JWT never reaches the page. Takes the place of `token`,
   * and only an aita.yanhekt.cn URL may carry it.
   */
  yanhe2Account?: string | null;
  /**
   * Add the client headers. Yanhekt: the official web client's (Origin, Referer,
   * Xdomain-Client, Xclient-*). Yanhe 2.0: what the app sends (Accept, tenant-id).
   */
  clientHeaders: boolean;
}

export type DevApiResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      /** Response text as received. */
      body: string;
      /** Bytes of the body. */
      size: number;
      durationMs: number;
      /** What was sent, with the Bearer token masked. */
      sentHeaders: Record<string, string>;
    }
  | {
      ok: false;
      /** No HTTP answer (refused, timeout, bad URL) or the request was refused before sending. */
      error: string;
      durationMs: number;
      sentHeaders: Record<string, string>;
    };

/** Hosts the console may send to: Yanhekt only, so it is not a general request tool. */
export function isYanhektApiUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'yanhekt.cn' || host.endsWith('.yanhekt.cn');
}

/** An https URL on aita.yanhekt.cn, the one host a Yanhe 2.0 token may go to. */
export function isYanhe2ApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === YANHE2_API_HOST;
  } catch {
    return false;
  }
}

/** `abcd…wxyz` — enough to tell accounts apart, not enough to reuse. */
export function maskToken(token: string): string {
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
