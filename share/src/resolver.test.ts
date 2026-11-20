import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharePayload } from './lib/shareLink';
import { resolveImages } from './resolver';

const imageRoot = 'https://coss.yanhekt.cn/images';
const payload: SharePayload = { v: 2, p: '2026/11', n: 7, h: 'aaaaaaa' };
const fetchList = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>();
const listPage = (keys: string[], nextToken?: string) => Response.json({ keys, nextToken });
const queried = () => fetchList.mock.calls.map(([url]) => Object.fromEntries(url.searchParams));

beforeEach(() => {
  fetchList.mockReset();
  vi.stubGlobal('__DEMO__', false);
  vi.stubGlobal('fetch', fetchList);
  // The Node test environment has no DOMParser. Stub the DOM lookups; these
  // tests exercise the request strategy and how returned keys resolve.
  vi.stubGlobal('DOMParser', class {
    parseFromString(body: string) {
      const { keys, nextToken } = JSON.parse(body) as { keys: string[]; nextToken?: string };
      return {
        querySelectorAll: () => keys.map((key) => ({ querySelector: () => ({ textContent: key }) })),
        querySelector: (name: string) => ({ textContent: name === 'IsTruncated' ? String(!!nextToken) : nextToken }),
      };
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('viewer COSS lookups', () => {
  it('looks up one hash by its full key prefix, reusing the result for repeated slides', async () => {
    const key = '2026/11/aaaaaaa0000000000000000000000000.png';
    fetchList.mockResolvedValueOnce(listPage([key], 'another-match'));

    const slides = await resolveImages({ ...payload, h: payload.h.repeat(2) });

    expect(queried()).toEqual([{ 'list-type': '2', prefix: '2026/11/aaaaaaa', 'max-keys': '1' }]);
    expect(fetchList.mock.calls[0][1]).toEqual({ credentials: 'omit' });
    expect(slides.map(({ index, url }) => [index, url])).toEqual([[0, `${imageRoot}/${key}`], [1, `${imageRoot}/${key}`]]);
  });

  it('does not scan the folder when a targeted lookup has no match', async () => {
    fetchList.mockResolvedValueOnce(listPage([]));

    expect(await resolveImages(payload)).toMatchObject([{ index: 0, url: null }]);
    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('paginates one shared listing for multiple hashes and targets a singleton override folder', async () => {
    const first = '2026/11/aaaaaaa0000000000000000000000000.png';
    const later = '2026/11/bbbbbbb0000000000000000000000000.jpg';
    const override = '2026/10/ccccccc0000000000000000000000000.webp';
    fetchList.mockImplementation(async (url) => {
      if (url.searchParams.get('prefix') === '2026/10/ccccccc') return listPage([override]);
      return url.searchParams.has('continuation-token') ? listPage([later]) : listPage([first], 'page-2');
    });

    const slides = await resolveImages({ ...payload, h: 'bbbbbbbcccccccaaaaaaa', o: { '1': '2026/10/' } });

    expect(queried()).toEqual([
      { 'list-type': '2', prefix: '2026/11/', 'max-keys': '1000' },
      { 'list-type': '2', prefix: '2026/10/ccccccc', 'max-keys': '1' },
      { 'list-type': '2', prefix: '2026/11/', 'max-keys': '1000', 'continuation-token': 'page-2' },
    ]);
    expect(slides.map((slide) => slide.url)).toEqual([later, override, first].map((key) => `${imageRoot}/${key}`));
  });
});
