import { describe, expect, it } from 'vitest';
import { cacheKey, isParamError, parseSearchParams, type SearchParams } from './searchParams';

const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs));
const ok = (qs: string) => {
  const r = parse(qs);
  if (isParamError(r)) throw new Error(`${r.error}: ${r.message}`);
  return r as SearchParams;
};
const err = (qs: string) => {
  const r = parse(qs);
  if (!isParamError(r)) throw new Error('expected an error');
  return r;
};
const T = '&term=2026-2027-1';

describe('parseSearchParams', () => {
  it('refuses empty and one-character searches', () => {
    expect(err('').error).toBe('query-required');
    expect(err('q=%20%20' + T).error).toBe('query-required');
    expect(err('q=数' + T).error).toBe('query-too-short');
    expect(ok('q=数学' + T).tokens).toEqual(['数学']);
    // Two characters, but no word long enough to look up.
    expect(err('q=张 王' + T).error).toBe('query-too-short');
    expect(ok('q=数学 张' + T).tokens).toEqual(['数学', '张']);
  });

  it('collapses whitespace, lowercases words and drops repeats', () => {
    const p = ok('q=%20Circuit%20%20analysis%20circuit%20' + T);
    expect(p.q).toBe('Circuit analysis circuit');
    expect(p.tokens).toEqual(['circuit', 'analysis']);
    expect(ok('q=Java程序设计' + T).tokens).toEqual(['java', '程序设计']);
  });

  it('caps length and word count', () => {
    expect(err(`q=${'a'.repeat(65)}${T}`).error).toBe('query-too-long');
    expect(err('q=a1 b2 c3 d4 e5 f6 g7' + T).error).toBe('query-too-long');
  });

  it('turns a pasted course link into its id and refuses session links', () => {
    expect(ok('q=' + encodeURIComponent('https://www.yanhekt.cn/course/12345?x=1') + T).q).toBe('12345');
    expect(err('q=' + encodeURIComponent('https://www.yanhekt.cn/session/100002') + T)).toMatchObject({ error: 'bad-param', param: 'q' });
  });

  it('requires exactly one term', () => {
    expect(err('q=数学')).toMatchObject({ error: 'term-required', param: 'term' });
    expect(err('q=数学&term=2026-2027-1,2025-2026-2').param).toBe('term');
    expect(err('q=数学&term=2026-2027-1&term=2025-2026-2').param).toBe('term');
    expect(err('q=数学&term=40').param).toBe('term');
    expect(ok('q=数学&term=2026-2027-1&term=2026-2027-1').term).toBe('2026-2027-1');
  });

  it('needs no term when q is a course id, a course link or a registrar code', () => {
    expect(ok('q=12345').term).toBeNull();
    expect(ok('q=' + encodeURIComponent('https://www.yanhekt.cn/course/12345')).term).toBeNull();
    expect(ok('q=202620271MTH1000112').term).toBeNull();
    expect(ok('q=20261-17-1709901-1781234567890').term).toBeNull();
    expect(err('q=programming').error).toBe('term-required'); // long, but no digit
    expect(err('q=数学 12345').error).toBe('term-required');
  });

  it('ignores unknown parameters', () => {
    expect(ok('q=数学&limit=999&sort=x' + T).q).toBe('数学');
  });
});

describe('cacheKey', () => {
  it('is the same for equivalent requests and changes with the data version', () => {
    const a = cacheKey('https://x', ok('q=数学%20%20分析' + T), '1');
    const b = cacheKey('https://x', ok('limit=3&q=数学 分析' + T), '1');
    expect(a).toBe(b);
    expect(cacheKey('https://x', ok('q=数学 分析' + T), '2')).not.toBe(a);
    expect(cacheKey('https://x', ok('q=12345'), '1')).toBe('https://x/api/search?q=12345&v=1');
  });
});
