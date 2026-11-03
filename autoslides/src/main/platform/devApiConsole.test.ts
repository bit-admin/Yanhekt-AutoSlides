import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0', isPackaged: false } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { isYanhektApiUrl } from '@common/devApi';
import { DevApiConsole, buildDevApiHeaders, maskSentHeaders } from './devApiConsole';
import type { IntranetApiTransport } from './intranetApiTransport';

const TOKEN = '0123456789abcdef0123456789abcdef';
const base = { method: 'GET' as const, url: 'https://cbiz.yanhekt.cn/v1/user', headers: [], clientHeaders: true };

describe('buildDevApiHeaders', () => {
  it('adds the client headers, the signature and the Bearer', () => {
    const h = buildDevApiHeaders({ ...base, token: TOKEN }, 1700000000);
    expect(h['Xclient-Signature']).toBe('72b77856f6df3f563ab6e658631cac3d');
    expect(h['Xclient-Timestamp']).toBe('1700000000');
    expect(h.Origin).toBe('https://www.yanhekt.cn');
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
    // One spelling of Xdomain-Client, not two.
    expect(Object.keys(h).filter((k) => k.toLowerCase() === 'xdomain-client')).toHaveLength(1);
  });

  it('sends no token and no client headers when asked not to', () => {
    const h = buildDevApiHeaders({ ...base, clientHeaders: false, token: '  ' }, 1);
    expect(h).toEqual({});
  });

  it('lets an extra header replace a client header of any casing', () => {
    const h = buildDevApiHeaders({ ...base, headers: [{ key: 'origin', value: 'https://x' }] }, 1);
    expect(h.origin).toBe('https://x');
    expect(h.Origin).toBeUndefined();
  });

  it('marks a write body as JSON', () => {
    const h = buildDevApiHeaders({ ...base, method: 'PUT', body: '{"a":1}', clientHeaders: false }, 1);
    expect(h['Content-Type']).toBe('application/json');
  });
});

describe('maskSentHeaders', () => {
  it('masks the Bearer only', () => {
    expect(maskSentHeaders({ Authorization: `Bearer ${TOKEN}`, Origin: 'o' })).toEqual({
      Authorization: 'Bearer 0123…cdef',
      Origin: 'o',
    });
  });
});

describe('isYanhektApiUrl', () => {
  it.each([
    ['https://cbiz.yanhekt.cn/v1/user', true],
    ['https://aita.yanhekt.cn/x', true],
    ['http://cbiz.yanhekt.cn/v1/user', false],
    ['https://cbiz.yanhekt.cn.evil.com/', false],
    ['https://example.com/', false],
    ['not a url', false],
  ])('%s → %s', (url, ok) => {
    expect(isYanhektApiUrl(url)).toBe(ok);
  });
});

describe('DevApiConsole.send', () => {
  const transport = (send: ReturnType<typeof vi.fn>) => ({ send }) as unknown as IntranetApiTransport;

  it('refuses while developer mode is off, without sending', async () => {
    const send = vi.fn();
    const result = await new DevApiConsole(transport(send), () => false).send(base);
    expect(result.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a host outside yanhekt.cn', async () => {
    const send = vi.fn();
    const result = await new DevApiConsole(transport(send), () => true).send({ ...base, url: 'https://example.com/' });
    expect(result.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('returns the raw text and masked headers', async () => {
    const send = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, data: '{"code":0}' });
    const result = await new DevApiConsole(transport(send), () => true).send({ ...base, token: TOKEN });
    expect(send.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(result).toMatchObject({ ok: true, status: 200, body: '{"code":0}', size: 10 });
    if (result.ok) expect(result.sentHeaders.Authorization).toBe('Bearer 0123…cdef');
  });

  it('reports a request with no answer', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' }));
    const result = await new DevApiConsole(transport(send), () => true).send(base);
    expect(result).toMatchObject({ ok: false, error: 'ECONNABORTED: timeout of 30000ms exceeded' });
  });
});
