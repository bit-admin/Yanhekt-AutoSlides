import { describe, it, expect } from 'vitest';
import { exportSlideFilenames, isSafeSlideBasename } from './notesContent';
import type { SlideTimeline } from './sidecars/timeline';

const longA = 'Slide_操作系统_第1周_星期二_第5大节__c61841s751112_001.png';
const longB = 'Slide_操作系统_第1周_星期二_第5大节__c61841s751112_002.png';

function timelineOf(files: string[]): SlideTimeline {
  const events = files.map((file, i) => ({
    id: `evt_${i + 1}`,
    changeAt: i * 10,
    confirmedAt: i * 10 + 1,
    initialFile: file,
  }));
  const resolutions = Object.fromEntries(
    events.map((e) => [e.id, { state: 'canonical' as const, file: e.initialFile! }]),
  );
  return {
    version: 1,
    extractor: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    events,
    resolutions,
  };
}

describe('exportSlideFilenames', () => {
  it('uses timeline.json canonical files', () => {
    expect(exportSlideFilenames(2, timelineOf([longA, longB]))).toEqual([longA, longB]);
  });

  it('falls back to Slide_NNN.png when there is no usable timeline', () => {
    expect(exportSlideFilenames(2)).toEqual(['Slide_001.png', 'Slide_002.png']);
    expect(exportSlideFilenames(2, timelineOf([longA]))).toEqual(['Slide_001.png', 'Slide_002.png']);
  });

  it('rejects path-like names', () => {
    expect(isSafeSlideBasename('../Slide_001.png')).toBe(false);
    expect(isSafeSlideBasename(longA)).toBe(true);
  });
});
