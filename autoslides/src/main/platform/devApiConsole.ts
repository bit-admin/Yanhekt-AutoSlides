// Developer → API: sends one hand-built Yanhekt or Yanhe 2.0 request along the
// app's own route (IntranetApiTransport), so it behaves like ApiClient's and
// yanhe2Http's requests. Developer mode only; yanhekt.cn hosts only.
import type { AxiosResponse } from 'axios';
import { getClientSignature } from '@common/crypto';
import {
  isYanhe2ApiUrl,
  isYanhektApiUrl,
  maskToken,
  type DevApiRequest,
  type DevApiResponse,
} from '@common/devApi';
import { YANHE2_TENANT_ID } from '@common/yanhe2';
import { YANHEKT_CLIENT_HEADERS } from '@main/platform/apiClient';
import type { IntranetApiTransport } from '@main/platform/intranetApiTransport';

const TIMEOUT_MS = 30_000;
const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);

/** Set a header, replacing any spelling of the same name. */
function setHeader(headers: Record<string, string>, key: string, value: string): void {
  const lower = key.toLowerCase();
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === lower) delete headers[existing];
  }
  headers[key] = value;
}

/**
 * The headers to send (pure; tested). `token` is the bearer to use; it defaults
 * to the request's own and is how main passes a stored Yanhe 2.0 token.
 */
export function buildDevApiHeaders(
  request: DevApiRequest,
  nowSeconds: number,
  token: string | null | undefined = request.token,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (request.clientHeaders && request.platform === 'yanhe2') {
    // What getYanhe2Json sends besides the bearer.
    setHeader(headers, 'Accept', 'application/json');
    setHeader(headers, 'tenant-id', String(YANHE2_TENANT_ID));
  } else if (request.clientHeaders) {
    for (const [key, value] of Object.entries(YANHEKT_CLIENT_HEADERS)) setHeader(headers, key, value);
    setHeader(headers, 'Xclient-Signature', getClientSignature());
    setHeader(headers, 'Xclient-Timestamp', String(nowSeconds));
  }
  const bearer = token?.trim();
  if (bearer) setHeader(headers, 'Authorization', `Bearer ${bearer}`);
  if (request.method !== 'GET' && request.body?.trim()) {
    setHeader(headers, 'Content-Type', 'application/json');
  }
  for (const { key, value } of request.headers) {
    const name = key.trim();
    if (name) setHeader(headers, name, value);
  }
  return headers;
}

/** The sent headers with the Bearer token masked, for display. */
export function maskSentHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = key.toLowerCase() === 'authorization'
      ? value.replace(/^(Bearer\s+)(.+)$/i, (_m, prefix: string, token: string) => prefix + maskToken(token))
      : value;
  }
  return out;
}

/** Body as JSON when it parses, else the text as is. */
function requestBody(request: DevApiRequest): unknown {
  if (request.method === 'GET') return undefined;
  const text = request.body ?? '';
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function flattenHeaders(raw: AxiosResponse['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

export class DevApiConsole {
  constructor(
    private readonly transport: IntranetApiTransport,
    private readonly isEnabled: () => boolean,
    /** An account's stored Yanhe 2.0 JWT, or '' when it has none. */
    private readonly yanhe2Jwt: (account: string) => string = () => '',
  ) {}

  async send(request: DevApiRequest): Promise<DevApiResponse> {
    const started = Date.now();
    const refuse = (error: string): DevApiResponse => ({ ok: false, error, durationMs: 0, sentHeaders: {} });

    if (!this.isEnabled()) return refuse('Developer mode is off.');
    if (!request || typeof request.url !== 'string' || !METHODS.has(request.method)) return refuse('Invalid request.');
    if (!isYanhektApiUrl(request.url)) return refuse('Only https URLs on yanhekt.cn hosts can be sent.');

    let token = request.token;
    const yanhe2Account = typeof request.yanhe2Account === 'string' ? request.yanhe2Account.trim() : '';
    if (yanhe2Account) {
      // The stored token goes to aita only, like getYanhe2Json's.
      if (!isYanhe2ApiUrl(request.url)) return refuse('A Yanhe 2.0 token is only sent to https://aita.yanhekt.cn.');
      token = this.yanhe2Jwt(yanhe2Account);
      if (!token) return refuse('That account is not signed in to Yanhe 2.0.');
    }

    const headers = buildDevApiHeaders(request, Math.floor(started / 1000), token);
    const sentHeaders = maskSentHeaders(headers);
    try {
      const response = await this.transport.send<string>({
        method: request.method,
        url: request.url,
        headers,
        data: requestBody(request),
        timeout: TIMEOUT_MS,
        responseType: 'text',
        transformResponse: [(data: unknown) => data],
        validateStatus: () => true,
        maxRedirects: 0,
      });
      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
      return {
        ok: true,
        status: response.status,
        statusText: response.statusText ?? '',
        headers: flattenHeaders(response.headers),
        body,
        size: Buffer.byteLength(body, 'utf8'),
        durationMs: Date.now() - started,
        sentHeaders,
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const message = [err.code, err.message].filter(Boolean).join(': ') || 'Request failed.';
      return { ok: false, error: message, durationMs: Date.now() - started, sentHeaders };
    }
  }
}
