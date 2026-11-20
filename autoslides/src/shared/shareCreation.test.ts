import { describe, expect, it } from 'vitest';
import { buildSlideShareLink } from './shareCreation';
import { decodeSharePayload, decodeShareTimeline, parseShareLink, shareImageRefs } from './shareLink';
import { COSS_HOST } from './shareResolve';
import { recordCaptureConfirmed } from './sidecars/timeline';

const identity = { courseId: 11, sessionId: 22 };
const image = (hash: string) => `${COSS_HOST}/images/2026/6/${hash.repeat(32)}.png`;

function slide(filename: string, hash: string) {
  return { filename, url: image(hash) };
}

function capture(timeline: Parameters<typeof recordCaptureConfirmed>[0], file: string, time: number) {
  return recordCaptureConfirmed(timeline, { changeAt: time, confirmedAt: time, file });
}

describe('buildSlideShareLink', () => {
  it('makes a v2 link with normalized IDs when no timeline is requested', () => {
    const link = buildSlideShareLink(identity, [slide('Slide_001.png', 'a')])!;
    expect(link).toMatchObject({ imageCount: 1, canShorten: true });
    expect(parseShareLink(link.longUrl)).toEqual({ fragment: link.fragment });
    expect(decodeSharePayload(link.fragment)).toMatchObject({ v: 2, c: '11', s: '22', h: 'aaaaaaa' });
  });

  it('maps v3 cues to the selected hosted image order, ignoring omitted images', () => {
    let timeline = capture(null, 'Slide_001.png', 0);
    timeline = capture(timeline, 'Slide_002.png', 15);
    timeline = capture(timeline, 'Slide_003.png', 30);
    const link = buildSlideShareLink(identity, [
      { filename: 'Slide_001.png', url: image('a').replace(COSS_HOST, 'https://example.test') },
      slide('Slide_003.png', 'c'),
      slide('Slide_002.png', 'b'),
    ], timeline)!;
    const payload = decodeSharePayload(link.fragment)!;
    expect(link.imageCount).toBe(2);
    expect(payload.v).toBe(3);
    expect(shareImageRefs(payload).map(({ short }) => short)).toEqual(['ccccccc', 'bbbbbbb']);
    expect(decodeShareTimeline(payload.t!)).toEqual([[1, 15], [0, 30]]);
  });

  it('falls back to v2 when none of the selected slides have cues', () => {
    const timeline = capture(null, 'Slide_001.png', 0);
    const link = buildSlideShareLink(identity, [slide('Slide_002.png', 'b')], timeline)!;
    expect(decodeSharePayload(link.fragment)?.v).toBe(2);
  });

  it('returns no link when the selection contains no resolvable slides', () => {
    expect(buildSlideShareLink(identity, [])).toBeNull();
    expect(buildSlideShareLink(identity, [{ filename: 'one.png', url: `${COSS_HOST}/images/cover.png` }])).toBeNull();
  });

  it('still returns a long link when the fragment exceeds the shortener limit', () => {
    const link = buildSlideShareLink(identity, Array.from({ length: 1200 }, (_, i) => slide(`Slide_${i}.png`, 'a')))!;
    expect(link.fragment.length).toBeGreaterThan(8192);
    expect(link.canShorten).toBe(false);
    expect(parseShareLink(link.longUrl)).toEqual({ fragment: link.fragment });
  });
});
