/**
 * `CasTransport` durability rules.
 *
 * The transport's job during a login is broad — one jar, every host the flow
 * touches. Its job *across* logins is narrow: `exportDurableCookies` feeds
 * `ssoDeviceCookies`, which is replayed on the next attempt, so only the
 * campus SSO hosts may appear there. These tests pin that boundary.
 */
import { describe, it, expect } from 'vitest';
import { CasTransport, keepableDurableCookies } from './casTransport';

/** Reach the private cookie sink without standing up an HTTP server. */
function absorb(transport: CasTransport, requestUrl: string, setCookie: string[]): void {
  (transport as unknown as {
    absorbCookies(response: { headers: Record<string, unknown> }, url: string): void;
  }).absorbCookies({ headers: { 'set-cookie': setCookie } }, requestUrl);
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('CasTransport durable cookies', () => {
  it('keeps an explicitly-lived CAS cookie and its host and expiry', () => {
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    absorb(transport, 'https://sso.bit.edu.cn/cas/login', [
      'SOURCEID_TGC=abc; Domain=.bit.edu.cn; Path=/; Max-Age=604800',
    ]);

    const durable = transport.exportDurableCookies();
    expect(durable).toHaveLength(1);
    expect(durable[0].name).toBe('SOURCEID_TGC');
    expect(durable[0].host).toBe('bit.edu.cn');
    expect(durable[0].value).toBe('abc');
    expect(durable[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('drops session cookies, which have no explicit lifetime', () => {
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    absorb(transport, 'https://sso.bit.edu.cn/cas/login', [
      'JSESSIONID=xyz; Path=/',
      'SOURCEID_TGC=abc; Domain=.bit.edu.cn; Path=/; Max-Age=604800',
    ]);

    expect(transport.exportDurableCookies().map((c) => c.name)).toEqual(['SOURCEID_TGC']);
  });

  it('never persists a durable cookie from a downstream host', () => {
    // The yanhekt callback is the one downstream host every login visits. A
    // cookie it sets — including a long-lived one — must not survive the flow.
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    absorb(transport, 'https://sso.bit.edu.cn/cas/login', [
      'SOURCEID_TGC=abc; Domain=.bit.edu.cn; Path=/; Max-Age=604800',
    ]);
    absorb(transport, 'https://cbiz.yanhekt.cn/v1/cas/callback', [
      'token=bearer-secret; Domain=.yanhekt.cn; Path=/; Max-Age=86400',
      'JWTUser=eyJhbGciOi.payload.sig; Domain=.yanhekt.cn; Path=/; Max-Age=604800',
    ]);

    const durable = transport.exportDurableCookies();
    expect(durable.map((c) => c.name)).toEqual(['SOURCEID_TGC']);
    expect(durable.some((c) => c.value === 'bearer-secret')).toBe(false);
  });

  it('does not let a sibling of an allowed host through by suffix', () => {
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    absorb(transport, 'https://evilbit.edu.cn/', [
      'evil=1; Domain=evilbit.edu.cn; Path=/; Max-Age=604800',
    ]);
    expect(transport.exportDurableCookies()).toHaveLength(0);
  });

  it('ignores a cookie whose Domain the responding host does not belong to', () => {
    // Without this the allowlist would only check what a response *claims*.
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    absorb(transport, 'https://cbiz.yanhekt.cn/v1/cas/callback', [
      'token=bearer-secret; Domain=.bit.edu.cn; Path=/; Max-Age=86400',
    ]);

    expect(transport.exportDurableCookies()).toHaveLength(0);
    expect(
      (transport as unknown as { cookieHeaderFor(url: string): string }).cookieHeaderFor(
        'https://sso.bit.edu.cn/cas/login',
      ),
    ).toBe('');
  });

  it('round-trips a kept cookie back into a fresh transport', () => {
    const first = new CasTransport('https://sso.bit.edu.cn/');
    absorb(first, 'https://sso.bit.edu.cn/cas/login', [
      'SOURCEID_TGC=abc; Domain=.bit.edu.cn; Path=/; Max-Age=604800',
    ]);

    const second = new CasTransport('https://sso.bit.edu.cn/');
    second.seedDurableCookies(first.exportDurableCookies());

    expect(second.exportDurableCookies()).toHaveLength(1);
    expect(
      (second as unknown as { cookieHeaderFor(url: string): string }).cookieHeaderFor(
        'https://sso.bit.edu.cn/cas/login',
      ),
    ).toBe('SOURCEID_TGC=abc');
  });

  it('refuses to seed an expired, malformed, or disallowed cookie', () => {
    const transport = new CasTransport('https://sso.bit.edu.cn/');
    transport.seedDurableCookies([
      { name: 'stale', value: '1', host: 'bit.edu.cn', path: '/', expiresAt: Date.now() - DAY_MS },
      // Rows read off disk may predate the host filter.
      { name: 'legacy', value: '1', host: 'yanhekt.cn', path: '/', expiresAt: Date.now() + DAY_MS },
      {
        name: 'broken',
        value: '1',
        host: 'bit.edu.cn',
        path: '/',
        expiresAt: Number.NaN,
      },
    ]);

    expect(transport.exportDurableCookies()).toHaveLength(0);
  });
});

describe('keepableDurableCookies', () => {
  it('keeps only well-formed, unexpired campus SSO rows', () => {
    const now = Date.now();
    const kept = keepableDurableCookies(
      [
        { name: 'SOURCEID_TGC', value: 'a', host: 'bit.edu.cn', path: '/', expiresAt: now + DAY_MS },
        { name: 'device', value: 'b', host: 'sso.bit.edu.cn', path: '/', expiresAt: now + DAY_MS },
        { name: 'token', value: 'c', host: 'yanhekt.cn', path: '/', expiresAt: now + DAY_MS },
        { name: 'stale', value: 'd', host: 'bit.edu.cn', path: '/', expiresAt: now - 1 },
        { name: 'nan', value: 'e', host: 'bit.edu.cn', path: '/', expiresAt: Number.NaN },
        { name: '', value: 'f', host: 'bit.edu.cn', path: '/', expiresAt: now + DAY_MS },
      ],
      now,
    );

    expect(kept.map((c) => c.name)).toEqual(['SOURCEID_TGC', 'device']);
  });
});
