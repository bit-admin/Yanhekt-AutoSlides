import { describe, expect, it } from 'vitest';
import { buildUrl, parseQuery, readEnvelope, toCurl } from './useApiLab';
import { YANHEKT_API_PRESETS, presetUrl } from './yanhektApiPresets';

describe('query round trip', () => {
  it('parses half-typed and encoded queries', () => {
    expect(parseQuery('a=1&b=&c&d=%E6%B3%9B+x')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
      { key: 'c', value: '' },
      { key: 'd', value: '泛 x' },
    ]);
    expect(parseQuery('bad=%E0')).toEqual([{ key: 'bad', value: '%E0' }]);
  });

  it('builds only enabled, named rows', () => {
    expect(buildUrl('https://h/p', [
      { key: 'id', value: '1', enabled: true },
      { key: 'off', value: 'x', enabled: false },
      { key: ' ', value: 'y', enabled: true },
      { key: 'kw', value: '泛函', enabled: true },
    ])).toBe('https://h/p?id=1&kw=%E6%B3%9B%E5%87%BD');
    expect(buildUrl('https://h/p', [])).toBe('https://h/p');
  });
});

describe('readEnvelope', () => {
  it('names a known code, string or number', () => {
    expect(readEnvelope('{"code":"61101113","message":"用户未登录"}')).toMatchObject({ code: '61101113', meaning: expect.stringContaining('Not signed in') });
    expect(readEnvelope('{"code":0}')).toMatchObject({ code: '0', meaning: 'OK' });
    expect(readEnvelope('<html>')).toBeNull();
    expect(readEnvelope('[]')).toBeNull();
  });
});

describe('toCurl', () => {
  it('never prints the token', () => {
    const out = toCurl('PUT', "https://h/p?a='b'", { Authorization: 'Bearer 0123…cdef' }, '{"x":1}');
    expect(out).toContain('$YANHEKT_TOKEN');
    expect(out).not.toContain('0123');
    expect(out).toContain(`'https://h/p?a='\\''b'\\'''`);
    expect(out).toContain('--data-raw');
  });
});

describe('presets', () => {
  it('have unique ids and cbiz URLs', () => {
    const ids = YANHEKT_API_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of YANHEKT_API_PRESETS) {
      expect(presetUrl(p).startsWith('https://cbiz.yanhekt.cn/v')).toBe(true);
      if (p.body) expect(() => JSON.parse(p.body as string)).not.toThrow();
      if (p.write) expect(p.method).not.toBe('GET');
    }
  });
});
