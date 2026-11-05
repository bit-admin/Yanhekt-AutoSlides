import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { createHttpClient, httpClient, httpFetch } from './http';
import { configureProxy } from './proxyRouting';

afterEach(() => {
  configureProxy({ campus: 'direct', other: 'direct', customUrl: '' });
});

/** Answers every request with 200 and keeps the config each one was sent with. */
function recorder() {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    return { data: new ArrayBuffer(0), status: 200, statusText: 'OK', headers: {}, config };
  };
  return { adapter, seen };
}

describe('request routing', () => {
  it('never lets axios read the proxy from the environment', async () => {
    const client = createHttpClient();
    const net = recorder();
    client.defaults.adapter = net.adapter;
    await client.get('https://github.com/');
    expect(net.seen[0].proxy).toBe(false);
    expect(net.seen[0].httpsAgent).toBeUndefined();
  });

  it('gives a proxied request the proxy agents and leaves a direct one alone', async () => {
    configureProxy({ campus: 'direct', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    const client = createHttpClient();
    const net = recorder();
    client.defaults.adapter = net.adapter;
    await client.get('https://openai.ruc.edu.kg/model');
    await client.get('https://cbiz.yanhekt.cn/v1/user');
    expect(net.seen[0].httpsAgent?.constructor.name).toBe('HttpsProxyAgent');
    expect(net.seen[1].httpsAgent).toBeUndefined();
  });

  it('sends a request rewritten onto a campus address directly, whatever the settings (issue #44)', async () => {
    configureProxy({ campus: 'custom', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    const client = createHttpClient();
    const net = recorder();
    client.defaults.adapter = net.adapter;
    const bound = new http.Agent();
    // A public address too: the Host header alone marks the rewrite.
    await client.get('https://203.0.113.9/play/a.m3u8', { headers: { Host: 'aita.yanhekt.cn' }, httpAgent: bound });
    expect(net.seen[0].httpAgent).toBe(bound);
    expect(net.seen[0].proxy).toBe(false);
  });

  it('routes the URL a later interceptor rewrote, not the one the caller named', async () => {
    configureProxy({ campus: 'direct', other: 'custom', customUrl: 'http://127.0.0.1:7890' });
    const client = createHttpClient();
    const net = recorder();
    client.defaults.adapter = net.adapter;
    client.interceptors.request.use((config) => ({ ...config, url: 'https://github.com/' }));
    await client.get('https://cbiz.yanhekt.cn/');
    expect(net.seen[0].url).toBe('https://github.com/');
    expect(net.seen[0].httpsAgent?.constructor.name).toBe('HttpsProxyAgent');
  });
});

describe('httpFetch', () => {
  const original = httpClient.defaults.adapter;
  afterEach(() => {
    httpClient.defaults.adapter = original;
  });

  it('resolves for any status and encodes a body as fetch would', async () => {
    let sent: InternalAxiosRequestConfig | null = null;
    httpClient.defaults.adapter = async (config) => {
      sent = config;
      return { data: new TextEncoder().encode('{"error":"nope"}').buffer, status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/json', 'set-cookie': ['a=1', 'b=2'] }, config };
    };
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'Slide_1.png');
    const res = await httpFetch('https://api.notion.com/v1/file_uploads/x/send', { method: 'POST', body: form, headers: { Authorization: 'Bearer t' } });
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
    expect(await res.json()).toEqual({ error: 'nope' });
    expect(res.headers.get('set-cookie')).toContain('a=1');
    const config = sent as unknown as InternalAxiosRequestConfig;
    expect(String(config.headers.get('content-type'))).toMatch(/^multipart\/form-data; boundary=/);
    expect(config.headers.get('authorization')).toBe('Bearer t');
    expect(Buffer.isBuffer(config.data)).toBe(true);
  });
});

describe('through a real proxy', () => {
  it('tunnels an http request through a CONNECT proxy', async () => {
    const target = http.createServer((req, res) => res.end(`hello ${req.headers.host}`));
    await new Promise<void>((r) => target.listen(0, '127.0.0.1', r));
    const targetPort = (target.address() as AddressInfo).port;
    const tunnels: string[] = [];
    const proxy = http.createServer();
    proxy.on('connect', (req, socket) => {
      tunnels.push(String(req.url));
      // Any host: the test target stands in for it.
      const upstream = net.connect(targetPort, '127.0.0.1', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on('error', () => socket.destroy());
    });
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
    const proxyPort = (proxy.address() as AddressInfo).port;
    try {
      configureProxy({ campus: 'direct', other: 'custom', customUrl: `127.0.0.1:${proxyPort}` });
      const res = await httpClient.get<string>(`http://example.test:${targetPort}/`, { responseType: 'text' });
      expect(res.data).toBe(`hello example.test:${targetPort}`);
      expect(tunnels).toEqual([`example.test:${targetPort}`]);
    } finally {
      configureProxy({ campus: 'direct', other: 'direct', customUrl: '' });
      proxy.close();
      target.close();
    }
  });
});
