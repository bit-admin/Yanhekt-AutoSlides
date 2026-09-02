import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse } from 'axios';

const axiosGet = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { get: axiosGet } }));

import { fetchRecordedWithResign, type ResignFetchOptions } from './proxyRequest';
import type { ProxyAuth } from './proxyAuth';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';

function makeAuth() {
  let mint = 0;
  const auth = {
    invalidateToken: vi.fn(),
    refreshTokenAndSignature: vi.fn(async () => ({ videoToken: `token-${mint++}` })),
    getSignature: vi.fn(() => ({ timestamp: '1', signature: 'sig' })),
    encryptURL: vi.fn((u: string) => `enc(${u})`),
    addSignatureForUrl: vi.fn((u: string, token: string) => `${u}?t=${token}`)
  };
  return auth as unknown as ProxyAuth & typeof auth;
}

const intranetMapping = {
  rewriteUrl: (u: string) => u,
  isEnabled: () => false
} as unknown as IntranetMappingService;

function response(status: number, data: unknown = 'body'): AxiosResponse {
  return { status, data, headers: {}, config: {}, statusText: '' } as unknown as AxiosResponse;
}

function options(): ResignFetchOptions {
  return {
    intranetMapping,
    agents: () => ({ httpAgent: {}, httpsAgent: {}, httpsAgentNoVerify: {} }) as never,
    baseHeaders: { 'User-Agent': 'test' },
    timeout: 1000,
    backoffMs: 0
  };
}

describe('fetchRecordedWithResign', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  it('returns a non-403 response without touching the token', async () => {
    const auth = makeAuth();
    axiosGet.mockResolvedValueOnce(response(200));
    const res = await fetchRecordedWithResign(auth, 'https://cvideo.yanhekt.cn/a.m3u8', options());
    expect(res.status).toBe(200);
    expect(auth.invalidateToken).not.toHaveBeenCalled();
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cached token before every retry and signs with the fresh one', async () => {
    const auth = makeAuth();
    axiosGet.mockResolvedValueOnce(response(403)).mockResolvedValueOnce(response(200));
    const res = await fetchRecordedWithResign(auth, 'https://cvideo.yanhekt.cn/a.m3u8', options());
    expect(res.status).toBe(200);
    expect(auth.invalidateToken).toHaveBeenCalledTimes(1);
    // invalidate happened before the second sign
    const invalidateOrder = auth.invalidateToken.mock.invocationCallOrder[0];
    const secondRefreshOrder = auth.refreshTokenAndSignature.mock.invocationCallOrder[1];
    expect(invalidateOrder).toBeLessThan(secondRefreshOrder);
    expect(axiosGet.mock.calls[0][0]).toContain('t=token-0');
    expect(axiosGet.mock.calls[1][0]).toContain('t=token-1');
  });

  it('gives up after maxRetries, invalidating on the final 403 as well', async () => {
    const auth = makeAuth();
    axiosGet.mockResolvedValue(response(403));
    const res = await fetchRecordedWithResign(auth, 'https://cvideo.yanhekt.cn/a.ts', { ...options(), maxRetries: 3 });
    expect(res.status).toBe(403);
    expect(axiosGet).toHaveBeenCalledTimes(4);
    expect(auth.invalidateToken).toHaveBeenCalledTimes(4);
  });

  it('destroys a streamed 403 body and layers extra headers over base headers', async () => {
    const auth = makeAuth();
    const destroy = vi.fn();
    axiosGet.mockResolvedValueOnce(response(403, { destroy })).mockResolvedValueOnce(response(206));
    const res = await fetchRecordedWithResign(auth, 'https://cvideo.yanhekt.cn/a.ts', {
      ...options(),
      responseType: 'stream',
      extraHeaders: { Range: 'bytes=0-99' }
    });
    expect(res.status).toBe(206);
    expect(destroy).toHaveBeenCalledTimes(1);
    const headers = axiosGet.mock.calls[1][1].headers as Record<string, string>;
    expect(headers.Range).toBe('bytes=0-99');
    expect(headers['User-Agent']).toBe('test');
    expect(headers.Host).toBe('cvideo.yanhekt.cn');
  });
});
