import { describe, expect, it } from 'vitest';
import {
  NO_STORE_CACHE_CONTROL,
  applyNoStoreHeaders,
  shouldForwardUpstreamHeader,
} from './httpHeaders';

describe('shouldForwardUpstreamHeader', () => {
  it('forwards content metadata', () => {
    expect(shouldForwardUpstreamHeader('Content-Type')).toBe(true);
    expect(shouldForwardUpstreamHeader('content-length')).toBe(true);
    expect(shouldForwardUpstreamHeader('Content-Range')).toBe(true);
    expect(shouldForwardUpstreamHeader('Accept-Ranges')).toBe(true);
  });

  it('strips cache validators so Chromium cannot persist the body', () => {
    expect(shouldForwardUpstreamHeader('Cache-Control')).toBe(false);
    expect(shouldForwardUpstreamHeader('cache-control')).toBe(false);
    expect(shouldForwardUpstreamHeader('Pragma')).toBe(false);
    expect(shouldForwardUpstreamHeader('Expires')).toBe(false);
    expect(shouldForwardUpstreamHeader('ETag')).toBe(false);
    expect(shouldForwardUpstreamHeader('Last-Modified')).toBe(false);
    expect(shouldForwardUpstreamHeader('Age')).toBe(false);
  });

  it('strips hop-by-hop and CORS headers the proxy sets itself', () => {
    expect(shouldForwardUpstreamHeader('Transfer-Encoding')).toBe(false);
    expect(shouldForwardUpstreamHeader('Connection')).toBe(false);
    expect(shouldForwardUpstreamHeader('Access-Control-Allow-Origin')).toBe(false);
  });
});

describe('applyNoStoreHeaders', () => {
  it('overrides Cache-Control to no-store', () => {
    const headers = new Map<string, string>();
    applyNoStoreHeaders({
      setHeader(name, value) {
        headers.set(name, value);
      },
    });
    expect(headers.get('Cache-Control')).toBe(NO_STORE_CACHE_CONTROL);
    expect(headers.get('Pragma')).toBe('no-cache');
  });
});
