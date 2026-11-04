import { describe, expect, it } from 'vitest';
import type { CasExchange } from '@main/platform/campusSso/casProbe';
import { MAX_BODY_CHARS, formatExchange as redactExchange, redactCookieHeader, redactSetCookie, redactText, redactUrl } from './devSsoRedact';

function exchange(patch: Partial<CasExchange>): CasExchange {
  return { method: 'GET', url: 'https://sso.bit.edu.cn/cas/login', requestHeaders: {}, startedAt: 0, durationMs: 1, ...patch };
}

describe('Developer → SSO redaction', () => {
  it('hides ticket and token query values, keeps the rest', () => {
    expect(redactUrl('https://cbiz.yanhekt.cn/v1/cas/callback?ticket=ST-123-abc&x=1'))
      .toBe('https://cbiz.yanhekt.cn/v1/cas/callback?ticket=•••• (10)&x=1');
    expect(redactUrl('https://www.yanhekt.cn/?token=0123456789abcdef')).toBe('https://www.yanhekt.cn/?token=•••• (16)');
  });

  it('keeps cookie names and attributes only', () => {
    expect(redactCookieHeader('TGC=secret; JSESSIONID=abc')).toBe('TGC=•••• (6); JSESSIONID=•••• (3)');
    expect(redactSetCookie('TGC=secret; Path=/; Max-Age=60')).toBe('TGC=•••• (6); Path=/; Max-Age=60');
  });

  it('hides JWTs inside text', () => {
    expect(redactText('a eyJhbGc.eyJzdWI.sig b')).toBe('a JWT •••• (19) b');
  });

  it('never passes the password, the SMS code or the phone handle through', () => {
    const form = redactExchange(exchange({
      method: 'POST',
      requestBodyKind: 'form',
      requestBody: new URLSearchParams({ username: 'u', password: 'hunter2', type: 'smsLogin' }).toString(),
    }), 1);
    expect(form.requestBody).not.toContain('hunter2');
    expect(form.requestBody).toContain('username=u');

    const json = redactExchange(exchange({
      method: 'POST',
      requestBodyKind: 'json',
      requestBody: JSON.stringify({ phone: 'opaque-handle', token: '123456', delete: false }),
      responseBody: JSON.stringify({ code: 200, data: { tel: '13800000000', maskTel: '138****0000' } }),
    }), 2);
    expect(json.requestBody).not.toContain('opaque-handle');
    expect(json.requestBody).not.toContain('123456');
    expect(json.responseBody).not.toContain('13800000000');
    expect(json.responseBody).toContain('138****0000');
  });

  it('hides cookies and redirect tokens in headers', () => {
    const out = redactExchange(exchange({
      requestHeaders: { Cookie: 'TGC=secret' },
      status: 302,
      responseHeaders: {
        'set-cookie': ['_token=eyJa.eyJb.c; Path=/'],
        location: 'https://www.yanhekt.cn/?token=abcdef0123456789',
      },
    }), 3);
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(JSON.stringify(out)).not.toContain('abcdef0123456789');
    expect(JSON.stringify(out)).not.toContain('eyJa.eyJb.c');
  });

  it('cuts long bodies and says so', () => {
    const out = redactExchange(exchange({ responseBody: 'x'.repeat(MAX_BODY_CHARS + 10) }), 4);
    expect(out.responseBody).toHaveLength(MAX_BODY_CHARS);
    expect(out.responseBodyTruncatedFrom).toBe(MAX_BODY_CHARS + 10);
  });
});
