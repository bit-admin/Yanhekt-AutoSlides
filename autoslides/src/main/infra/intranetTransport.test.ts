import { beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import net, { type AddressInfo, type Socket } from 'node:net';
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

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
  intranetRequest,
  isConnectionFailure,
  isUnsentFailure,
  CONNECT_TIMEOUT_CODE,
  type IntranetUrlMapper,
} from './intranetTransport';

const CAMPUS_IP = '10.62.1.7';

function nic(address: string) {
  return { address, internal: false, family: 'IPv4' };
}

function makeMapper(state: { enabled: boolean; interfaceIp: string | null }) {
  const mapUrl = (url: string) => url.replace('cvideo.yanhekt.cn', '10.0.34.24');
  return {
    isEnabled: () => state.enabled,
    getInterfaceIp: () => state.interfaceIp,
    mapUrl,
    rewriteUrl: (url: string) => (state.enabled ? mapUrl(url) : url),
    reportFailure: vi.fn(),
  } satisfies IntranetUrlMapper;
}

/** What the network would say: a refused connection for intranet IPs in `dead`, 200 otherwise. */
function fakeNetwork(dead: (url: string) => boolean) {
  const seen: Array<{ url: string; host?: string }> = [];
  const adapter: AxiosAdapter = async (config) => {
    const url = String(config.url);
    seen.push({ url, host: config.headers.get('Host') as string | undefined });
    if (dead(url)) throw new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', config);
    return { data: 'ok', status: 200, statusText: 'OK', headers: {}, config };
  };
  return { adapter, seen };
}

const viaIp = (url: string) => url.includes('10.0.34.24');

type Interceptors = { forEach(fn: (h: { fulfilled?: (c: InternalAxiosRequestConfig) => unknown }) => void): void };

/** Run a request config through the instance's request interceptors. */
function intercept(instance: ReturnType<typeof createIntranetAxios>['instance'], url: string) {
  let config = { url, headers: new AxiosHeaders() } as unknown as InternalAxiosRequestConfig;
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
    // Mapped campus nodes serve valid certificates; verification stays on.
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

  it('times the connecting only: a slow answer is kept, a connection that never completes is not', async () => {
    const pool = new IntranetAgentPool(makeMapper({ enabled: false, interfaceIp: null }), { connectTimeoutMs: 60 });
    const { httpAgent, httpsAgent } = pool.resolve();

    // Answers well after the connect limit.
    const slow = http.createServer((_req, res) => setTimeout(() => res.end('late'), 200));
    // Accepts the TCP connection and never speaks TLS, like an address that swallows packets.
    const held = new Set<Socket>();
    const mute = net.createServer((socket) => held.add(socket));
    await new Promise<void>((resolve) => slow.listen(0, '127.0.0.1', resolve));
    await new Promise<void>((resolve) => mute.listen(0, '127.0.0.1', resolve));
    try {
      const answer = await axios.get<string>(`http://127.0.0.1:${(slow.address() as AddressInfo).port}/`, { httpAgent });
      expect(answer.data).toBe('late');

      const failure = await axios
        .get(`https://127.0.0.1:${(mute.address() as AddressInfo).port}/`, { httpsAgent, timeout: 5000 })
        .catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: CONNECT_TIMEOUT_CODE });
      // Nothing was sent, so even a write may be retried elsewhere.
      expect(isUnsentFailure(failure)).toBe(true);
    } finally {
      pool.reset();
      for (const socket of held) socket.destroy();
      slow.close();
      mute.close();
    }
  });

  it('closeIdle closes free sockets and leaves a request in flight alone', async () => {
    let releaseSlow: () => void = () => undefined;
    const sockets = new Set<Socket>();
    const server = http.createServer((req, res) => {
      if (req.url === '/slow') releaseSlow = () => res.end('slow');
      else res.end('fast');
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    const pool = new IntranetAgentPool(makeMapper({ enabled: false, interfaceIp: null }));
    const { httpAgent } = pool.resolve();
    try {
      const slow = axios.get<string>(`${base}/slow`, { httpAgent });
      await axios.get(`${base}/fast`, { httpAgent });
      await vi.waitFor(() => expect(sockets.size).toBe(2));

      pool.closeIdle();
      await vi.waitFor(() => expect(sockets.size).toBe(1));

      releaseSlow();
      expect((await slow).data).toBe('slow');
      expect(pool.resolve().httpAgent).toBe(httpAgent);
    } finally {
      pool.reset();
      server.close();
    }
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
    expect(config.headers.get('Host')).toBe('cvideo.yanhekt.cn');
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
    expect(config.headers.get('Host')).toBeUndefined();
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

  it('fails like before when fallback is off, and reports the dead address', async () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    const net = fakeNetwork(viaIp);
    const bundle = createIntranetAxios({ intranetMapping: mapper, isIntranetMode: true, maxSockets: 4 });
    bundle.instance.defaults.adapter = net.adapter;
    await expect(bundle.instance.get('https://cvideo.yanhekt.cn/a.ts')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(net.seen).toHaveLength(1);
    expect(mapper.reportFailure).toHaveBeenCalledTimes(1);
    bundle.destroy();
  });

  it('retries a dead intranet address on the public host, then stays there', async () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    const net = fakeNetwork(viaIp);
    const bundle = createIntranetAxios({
      intranetMapping: mapper,
      isIntranetMode: true,
      publicFallback: true,
      maxSockets: 4,
    });
    bundle.instance.defaults.adapter = net.adapter;

    for (let i = 0; i < 3; i++) {
      const res = await bundle.instance.get(`https://cvideo.yanhekt.cn/${i}.ts`);
      expect(res.status).toBe(200);
    }
    // Each of the first three tried the intranet, then the public host without the forced Host.
    expect(net.seen.map((r) => r.url)).toEqual([
      'https://10.0.34.24/0.ts', 'https://cvideo.yanhekt.cn/0.ts',
      'https://10.0.34.24/1.ts', 'https://cvideo.yanhekt.cn/1.ts',
      'https://10.0.34.24/2.ts', 'https://cvideo.yanhekt.cn/2.ts',
    ]);
    expect(net.seen[1].host).toBeUndefined();

    // After three failures in a row the download no longer tries the intranet.
    await bundle.instance.get('https://cvideo.yanhekt.cn/3.ts');
    expect(net.seen.at(-1)?.url).toBe('https://cvideo.yanhekt.cn/3.ts');
    expect(net.seen).toHaveLength(7);
    bundle.destroy();
  });

  it('does not treat an HTTP error status as a dead route', async () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    const seen: string[] = [];
    const bundle = createIntranetAxios({ intranetMapping: mapper, isIntranetMode: true, publicFallback: true, maxSockets: 4 });
    bundle.instance.defaults.adapter = async (config) => {
      seen.push(String(config.url));
      return { data: '', status: 403, statusText: 'Forbidden', headers: {}, config };
    };
    const res = await bundle.instance.get('https://cvideo.yanhekt.cn/a.ts', { validateStatus: null });
    expect(res.status).toBe(403);
    expect(seen).toEqual(['https://10.0.34.24/a.ts']);
    expect(mapper.reportFailure).not.toHaveBeenCalled();
    bundle.destroy();
  });
});

