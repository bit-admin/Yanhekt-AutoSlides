import { describe, expect, it, vi } from 'vitest';
import { buildCossListUrl, resolveShareImages } from './shareResolve';
import type { SharePayload } from './shareLink';

const root = 'https://coss.yanhekt.cn/images';

describe('buildCossListUrl', () => {
  it('lists a whole folder page by page', () => {
    expect(buildCossListUrl('2026/1', null)).toBe(`${root}?list-type=2&prefix=2026%2F1%2F&max-keys=1000`);
    expect(buildCossListUrl('2026/1/', 'next')).toBe(`${root}?list-type=2&prefix=2026%2F1%2F&max-keys=1000&continuation-token=next`);
  });

  it('asks for one hash as a key prefix, one key, no continuation', () => {
    expect(buildCossListUrl('2026/1', 'next', 'abcdef0')).toBe(`${root}?list-type=2&prefix=2026%2F1%2Fabcdef0&max-keys=1`);
  });
});

describe('resolveShareImages', () => {
  const key = (hash: string) => `2026/1/${hash}${'0'.repeat(32 - hash.length)}.png`;

  it('passes a folder its one distinct hash, and several hashes none', async () => {
    const payload: SharePayload = { v: 2, p: '2026/1', n: 7, h: 'aaaaaaaaaaaaaa' + 'bbbbbbb', o: { '2': '2026/2' } };
    const lister = vi.fn(async (prefix: string) =>
      new Map(prefix === '2026/1'
        ? [[`${'a'.repeat(7)}${'0'.repeat(25)}.png`, key('aaaaaaa')]]
        : [[`${'b'.repeat(7)}${'0'.repeat(25)}.png`, `2026/2/${'b'.repeat(7)}${'0'.repeat(25)}.png`]]));

    const resolved = await resolveShareImages(payload, lister);

    expect(lister.mock.calls.sort()).toEqual([['2026/1', 'aaaaaaa'], ['2026/2', 'bbbbbbb']]);
    expect(resolved.map((r) => r.url)).toEqual([
      `${root}/${key('aaaaaaa')}`,
      `${root}/${key('aaaaaaa')}`,
      `${root}/2026/2/${'b'.repeat(7)}${'0'.repeat(25)}.png`,
    ]);
  });

  it('shares one listing between the hashes of a folder', async () => {
    const payload: SharePayload = { v: 2, p: '2026/1', n: 7, h: 'aaaaaaabbbbbbb' };
    const lister = vi.fn(async () => new Map<string, string>());
    await resolveShareImages(payload, lister);
    expect(lister.mock.calls).toEqual([['2026/1', undefined]]);
  });
});
