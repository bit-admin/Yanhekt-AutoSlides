import { beforeEach, describe, expect, it, vi } from 'vitest';

const interfaces = vi.hoisted(() => ({ current: {} as Record<string, unknown[]> }));
vi.mock('node:os', () => ({ default: { networkInterfaces: () => interfaces.current } }));
vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { IntranetMappingService } from './intranetMappingService';
import { isPrivateIPv4, type IntranetProbe } from './intranetProbe';
import type { ConfigService } from './configService';

const VIDEO = 'https://cvideo.yanhekt.cn/a/b.m3u8';

function makeConfig(values: Record<string, unknown>) {
  const set = vi.fn((key: string, value: unknown) => { values[key] = value; });
  const config = { get: (key: string, fallback: unknown) => (key in values ? values[key] : fallback), set };
  return { config: config as unknown as ConfigService, set };
}

/** A campus network described by which addresses answer and what its resolver says. */
function makeProbe(net: { alive: string[]; dns?: Record<string, string[]> }) {
  const probe = {
    resolveHosts: vi.fn(async () => ({ ...(net.dns ?? {}) })),
    isReachable: vi.fn(async (ip: string) => net.alive.includes(ip)),
    measure: vi.fn(async (ip: string) => (net.alive.includes(ip) ? 7 : null)),
  };
  return probe satisfies IntranetProbe;
}

function service(mode: string, net: { alive: string[]; dns?: Record<string, string[]> }, extra: Record<string, unknown> = {}) {
  const { config, set } = makeConfig({ connectionMode: mode, ...extra });
  const probe = makeProbe(net);
  return { svc: new IntranetMappingService(config, probe), probe, set };
}

beforeEach(() => {
  interfaces.current = { en0: [{ address: '192.168.1.5', internal: false, family: 'IPv4' }] };
});

describe('connection modes', () => {
  it('internal always maps, external never does, and neither falls back on its own', async () => {
    const internal = service('internal', { alive: [] }).svc;
    await internal.ensureFresh();
    expect(internal.rewriteUrl(VIDEO)).toBe('https://10.0.34.24/a/b.m3u8');
    expect(internal.route()).toEqual({ intranet: true, publicFallback: false });

    const { svc: external, probe } = service('external', { alive: ['10.0.34.24'] });
    await external.ensureFresh();
    expect(external.rewriteUrl(VIDEO)).toBe(VIDEO);
    expect(external.route()).toEqual({ intranet: false, publicFallback: false });
    expect(probe.isReachable).not.toHaveBeenCalled();
  });

  it('auto follows reachability and may fall back', async () => {
    const on = service('auto', { alive: ['10.0.34.24'] }).svc;
    expect(on.isEnabled()).toBe(false); // nothing is assumed before the first check
    await on.ensureFresh();
    expect(on.route()).toEqual({ intranet: true, publicFallback: true });

    const off = service('auto', { alive: [] }).svc;
    await off.ensureFresh();
    expect(off.route()).toEqual({ intranet: false, publicFallback: true });
    expect(off.rewriteUrl(VIDEO)).toBe(VIDEO);
  });

  it('treats a config with no stored mode as auto', () => {
    const { config } = makeConfig({});
    expect(new IntranetMappingService(config, makeProbe({ alive: [] })).getMode()).toBe('auto');
  });

  it('keeps the API off a dead intranet even when Internal is forced', async () => {
    const dead = service('internal', { alive: [] }).svc;
    await dead.ensureFresh();
    expect(dead.isEnabled()).toBe(true);
    expect(dead.isApiViaIntranet()).toBe(false);

    const live = service('internal', { alive: ['10.0.34.24'] }).svc;
    await live.ensureFresh();
    expect(live.isApiViaIntranet()).toBe(true);
  });
});

