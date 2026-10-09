import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

const interfaces = vi.hoisted(() => ({ current: {} as Record<string, unknown[]> }));
vi.mock('node:os', () => ({ default: { networkInterfaces: () => interfaces.current } }));
vi.mock('./logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  IntranetAgentPool,
  createIntranetAxios,
  intranetTarget,
  resolveBindAddress,
  type IntranetUrlMapper,
} from './intranetTransport';

const CAMPUS_IP = '10.62.1.7';

function nic(address: string) {
  return { address, internal: false, family: 'IPv4' };
}

function makeMapper(state: { enabled: boolean; interfaceIp: string | null }): IntranetUrlMapper {
  const mapUrl = (url: string) => url.replace('cvideo.yanhekt.cn', '10.0.34.24');
  return {
    isEnabled: () => state.enabled,
    getInterfaceIp: () => state.interfaceIp,
    mapUrl,
    rewriteUrl: (url) => (state.enabled ? mapUrl(url) : url),
  };
}

type Interceptors = { forEach(fn: (h: { fulfilled?: (c: InternalAxiosRequestConfig) => unknown }) => void): void };

/** Run a request config through the instance's request interceptors. */
function intercept(instance: ReturnType<typeof createIntranetAxios>['instance'], url: string) {
  let config = { url, headers: {} } as unknown as InternalAxiosRequestConfig;
  (instance.interceptors.request as unknown as Interceptors).forEach((handler) => {
    if (handler.fulfilled) config = handler.fulfilled(config) as InternalAxiosRequestConfig;
  });
  return config;
}

type AgentOptions = { localAddress?: string; maxSockets?: number; rejectUnauthorized?: boolean };

/** Node keeps the constructor options on the agent, but does not type them. */
function optionsOf(agent: unknown): AgentOptions {
  return (agent as { options: AgentOptions }).options;
}

beforeEach(() => {
  interfaces.current = { en0: [nic(CAMPUS_IP)], lo0: [{ address: '127.0.0.1', internal: true, family: 'IPv4' }] };
});

describe('intranetTarget', () => {
  it('keeps the original hostname for a remapped URL', () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    expect(intranetTarget('https://cvideo.yanhekt.cn/a/b.ts?x=1', mapper.rewriteUrl)).toEqual({
      url: 'https://10.0.34.24/a/b.ts?x=1',
      host: 'cvideo.yanhekt.cn',
    });
  });

  it('reports no host when nothing was remapped', () => {
    const mapper = makeMapper({ enabled: false, interfaceIp: null });
    const url = 'https://cvideo.yanhekt.cn/a.ts';
    expect(intranetTarget(url, mapper.rewriteUrl)).toEqual({ url, host: null });
    expect(intranetTarget('https://example.com/a.ts', mapper.mapUrl)).toEqual({
      url: 'https://example.com/a.ts',
      host: null,
    });
  });
});

describe('resolveBindAddress', () => {
  it('binds only while intranet is active and the interface is present', () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: CAMPUS_IP });
    expect(resolveBindAddress(mapper, true)).toBe(CAMPUS_IP);
    expect(resolveBindAddress(mapper, false)).toBe('');
  });

  it('falls back to unbound when the saved interface has gone or none is set', () => {
    expect(resolveBindAddress(makeMapper({ enabled: true, interfaceIp: null }), true)).toBe('');
    interfaces.current = {};
    expect(resolveBindAddress(makeMapper({ enabled: true, interfaceIp: CAMPUS_IP }), true)).toBe('');
  });

  it('never binds to a loopback address', () => {
    expect(resolveBindAddress(makeMapper({ enabled: true, interfaceIp: '127.0.0.1' }), true)).toBe('');
  });
});

describe('IntranetAgentPool', () => {
  it('reuses agents until the binding changes, then rebuilds them', () => {
    const state = { enabled: false, interfaceIp: CAMPUS_IP as string | null };
    const pool = new IntranetAgentPool(makeMapper(state));

    const unbound = pool.resolve();
    expect(optionsOf(unbound.httpAgent).localAddress).toBeUndefined();
    expect(pool.resolve()).toBe(unbound);

    state.enabled = true;
    const bound = pool.resolve();
    expect(bound).not.toBe(unbound);
    expect(optionsOf(bound.httpAgent).localAddress).toBe(CAMPUS_IP);
    expect(optionsOf(bound.httpsAgent).localAddress).toBe(CAMPUS_IP);
    expect(optionsOf(bound.httpsAgentNoVerify).localAddress).toBe(CAMPUS_IP);
    expect(optionsOf(bound.httpsAgentNoVerify).rejectUnauthorized).toBe(false);
    expect(optionsOf(bound.httpsAgent).rejectUnauthorized).toBeUndefined();
    expect(pool.resolve()).toBe(bound);

    state.enabled = false;
    expect(optionsOf(pool.resolve().httpAgent).localAddress).toBeUndefined();
  });

  it('rebinds after a reset', () => {
    const pool = new IntranetAgentPool(makeMapper({ enabled: true, interfaceIp: CAMPUS_IP }));
    const before = pool.resolve();
    pool.reset();
    const after = pool.resolve();
    expect(after).not.toBe(before);
    expect(optionsOf(after.httpAgent).localAddress).toBe(CAMPUS_IP);
  });
});

describe('createIntranetAxios', () => {
  it('rewrites and preserves Host for an intranet download', () => {
    const bundle = createIntranetAxios({
      intranetMapping: makeMapper({ enabled: true, interfaceIp: null }),
      isIntranetMode: true,
      maxSockets: 4,
    });
    const config = intercept(bundle.instance, 'https://cvideo.yanhekt.cn/a.ts');
    expect(config.url).toBe('https://10.0.34.24/a.ts');
    expect(config.headers['Host']).toBe('cvideo.yanhekt.cn');
    bundle.destroy();
  });

  it('keeps the mode it started with when the setting is switched off mid-download', () => {
    const state = { enabled: true, interfaceIp: null as string | null };
    const bundle = createIntranetAxios({ intranetMapping: makeMapper(state), isIntranetMode: true, maxSockets: 4 });
    state.enabled = false;
    expect(intercept(bundle.instance, 'https://cvideo.yanhekt.cn/a.ts').url).toBe('https://10.0.34.24/a.ts');
    bundle.destroy();
  });

  it('leaves an external download alone even while the setting is on', () => {
    const bundle = createIntranetAxios({
      intranetMapping: makeMapper({ enabled: true, interfaceIp: CAMPUS_IP }),
      isIntranetMode: false,
      maxSockets: 4,
    });
    const config = intercept(bundle.instance, 'https://cvideo.yanhekt.cn/a.ts');
    expect(config.url).toBe('https://cvideo.yanhekt.cn/a.ts');
    expect(config.headers['Host']).toBeUndefined();
    expect(optionsOf(bundle.instance.defaults.httpsAgent).localAddress).toBeUndefined();
    bundle.destroy();
  });

  it('binds an intranet download to the selected interface', () => {
    const bundle = createIntranetAxios({
      intranetMapping: makeMapper({ enabled: true, interfaceIp: CAMPUS_IP }),
      isIntranetMode: true,
      maxSockets: 4,
    });
    const agent = optionsOf(bundle.instance.defaults.httpAgent);
    expect(agent.localAddress).toBe(CAMPUS_IP);
    expect(agent.maxSockets).toBe(4);
    bundle.destroy();
  });
});
