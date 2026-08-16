import { describe, it, expect } from 'vitest';
import {
  coalesceConsecutiveSlideCues,
  deriveCues,
  recordCaptureConfirmed,
  relinkDuplicate,
  type SlideTimeline,
} from './sidecars/timeline';
import { shareTimelineDelta, timelineFromShareDelta } from './shareTimeline';

function slideCues(tl: SlideTimeline) {
  return coalesceConsecutiveSlideCues(deriveCues(tl)).filter(
    (c): c is typeof c & { type: 'slide'; file: string } => c.type === 'slide' && !!c.file,
  );
}

describe('shareTimeline', () => {
  it('round-trips coalesced cues including a reappearance', () => {
    let tl = recordCaptureConfirmed(null, { changeAt: 0, confirmedAt: 2, file: 'Slide_001.png' });
    tl = recordCaptureConfirmed(tl, { changeAt: 165.4, confirmedAt: 173, file: 'Slide_002.png' });
    tl = recordCaptureConfirmed(tl, { changeAt: 640.2, confirmedAt: 648, file: 'Slide_003.png' });
    tl = recordCaptureConfirmed(tl, { changeAt: 652.1, confirmedAt: 660, file: 'Slide_004.png' });
    tl = relinkDuplicate(tl, { duplicateFile: 'Slide_004.png', targetFile: 'Slide_002.png' });

    const files = ['Slide_001.png', 'Slide_002.png', 'Slide_003.png'];
    const delta = shareTimelineDelta(tl, files);
    expect(delta).toBe('0:0,1:165,2:475,1:12');

    const rebuilt = timelineFromShareDelta(delta!, files);
    expect(rebuilt).not.toBeNull();
    const original = slideCues(tl).map((c) => ({ file: c.file, start: Math.round(c.startTime) }));
    const restored = slideCues(rebuilt!).map((c) => ({ file: c.file, start: Math.round(c.startTime) }));
    expect(restored).toEqual(original);

    const dup = Object.values(rebuilt!.resolutions).find((r) => r.state === 'duplicate');
    expect(dup).toMatchObject({ state: 'duplicate', duplicateOf: 'Slide_002.png' });
  });

  it('keeps canonical files in image-index order even if a later index appears first', () => {
    const files = ['Slide_001.png', 'Slide_002.png', 'Slide_003.png'];
    const rebuilt = timelineFromShareDelta('0:0,2:10,1:10', files);
    expect(rebuilt).not.toBeNull();
    const canonical = Object.values(rebuilt!.resolutions)
      .filter((r) => r.state === 'canonical')
      .map((r) => r.file);
    expect(canonical).toEqual(files);
    const starts = [...rebuilt!.events]
      .sort((a, b) => a.changeAt - b.changeAt)
      .map((e) => [e.initialFile, e.changeAt]);
    expect(starts).toEqual([
      ['Slide_001.png', 0],
      ['Slide_003.png', 10],
      ['Slide_002.png', 20],
    ]);
  });

  it('returns undefined when no cue maps onto the filename list', () => {
    const tl = recordCaptureConfirmed(null, { changeAt: 0, confirmedAt: 1, file: 'Slide_A.png' });
    expect(shareTimelineDelta(tl, ['Slide_001.png'])).toBeUndefined();
    expect(timelineFromShareDelta('0:0', [])).toBeNull();
  });
});
