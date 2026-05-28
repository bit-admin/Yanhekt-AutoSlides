import type { AxiosRequestConfig } from 'axios';
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
