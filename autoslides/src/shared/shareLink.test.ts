import { describe, it, expect } from 'vitest';
import {
  encodeSharePayload,
  decodeSharePayload,
  buildSharePayload,
  buildShareUrl,
  parseCossImageUrl,
  parseShareLink,
  shareImageRefs,
  sharePayloadIdentity,
  encodeShareTimeline,
  decodeShareTimeline,
  payloadHasTimeline,
  precheckShareLinkTimeline,
  type SharePayload,
} from './shareLink';

const HOST = 'https://coss.yanhekt.cn';
const hash = (h: string) => `${HOST}/images/2026/6/${h}.png`;
const IDS = { courseId: '62313', sessionId: '751843' };

describe('shareLink codec', () => {
  it('round-trips a payload through encode → decode', () => {
    const payload: SharePayload = { v: 2, c: '62313', s: '751843', p: '2026/6', n: 7, h: 'abc1234def5678' };
    const decoded = decodeSharePayload(encodeSharePayload(payload));
    expect(decoded).toEqual(payload);
  });

  it('decodes a fragment with or without a leading #', () => {
    const payload: SharePayload = { v: 2, c: '1', p: '2026/6', n: 7, h: 'abc1234' };
    const frag = encodeSharePayload(payload);
    expect(decodeSharePayload(frag)).toEqual(payload);
    expect(decodeSharePayload('#' + frag)).toEqual(payload);
  });

  it('rejects junk / wrong version / non-digit ids', () => {
    expect(decodeSharePayload('')).toBeNull();
    expect(decodeSharePayload('not-base64!!')).toBeNull();
    expect(decodeSharePayload(btoa('{"v":1,"t":"x","p":"2026/6","n":7,"h":"abc"}'))).toBeNull();
    expect(decodeSharePayload(btoa('{"v":2}'))).toBeNull();
    const bad = encodeSharePayload({ v: 2, c: 'nope', p: '2026/6', n: 7, h: 'abc1234' });
    expect(decodeSharePayload(bad)).toBeNull();
  });

  it('parses coss image URLs and ignores others', () => {
    expect(parseCossImageUrl(hash('a'.repeat(32)))).toEqual({ prefix: '2026/6', hash: 'a'.repeat(32), ext: 'png' });
    expect(parseCossImageUrl('https://example.com/foo.png')).toBeNull();
    expect(parseCossImageUrl('https://coss.yanhekt.cn/images/2025/12/' + 'b'.repeat(32) + '.jpg'))
      .toEqual({ prefix: '2025/12', hash: 'b'.repeat(32), ext: 'jpg' });
  });

  it('builds a payload with ids, the dominant prefix, and sparse overrides', () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), c = 'c'.repeat(32);
    const urls = [
      hash(a),
      `${HOST}/images/2025/12/${b}.png`,
      hash(c),
      'https://example.com/not-coss.png',
    ];
    const payload = buildSharePayload(IDS, urls);
    expect(payload.v).toBe(2);
    expect(payload.c).toBe('62313');
    expect(payload.s).toBe('751843');
    expect(payload.p).toBe('2026/6');
    expect(payload.n).toBe(7);
    expect(payload.h).toBe(a.slice(0, 7) + b.slice(0, 7) + c.slice(0, 7));
    expect(payload.o).toEqual({ '1': '2025/12' });
    expect(sharePayloadIdentity(payload)).toEqual({
      courseId: '62313',
      sessionId: '751843',
      liveId: undefined,
    });
  });

  it('records a live broadcast id without inventing a session', () => {
    const payload = buildSharePayload({ courseId: '71736', liveId: '761952' }, [hash('e'.repeat(32))]);
    expect(payload).toMatchObject({ v: 2, c: '71736', l: '761952' });
    expect(payload.s).toBeUndefined();
  });

  it('expands payload back into per-image refs in order', () => {
    const a = 'a'.repeat(32), b = 'b'.repeat(32), c = 'c'.repeat(32);
    const payload = buildSharePayload(IDS, [hash(a), `${HOST}/images/2025/12/${b}.png`, hash(c)]);
    const refs = shareImageRefs(payload);
    expect(refs).toEqual([
      { index: 0, prefix: '2026/6', short: a.slice(0, 7) },
      { index: 1, prefix: '2025/12', short: b.slice(0, 7) },
      { index: 2, prefix: '2026/6', short: c.slice(0, 7) },
    ]);
  });

  it('parseShareLink reads long, short, bare, and invalid links', () => {
    const url = buildShareUrl(buildSharePayload(IDS, [hash('e'.repeat(32))]));
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
    const url = buildShareUrl(buildSharePayload(IDS, [hash('d'.repeat(32))]));
    expect(url.startsWith('https://share.ruc.edu.kg/v1#')).toBe(true);
    const frag = url.split('#')[1];
    expect(decodeSharePayload(frag)?.c).toBe('62313');
    expect(decodeSharePayload(frag)?.s).toBe('751843');
  });

  it('round-trips a v3 payload with a delta timeline', () => {
    const payload: SharePayload = {
      v: 3,
      c: '61841',
      s: '751112',
      p: '2026/8',
      n: 7,
      h: 'abc1234def5678ghi9012',
      t: '0:0,1:165,2:475,1:12',
    };
    const decoded = decodeSharePayload(encodeSharePayload(payload));
    expect(decoded).toEqual(payload);
    expect(payloadHasTimeline(decoded!)).toBe(true);
  });

  it('rejects v3 with a malformed or out-of-range timeline', () => {
    const base = { v: 3 as const, p: '2026/8', n: 7, h: 'abc1234def5678' };
    expect(decodeSharePayload(encodeSharePayload({ ...base, t: 'nope' }))).toBeNull();
    expect(decodeSharePayload(encodeSharePayload({ ...base, t: '' }))).toBeNull();
    expect(decodeSharePayload(encodeSharePayload({ ...base, t: '9:0' }))).toBeNull();
  });

  it('ignores t on a v2 payload and builds v3 only when t is valid', () => {
    const v2: SharePayload = { v: 2, p: '2026/6', n: 7, h: 'abc1234', t: '0:0' };
    const decoded = decodeSharePayload(encodeSharePayload(v2));
    expect(decoded?.v).toBe(2);
    expect(decoded?.t).toBeUndefined();
    expect(payloadHasTimeline(decoded!)).toBe(false);

    const built = buildSharePayload(IDS, [hash('e'.repeat(32))], 7, { t: '0:0,0:10' });
    expect(built.v).toBe(3);
    expect(built.t).toBe('0:0,0:10');
    const skipped = buildSharePayload(IDS, [hash('e'.repeat(32))], 7, { t: '3:0' });
    expect(skipped.v).toBe(2);
    expect(skipped.t).toBeUndefined();
  });

  it('precheckShareLinkTimeline accepts v3, rejects v2, defers short links', () => {
    const v3 = buildShareUrl(buildSharePayload(IDS, [hash('e'.repeat(32))], 7, { t: '0:0,0:10' }));
    const v2 = buildShareUrl(buildSharePayload(IDS, [hash('e'.repeat(32))]));
    expect(precheckShareLinkTimeline(v3)).toBe('ok');
    expect(precheckShareLinkTimeline(`  ${v3}  `)).toBe('ok');
    expect(precheckShareLinkTimeline(v2)).toBe('no-timeline');
    expect(precheckShareLinkTimeline(v2.split('#')[1])).toBe('no-timeline');
    expect(precheckShareLinkTimeline('https://share.ruc.edu.kg/v1/s/k1erPIw4WM')).toBe('ok');
    expect(precheckShareLinkTimeline('')).toBe('empty');
    expect(precheckShareLinkTimeline('https://example.com/v1')).toBe('invalid');
  });

  it('encodes and decodes timeline deltas to absolute cues', () => {
    const cues: Array<[number, number]> = [[0, 0], [1, 165], [2, 640], [1, 652]];
    const t = encodeShareTimeline(cues);
    expect(t).toBe('0:0,1:165,2:475,1:12');
    expect(decodeShareTimeline(t)).toEqual(cues);
    expect(decodeShareTimeline('')).toBeNull();
    expect(decodeShareTimeline('1:-4')).toBeNull();
  });
});
