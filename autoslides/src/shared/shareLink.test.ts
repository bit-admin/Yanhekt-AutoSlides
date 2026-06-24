import { describe, it, expect } from 'vitest';
import {
  encodeSharePayload,
  decodeSharePayload,
  buildSharePayload,
  buildShareUrl,
  parseCossImageUrl,
  parseShareLink,
  shareImageRefs,
  type SharePayload,
} from './shareLink';

const HOST = 'https://coss.yanhekt.cn';
const hash = (h: string) => `${HOST}/images/2026/6/${h}.png`;

describe('shareLink codec', () => {
  it('round-trips a payload through encode → decode', () => {
    const payload: SharePayload = { v: 1, t: '泛函分析 第1周', p: '2026/6', n: 7, h: 'abc1234def5678' };
    const decoded = decodeSharePayload(encodeSharePayload(payload));
    expect(decoded).toEqual(payload);
  });

  it('decodes a fragment with or without a leading #', () => {
    const payload: SharePayload = { v: 1, t: 'x', p: '2026/6', n: 7, h: 'abc1234' };
    const frag = encodeSharePayload(payload);
    expect(decodeSharePayload(frag)).toEqual(payload);
    expect(decodeSharePayload('#' + frag)).toEqual(payload);
  });

  it('rejects junk / wrong version', () => {
    expect(decodeSharePayload('')).toBeNull();
    expect(decodeSharePayload('not-base64!!')).toBeNull();
    expect(decodeSharePayload(btoa('{"v":2}'))).toBeNull();
  });

  it('parses coss image URLs and ignores others', () => {
    expect(parseCossImageUrl(hash('a'.repeat(32)))).toEqual({ prefix: '2026/6', hash: 'a'.repeat(32), ext: 'png' });
    expect(parseCossImageUrl('https://example.com/foo.png')).toBeNull();
    expect(parseCossImageUrl('https://coss.yanhekt.cn/images/2025/12/' + 'b'.repeat(32) + '.jpg'))
      .toEqual({ prefix: '2025/12', hash: 'b'.repeat(32), ext: 'jpg' });
  });

  it('builds a payload with the dominant prefix and sparse overrides', () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), c = 'c'.repeat(32);
    const urls = [
      hash(a),
      `${HOST}/images/2025/12/${b}.png`, // override
      hash(c),
      'https://example.com/not-coss.png', // skipped
    ];
    const payload = buildSharePayload('My Note', urls);
    expect(payload.p).toBe('2026/6');
    expect(payload.n).toBe(7);
    expect(payload.h).toBe(a.slice(0, 7) + b.slice(0, 7) + c.slice(0, 7));
    expect(payload.o).toEqual({ '1': '2025/12' });
  });

  it('expands payload back into per-image refs in order', () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), c = 'c'.repeat(32);
    const payload = buildSharePayload('t', [hash(a), `${HOST}/images/2025/12/${b}.png`, hash(c)]);
    const refs = shareImageRefs(payload);
    expect(refs).toEqual([
      { index: 0, prefix: '2026/6', short: a.slice(0, 7) },
      { index: 1, prefix: '2025/12', short: b.slice(0, 7) },
      { index: 2, prefix: '2026/6', short: c.slice(0, 7) },
    ]);
  });

  it('parseShareLink reads long, short, bare, and invalid links', () => {
    const url = buildShareUrl(buildSharePayload('t', [hash('e'.repeat(32))]));
    const frag = url.split('#')[1];
    expect(parseShareLink(url)).toEqual({ fragment: frag });
    expect(parseShareLink(`  ${url}\n`)).toEqual({ fragment: frag });
    expect(parseShareLink('https://share.ruc.edu.kg/v1/s/k1erPIw4WM')).toEqual({ shortId: 'k1erPIw4WM' });
    expect(parseShareLink('https://share.ruc.edu.kg/v1/s/k1erPIw4WM/')).toEqual({ shortId: 'k1erPIw4WM' });
    expect(parseShareLink(frag)).toEqual({ fragment: frag });
    expect(parseShareLink('')).toBeNull();
    expect(parseShareLink('https://example.com/v1')).toBeNull();
  });

  it('buildShareUrl produces a fragment link on the share origin', () => {
    const url = buildShareUrl(buildSharePayload('t', [hash('d'.repeat(32))]));
    expect(url.startsWith('https://share.ruc.edu.kg/v1#')).toBe(true);
    const frag = url.split('#')[1];
    expect(decodeSharePayload(frag)?.t).toBe('t');
  });
});
