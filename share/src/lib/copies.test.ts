import { describe, expect, it } from 'vitest';
import { decodeSharePayload, encodeSharePayload, encodeShareTimeline } from './shareLink';
import { exportSlideFilenames, timelineFromSharePayload } from './shareTimeline';
import { XCLIENT_SIGNATURE } from './yanhekt';

// Values these copies must keep in step with the desktop app.

describe('yanhekt client signature', () => {
  it('is the golden md5 vector shared with crypto.test.ts / web / relay / indexer', () => {
    expect(XCLIENT_SIGNATURE).toBe('72b77856f6df3f563ab6e658631cac3d');
  });
});

describe('exportSlideFilenames', () => {
  it('numbers slides like the desktop export and zip.ts', () => {
    expect(exportSlideFilenames(0)).toEqual([]);
    expect(exportSlideFilenames(2)).toEqual(['Slide_001.png', 'Slide_002.png']);
    expect(exportSlideFilenames(1000)[999]).toBe('Slide_1000.png');
  });
});

describe('timelineFromSharePayload', () => {
  it('rebuilds canonical + duplicate events from a v3 link', () => {
    const fragment = encodeSharePayload({
      v: 3,
      c: '1',
      s: '2',
      p: '2026/6',
      n: 4,
      h: 'aaaabbbb',
      t: encodeShareTimeline([[0, 10], [1, 20], [0, 30]]),
    });
    const payload = decodeSharePayload(fragment);
    expect(payload).not.toBeNull();
    const tl = timelineFromSharePayload(payload!);
    expect(tl?.events.map((e) => e.initialFile)).toEqual(['Slide_001.png', 'Slide_002.png', 'Slide_001.png']);
    expect(Object.values(tl!.resolutions).map((r) => r.state)).toEqual(['canonical', 'canonical', 'duplicate']);
  });
});
