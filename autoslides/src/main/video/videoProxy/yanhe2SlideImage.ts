/**
 * `/yanhe2-slide` on the local proxy: Yanhe 2.0 server-slide images.
 *
 * The JPEGs under aita's `/ai-nginx/` tree are public (no signature, no
 * Referer, no bearer), so the renderer could load them directly. It gets
 * `http://localhost:<port>/yanhe2-slide?u=<upstream url>` instead so that they
 * take the intranet route like the rest of Yanhe 2.0: on campus they come from
 * aita's intranet address, with the public host as fallback in Auto mode.
 */
import type * as http from 'http';
import type { Readable } from 'stream';
import axios, { type AxiosResponse } from 'axios';
import type { IntranetAgents } from '@main/infra/intranetTransport';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { isYanhe2SlideImageUrl } from '@main/platform/yanhe2/yanhe2Slides';
import { getAlongRoute } from './proxyRequest';
import { applyNoStoreHeaders } from './httpHeaders';
import { createLogger } from '@main/infra/logger';

const log = createLogger('Yanhe2SlideImage');

const TIMEOUT_MS = 30_000;

function fail(res: http.ServerResponse, status: number, message: string): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(message);
}

export interface Yanhe2SlideImageDeps {
  intranetMapping: IntranetMappingService;
  /** The proxy's keep-alive agents for the current route. */
  agents: IntranetAgents;
}

export async function handleYanhe2SlideImageRequest(
  res: http.ServerResponse,
  query: Record<string, string | string[] | undefined>,
  deps: Yanhe2SlideImageDeps,
): Promise<void> {
  const upstream = typeof query.u === 'string' ? query.u : '';
  if (!isYanhe2SlideImageUrl(upstream)) {
    fail(res, 400, 'Bad Yanhe 2.0 slide request');
    return;
  }

  // Scrolling past a thumbnail or closing the tab drops the request.
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  let response: AxiosResponse;
  try {
    response = await getAlongRoute(upstream, deps.intranetMapping, deps.agents, {
      maxRedirects: 0,
      signal: abort.signal,
      timeout: TIMEOUT_MS,
      responseType: 'stream',
      validateStatus: () => true,
    });
  } catch (error) {
    if (abort.signal.aborted) return;
    const reason = axios.isAxiosError(error) ? (error.code ?? 'no answer') : 'request error';
    log.warn(`Yanhe 2.0 slide request failed: ${reason}`);
    fail(res, 502, 'Yanhe 2.0 slide request failed');
    return;
  }

  const body = response.data as Readable;
  if (response.status !== 200) {
    body.destroy();
    log.warn(`Yanhe 2.0 slide answered ${response.status}`);
    fail(res, response.status >= 400 ? response.status : 502, `Yanhe 2.0 slide answered ${response.status}`);
    return;
  }

  const type = response.headers['content-type'];
  const length = response.headers['content-length'];
  res.setHeader('Content-Type', typeof type === 'string' ? type : 'image/jpeg');
  if (typeof length === 'string') res.setHeader('Content-Length', length);
  // Same rule as every other proxy route: nothing it serves goes into
  // Chromium's cache. Upstream cache headers are not forwarded either.
  applyNoStoreHeaders(res);
  res.writeHead(200);
  body.on('error', () => res.destroy());
  body.pipe(res);
}
