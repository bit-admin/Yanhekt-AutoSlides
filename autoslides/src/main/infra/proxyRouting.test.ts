import { afterEach, describe, expect, it } from 'vitest';
import {
  childProcessEnv,
  configureProxy,
  hostGroup,
  modeForGroup,
  parsePacResult,
  proxyForUrl,
  setSystemProxyResolver,
} from './proxyRouting';
import { normalizeProxyUrl, parseProxyUrl } from '@common/proxyUrl';

const ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'ALL_PROXY', 'all_proxy'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  configureProxy({ campus: 'direct', other: 'direct', customUrl: '' });
  setSystemProxyResolver(null);
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('hostGroup', () => {
  it('puts Yanhekt, Yanhe 2.0 and campus sign-in in the campus group', () => {
    for (const host of ['cbiz.yanhekt.cn', 'aita.yanhekt.cn', 'cvideo.yanhekt.cn', 'yanhekt.cn', 'sso.bit.edu.cn', 'login.bit.edu.cn', 'CBIZ.YANHEKT.CN.']) {
      expect(hostGroup(host)).toBe('campus');
    }
  });

  it('puts everything else in the other group', () => {
    for (const host of ['openai.ruc.edu.kg', 'share.ruc.edu.kg', 'github.com', 'api.notion.com', 'notyanhekt.cn', 'yanhekt.cn.evil.com', '8.8.8.8']) {
      expect(hostGroup(host)).toBe('other');
    }
  });

  it('treats this machine and private addresses as local', () => {
    for (const host of ['localhost', '127.0.0.1', '10.0.11.240', '172.20.1.1', '192.168.1.5', '[::1]', 'fd00::1', '169.254.1.1']) {
      expect(hostGroup(host)).toBe('local');
    }
    expect(modeForGroup('local', { campus: 'custom', other: 'custom', customUrl: 'http://p:1' })).toBe('direct');
  });
});

describe('parsePacResult', () => {
  it('reads the first entry', () => {
    expect(parsePacResult('DIRECT')).toBeNull();
    expect(parsePacResult('PROXY 127.0.0.1:7890; DIRECT')).toBe('http://127.0.0.1:7890');
    expect(parsePacResult('HTTPS proxy.example:443')).toBe('https://proxy.example:443');
    expect(parsePacResult('SOCKS5 127.0.0.1:7891')).toBe('socks5://127.0.0.1:7891');
    expect(parsePacResult('SOCKS 127.0.0.1:1080')).toBe('socks4://127.0.0.1:1080');
    expect(parsePacResult('')).toBeNull();
  });
});

describe('parseProxyUrl', () => {
  it('accepts http, https and socks with host and port', () => {
    expect(normalizeProxyUrl('127.0.0.1:7890')).toBe('http://127.0.0.1:7890');
    expect(normalizeProxyUrl(' socks5://127.0.0.1:7891 ')).toBe('socks5://127.0.0.1:7891');
    expect(normalizeProxyUrl('http://user:pa%40ss@proxy.example:8080/')).toBe('http://user:pa%40ss@proxy.example:8080');
  });

  it('refuses anything else', () => {
    for (const bad of ['', 'ftp://x:1', 'http://x:1/path', 'http://x:1?q', 'http://', 'not a url']) {
      expect(parseProxyUrl(bad)).toBeNull();
    }
  });
});

describe('proxyForUrl', () => {
  it('connects directly until main applies settings', async () => {
    process.env.HTTPS_PROXY = 'http://env-proxy:1';
    expect(await proxyForUrl('https://openai.ruc.edu.kg/v1')).toBeNull();
  });

  it('applies each group its own setting', async () => {
    configureProxy({ campus: 'direct', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    expect(await proxyForUrl('https://cbiz.yanhekt.cn/v1/user')).toBeNull();
    expect(await proxyForUrl('https://openai.ruc.edu.kg/v1')).toBe('http://127.0.0.1:7890');

    configureProxy({ campus: 'custom', other: 'direct', customUrl: 'socks5://127.0.0.1:7891' });
    expect(await proxyForUrl('https://sso.bit.edu.cn/cas/login')).toBe('socks5://127.0.0.1:7891');
    expect(await proxyForUrl('https://github.com/')).toBeNull();
  });

  it('never proxies a private or loopback address (issue #44)', async () => {
    configureProxy({ campus: 'custom', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    process.env.HTTPS_PROXY = 'http://env-proxy:1';
    expect(await proxyForUrl('https://10.0.11.240/play/a.m3u8')).toBeNull();
    expect(await proxyForUrl('http://localhost:11434/v1/chat')).toBeNull();
  });

  it('connects directly when the custom address is not usable', async () => {
    configureProxy({ campus: 'custom', other: 'custom', customUrl: 'nope://' });
    expect(await proxyForUrl('https://github.com/')).toBeNull();
  });

  it('system mode asks the system first, then the environment', async () => {
    configureProxy({ campus: 'system', other: 'system', customUrl: '' });
    const asked: string[] = [];
    setSystemProxyResolver(async (url) => {
      asked.push(url);
      return url.includes('github') ? 'PROXY 127.0.0.1:7890; DIRECT' : 'DIRECT';
    });
    process.env.HTTPS_PROXY = 'http://env-proxy:3128';
    process.env.NO_PROXY = '.notion.com';
    expect(await proxyForUrl('https://github.com/a')).toBe('http://127.0.0.1:7890');
    expect(await proxyForUrl('https://openai.ruc.edu.kg/v1')).toBe('http://env-proxy:3128');
    expect(await proxyForUrl('https://api.notion.com/v1')).toBeNull();
    // A second request to the same host is answered from the short cache.
    await proxyForUrl('https://github.com/b');
    expect(asked.filter((u) => u.includes('github'))).toHaveLength(1);
  });

  it('system mode with no resolver reads the environment only', async () => {
    configureProxy({ campus: 'direct', other: 'system', customUrl: '' });
    process.env.HTTPS_PROXY = 'http://env-proxy:3128';
    expect(await proxyForUrl('https://github.com/')).toBe('http://env-proxy:3128');
  });

  it('a failing system lookup falls back to the environment', async () => {
    configureProxy({ campus: 'direct', other: 'system', customUrl: '' });
    setSystemProxyResolver(async () => { throw new Error('no session'); });
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.ALL_PROXY;
    delete process.env.all_proxy;
    expect(await proxyForUrl('https://github.com/')).toBeNull();
  });
});

describe('childProcessEnv', () => {
  it('replaces the proxy variables with the route picked for the URL', async () => {
    process.env.HTTPS_PROXY = 'http://env-proxy:1';
    process.env.http_proxy = 'http://env-proxy:1';
    configureProxy({ campus: 'direct', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    const campus = await childProcessEnv('https://cvideo.yanhekt.cn/a.m3u8');
    expect(campus.HTTPS_PROXY).toBeUndefined();
    expect(campus.http_proxy).toBeUndefined();
    const other = await childProcessEnv('https://cdn.example.com/a.m3u8');
    expect(other.http_proxy).toBe('http://127.0.0.1:7890');
  });
});
