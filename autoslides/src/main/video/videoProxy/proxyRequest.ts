import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type * as http from 'http';
import type * as https from 'https';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import type { ProxyAuth } from './proxyAuth';

/**
 * Shared request primitives for the video proxy handlers. These were copy-pasted
 * ~6× across the recorded m3u8 + TS handlers (signing) and ~3× (axios config).
 * Extracted verbatim — control flow, retry semantics, timeouts, and the
 * live-vs-recorded divergence stay in videoProxyService.ts; only the duplicated
 * request-preparation bodies live here.
 */

export interface ProxyAgents {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
  httpsAgentNoVerify: https.Agent;
}

export interface SignedRequest {
  requestUrl: string;
  headers: Record<string, string>;
}

const RECORDED_HOST = 'cvideo.yanhekt.cn';

/**
 * Encrypt + sign a recorded-video URL, apply intranet URL rewriting, and set the
 * Host header to the rewritten host when the URL was remapped. Mirrors the
 * inline block previously duplicated in handleM3u8Request (initial + 403 retry)
 * and handleTsRequest (recorded + fallback + 403 retry).
 */
export async function signRecordedUrl(
  auth: ProxyAuth,
  intranetMapping: IntranetMappingService,
  rawUrl: string,
  baseHeaders: Record<string, string>
): Promise<SignedRequest> {
  const tokenData = await auth.refreshTokenAndSignature();
  // Always get fresh signature (matches the original per-request behavior).
  const freshSignature = auth.getSignature();

  const encryptedUrl = auth.encryptURL(rawUrl);
  const signedUrl = auth.addSignatureForUrl(
    encryptedUrl,
    tokenData.videoToken!,
    freshSignature.timestamp,
    freshSignature.signature
  );

  const headers: Record<string, string> = { ...baseHeaders, Host: RECORDED_HOST };

  // Rewrite URL for intranet mode if needed; update Host header to match.
  const requestUrl = intranetMapping.rewriteUrl(signedUrl);
  if (requestUrl !== signedUrl) {
    headers['Host'] = new URL(signedUrl).hostname;
  }

  return { requestUrl, headers };
}

/**
 * Build the axios config shared by every proxy request: keep-alive agents (cert
 * verification disabled under intranet mode), a 500-floor validateStatus, and an
 * optional stream response type for TS piping.
 */
export function buildAxiosConfig(
  intranetMapping: IntranetMappingService,
  agents: ProxyAgents,
  headers: Record<string, string>,
  opts: { timeout: number; responseType?: 'stream' }
): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers,
    timeout: opts.timeout,
    httpAgent: agents.httpAgent,
    httpsAgent: intranetMapping.isEnabled() ? agents.httpsAgentNoVerify : agents.httpsAgent,
    validateStatus: (status: number) => status < 500 // Accept all status codes below 500
  };
  if (opts.responseType) {
    config.responseType = opts.responseType;
  }
  return config;
}

export interface ResignFetchOptions {
  intranetMapping: IntranetMappingService;
  /** Resolved per attempt so agent rotation (intranet toggles) is honoured mid-retry. */
  agents: () => ProxyAgents;
  baseHeaders: Record<string, string>;
  /** Per-request headers layered over `baseHeaders` (e.g. Range passthrough). */
  extraHeaders?: Record<string, string>;
  timeout: number;
  responseType?: 'stream';
  /** Linear backoff base: attempt n waits `backoffMs * n`. */
  backoffMs: number;
  maxRetries?: number;
  log?: (message: string) => void;
}

/** Best-effort teardown of a streamed 403 body so the socket is released before retrying. */
export function destroyStreamBody(response: AxiosResponse): void {
  const data = response.data as { destroy?: () => void } | undefined;
  if (data && typeof data.destroy === 'function') {
    try {
      data.destroy();
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

/**
 * GET a recorded-video URL, re-signing on 403.
 *
 * A 403 from the CDN means the `Xvideo_Token` or the signature was rejected.
 * `signRecordedUrl` only recomputes the signature — it reuses the cached video
 * token while it is inside its refresh window — so every retry first drops the
 * cached token (`auth.invalidateToken()`) and mints a fresh one. This is the
 * same policy as the desktop LAN relay and the cloud relay Worker; the desktop
 * proxy used to retry three times with the stale token. Once retries are
 * exhausted the token is invalidated one last time and the final 403 is
 * returned for the caller to surface. Network errors / 5xx (which axios throws)
 * propagate to the caller.
 */
export async function fetchRecordedWithResign(
  auth: ProxyAuth,
  rawUrl: string,
  opts: ResignFetchOptions
): Promise<AxiosResponse> {
  const maxRetries = opts.maxRetries ?? 3;
  let attempt = 0;

  while (true) {
    const { requestUrl, headers } = await signRecordedUrl(
      auth, opts.intranetMapping, rawUrl, opts.baseHeaders
    );
    Object.assign(headers, opts.extraHeaders);
    const axiosConfig = buildAxiosConfig(opts.intranetMapping, opts.agents(), headers, {
      timeout: opts.timeout,
      responseType: opts.responseType
    });

    const response = await axios.get(requestUrl, axiosConfig);

    if (response.status !== 403) {
      return response; // 200 (serve) or other status (caller surfaces it)
    }

    destroyStreamBody(response);
    auth.invalidateToken();
    if (attempt < maxRetries) {
      attempt++;
      opts.log?.(`Recorded request got 403, re-minting token and retrying (${attempt}/${maxRetries}) for: ${rawUrl}`);
      await new Promise<void>(resolve => setTimeout(resolve, opts.backoffMs * attempt));
      continue;
    }

    opts.log?.('Recorded 403 persisted after retries; token cache cleared');
    return response; // exhausted — caller surfaces the 403
  }
}