describe('intranetRequest', () => {
  const agents = () => new IntranetAgentPool(makeMapper({ enabled: false, interfaceIp: null })).resolve();
  const original = axios.defaults.adapter;
  const useNetwork = (dead: (url: string) => boolean) => {
    const net = fakeNetwork(dead);
    axios.defaults.adapter = net.adapter;
    return net;
  };

  beforeEach(() => {
    axios.defaults.adapter = original;
  });

  it('sends a mapped URL to its intranet address with the original Host', async () => {
    const net = useNetwork(() => false);
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    await intranetRequest({ method: 'GET', url: 'https://cvideo.yanhekt.cn/a.m3u8' }, { mapper, agents: agents(), publicFallback: true });
    expect(net.seen).toEqual([{ url: 'https://10.0.34.24/a.m3u8', host: 'cvideo.yanhekt.cn' }]);
  });

  it('goes straight to the public host while the route is off', async () => {
    const net = useNetwork(() => false);
    const mapper = makeMapper({ enabled: false, interfaceIp: null });
    await intranetRequest({ method: 'GET', url: 'https://cvideo.yanhekt.cn/a.m3u8' }, { mapper, agents: agents(), publicFallback: true });
    expect(net.seen.map((r) => r.url)).toEqual(['https://cvideo.yanhekt.cn/a.m3u8']);
  });

  it('falls back to the public host only when allowed', async () => {
    const mapper = makeMapper({ enabled: true, interfaceIp: null });
    let net = useNetwork(viaIp);
    const res = await intranetRequest({ method: 'GET', url: 'https://cvideo.yanhekt.cn/a.m3u8' }, { mapper, agents: agents(), publicFallback: true });
    expect(res.status).toBe(200);
    expect(net.seen.map((r) => r.url)).toEqual(['https://10.0.34.24/a.m3u8', 'https://cvideo.yanhekt.cn/a.m3u8']);
    expect(mapper.reportFailure).toHaveBeenCalledTimes(1);

    net = useNetwork(viaIp);
    await expect(
      intranetRequest({ method: 'GET', url: 'https://cvideo.yanhekt.cn/a.m3u8' }, { mapper, agents: agents(), publicFallback: false })
    ).rejects.toSatisfy(isConnectionFailure);
    expect(net.seen).toHaveLength(1);
  });
});