describe('addresses', () => {
  it('prefers what the campus resolver says over the built-in table', async () => {
    const { svc } = service('auto', {
      alive: ['10.9.0.1'],
      dns: { 'cvideo.yanhekt.cn': ['10.9.0.1'], 'clive14.yanhekt.cn': ['10.9.0.7'] },
    });
    await svc.ensureFresh();
    expect(svc.isEnabled()).toBe(true);
    expect(svc.mapUrl(VIDEO)).toBe('https://10.9.0.1/a/b.m3u8');
    expect(svc.mapUrl('https://clive14.yanhekt.cn/x')).toBe('https://10.9.0.7/x');
    // A host the resolver did not answer for keeps its built-in address.
    expect(svc.mapUrl('https://clive15.yanhekt.cn/x')).toBe('https://10.0.34.208/x');
    expect(svc.getNetworkStatus().resolvedByCampusDns).toBe(true);
  });

  it('keeps the built-in address when the resolver names a dead one', async () => {
    const { svc } = service('auto', { alive: ['10.0.34.24'], dns: { 'cvideo.yanhekt.cn': ['10.9.0.1'] } });
    await svc.ensureFresh();
    expect(svc.isEnabled()).toBe(true);
    expect(svc.mapUrl(VIDEO)).toBe('https://10.0.34.24/a/b.m3u8');
  });

  it('round-robins a pool and skips an address marked failed', async () => {
    const { svc } = service('internal', { alive: [] });
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) seen.add(new URL(svc.mapUrl('https://clive8.yanhekt.cn/x')).hostname);
    expect(seen.size).toBe(6);

    svc.markIPFailed('10.1.233.208', 'clive8.yanhekt.cn');
    for (let i = 0; i < 12; i++) {
      expect(new URL(svc.mapUrl('https://clive8.yanhekt.cn/x')).hostname).not.toBe('10.1.233.208');
    }
  });

  it('leaves hosts it does not know alone', () => {
    const { svc } = service('internal', { alive: [] });
    expect(svc.mapUrl('https://sso.bit.edu.cn/cas/login')).toBe('https://sso.bit.edu.cn/cas/login');
  });

  it('maps the Yanhe 2.0 host, whose one address serves API, media and slide images', () => {
    const { svc } = service('internal', { alive: [] });
    expect(svc.mapUrl('https://aita.yanhekt.cn/play/2/x/Video1.m3u8?t=1')).toBe('https://10.0.11.240/play/2/x/Video1.m3u8?t=1');
    expect(svc.mapUrl('https://aita.yanhekt.cn/userapi/v1/infosimple')).toBe('https://10.0.11.240/userapi/v1/infosimple');
    expect(svc.getMappings()['aita.yanhekt.cn']).toEqual({ type: 'single', ip: '10.0.11.240' });
  });

  it('only accepts private addresses from the resolver', () => {
    expect(isPrivateIPv4('10.0.34.24')).toBe(true);
    expect(isPrivateIPv4('172.20.1.1')).toBe(true);
    expect(isPrivateIPv4('192.168.3.4')).toBe(true);
    expect(isPrivateIPv4('183.243.192.45')).toBe(false);
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateIPv4('not-an-ip')).toBe(false);
  });
});

describe('address test', () => {
  it('times every address of a domain and reports the silent ones', async () => {
    const { svc, probe } = service('external', { alive: ['10.0.34.22'] });
    expect(await svc.probeDomain('cbiz.yanhekt.cn')).toEqual([
      { ip: '10.0.34.22', ms: 7 },
      { ip: '10.0.34.21', ms: null },
    ]);
    expect(probe.measure).toHaveBeenCalledWith('10.0.34.22', 'cbiz.yanhekt.cn', '');
    expect(await svc.probeDomain('example.com')).toEqual([]);
  });
});

describe('freshness', () => {
  it('checks once, then again when the machine\'s interfaces change', async () => {
    const { svc, probe } = service('auto', { alive: [] });
    await svc.ensureFresh();
    await svc.ensureFresh();
    expect(probe.resolveHosts).toHaveBeenCalledTimes(1);

    interfaces.current = { en1: [{ address: '10.62.1.7', internal: false, family: 'IPv4' }] };
    await svc.ensureFresh();
    expect(probe.resolveHosts).toHaveBeenCalledTimes(2);
  });

  it('re-checks after a reported failure, but not for every request of a burst', async () => {
    const net = { alive: ['10.0.34.24'] };
    const { svc, probe } = service('auto', net);
    await svc.ensureFresh();
    expect(svc.isEnabled()).toBe(true);

    svc.reportFailure(); // within seconds of the last check: ignored
    expect(probe.resolveHosts).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 10_000);
      net.alive = [];
      const changed = vi.fn();
      svc.on('routeChanged', changed);
      svc.reportFailure();
      svc.reportFailure();
      await svc.refresh();
      expect(probe.resolveHosts).toHaveBeenCalledTimes(2);
      expect(svc.isEnabled()).toBe(false);
      expect(changed).toHaveBeenCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('binds its own checks to the selected interface when it is present', async () => {
    interfaces.current = { en1: [{ address: '192.168.31.58', internal: false, family: 'IPv4' }] };
    const { svc, probe } = service('auto', { alive: ['10.0.34.24'] }, { intranetInterfaceIp: '192.168.31.58' });
    await svc.ensureFresh();
    expect(probe.isReachable).toHaveBeenCalledWith('10.0.34.24', 'cvideo.yanhekt.cn', '192.168.31.58');
  });
});

describe('command line pin', () => {
  it('overrides the saved mode and interface without writing config', async () => {
    const { svc, set } = service('internal', { alive: [] }, { intranetInterfaceIp: '192.168.31.58' });
    svc.pinForThisProcess('external');
    expect(svc.rewriteUrl(VIDEO)).toBe(VIDEO);
    expect(svc.getInterfaceIp()).toBe('192.168.31.58');

    svc.pinForThisProcess('internal', '10.62.1.7');
    expect(svc.rewriteUrl(VIDEO)).toBe('https://10.0.34.24/a/b.m3u8');
    expect(svc.getInterfaceIp()).toBe('10.62.1.7');

    // A later settings broadcast cannot undo the flags.
    svc.setMode('auto');
    expect(svc.getMode()).toBe('internal');
    expect(set).not.toHaveBeenCalled();
  });
});
